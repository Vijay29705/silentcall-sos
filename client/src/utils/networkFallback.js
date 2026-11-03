/**
 * SilentCall-SOS: Dual-Channel Network Resilience Engine
 * 
 * Implements:
 * 1. WebSocket Transmission Supervisor with 3000ms deadline.
 * 2. 2G Structured SMS URI Fallback (`sms:112?body=SOS%23...`) for dead-zone emergency bypass.
 * 3. Offline IndexedDB store for zero-data-loss packet preservation.
 * 4. Background synchronization daemon automatically triggered on `window.online`.
 */

const DB_NAME = 'SilentCallNetworkDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_transmissions';

const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL ? import.meta.env.VITE_WS_URL.replace(/^ws(s?):/, 'http$1:') : (isNative ? 'https://silentcall-sos.onrender.com' : (typeof window !== 'undefined' ? `http://${window.location.hostname || 'localhost'}:5000` : '')));

/**
 * Open or create the IndexedDB store for pending emergency transmissions
 */
function openNetworkDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'queueId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists an unsent emergency packet into browser IndexedDB
 */
export async function queueIncidentOffline(payload) {
  try {
    const db = await openNetworkDatabase();
    const queueId = `QUEUE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      queueId,
      payload,
      queuedAt: new Date().toISOString(),
      retryCount: 0
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });

    console.log(`[NetworkSupervisor 💾] Queued emergency packet ${queueId} into IndexedDB.`);
    return record;
  } catch (err) {
    console.warn('[NetworkSupervisor] Failed to store in IndexedDB:', err.message);
    // LocalStorage fallback
    try {
      const existing = JSON.parse(localStorage.getItem('silentcall_pending_queue') || '[]');
      const fallbackRecord = {
        queueId: `LS-${Date.now()}`,
        payload,
        queuedAt: new Date().toISOString()
      };
      existing.push(fallbackRecord);
      localStorage.setItem('silentcall_pending_queue', JSON.stringify(existing));
      return fallbackRecord;
    } catch (lsErr) {
      return null;
    }
  }
}

/**
 * Retrieve all pending transmissions from IndexedDB
 */
export async function getQueuedIncidents() {
  try {
    const db = await openNetworkDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    try {
      return JSON.parse(localStorage.getItem('silentcall_pending_queue') || '[]');
    } catch (e) {
      return [];
    }
  }
}

/**
 * Remove an acknowledged transmission from IndexedDB
 */
export async function removeQueuedIncident(queueId) {
  try {
    const db = await openNetworkDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(queueId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    try {
      const existing = JSON.parse(localStorage.getItem('silentcall_pending_queue') || '[]');
      const filtered = existing.filter((item) => item.queueId !== queueId);
      localStorage.setItem('silentcall_pending_queue', JSON.stringify(filtered));
    } catch (e) {}
  }
}

/**
 * Construct structured 2G SMS URI for cellular dead-zone fallback
 * Format: sms:112?body=SOS%23LAT:${lat}%23LNG:${lng}%23DB:${db}%23BAT:${bat}%23SIG:${signature}
 */
export function constructSmsUri(payload) {
  const p = payload.payload || payload;
  const lat = p.coordinates?.latitude || p.lat || 13.0550;
  const lng = p.coordinates?.longitude || p.lng || 80.2600;
  const db = p.decibelLevel || p.telemetry?.decibelLevel || 45;
  const bat = p.battery?.level ?? p.telemetry?.battery?.level ?? 50;

  // Extract compact digital signature prefix to fit standard 160-char SMS limits
  const rawSig = p.signature || payload.signature || 'UNSIGNED';
  const compactSignature = rawSig.length > 24 ? rawSig.substring(0, 24) : rawSig;

  const bodyContent = `SOS#LAT:${lat}#LNG:${lng}#DB:${db}#BAT:${bat}#SIG:${compactSignature}`;
  
  // Percent-encode '#' as '%23' as per RFC 3986 SMS URI specification
  const encodedBody = bodyContent.replace(/#/g, '%23');

  return `sms:112?body=${encodedBody}`;
}

/**
 * Transmit with supervisor: Attempts WebSocket with 3000ms deadline;
 * on timeout or failure, executes 2G SMS URI dispatch and queues in IndexedDB.
 */
export async function transmitWithFallback(payload, socketInstance) {
  console.log('[NetworkSupervisor] Supervising emergency transmission with 3000ms SLA window...');

  const sendPromise = new Promise((resolve, reject) => {
    // If socket is already OPEN, transmit immediately
    if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
      try {
        socketInstance.send(JSON.stringify(payload));
        return resolve({ channel: 'WEBSOCKET_PRIMARY', timestamp: Date.now() });
      } catch (err) {
        return reject(err);
      }
    }

    // If socket is CONNECTING, wait for open event
    if (socketInstance && socketInstance.readyState === WebSocket.CONNECTING) {
      const onOpen = () => {
        cleanup();
        try {
          socketInstance.send(JSON.stringify(payload));
          resolve({ channel: 'WEBSOCKET_PRIMARY', timestamp: Date.now() });
        } catch (e) {
          reject(e);
        }
      };

      const onError = (e) => {
        cleanup();
        reject(new Error('WebSocket connection terminated while in CONNECTING state'));
      };

      const cleanup = () => {
        socketInstance.removeEventListener('open', onOpen);
        socketInstance.removeEventListener('error', onError);
      };

      socketInstance.addEventListener('open', onOpen);
      socketInstance.addEventListener('error', onError);
      return;
    }

    return reject(new Error('WebSocket is offline or disconnected'));
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('WebSocket transmission exceeded 3000ms timeout threshold'));
    }, 3000);
  });

  try {
    const result = await Promise.race([sendPromise, timeoutPromise]);
    console.log('[NetworkSupervisor] Primary WebSocket dispatch confirmed:', result);
    return {
      success: true,
      channel: 'WEBSOCKET',
      payload
    };
  } catch (err) {
    console.warn('[NetworkSupervisor ⚠️] Primary transmission failed or timed out:', err.message);
    console.warn('[NetworkSupervisor] Launching Dual-Channel 2G SMS Fallback & IndexedDB Queue...');

    // 1. Construct 2G Structured SMS URI
    const smsUri = constructSmsUri(payload);

    // 2. Queue into IndexedDB for background sync upon network recovery
    const queueRecord = await queueIncidentOffline(payload);

    // 3. Trigger 2G SMS Native Messaging App
    try {
      if (typeof window !== 'undefined' && window.location) {
        console.log('[NetworkSupervisor] Opening native SMS dispatcher:', smsUri);
        window.location.href = smsUri;
      }
    } catch (redirectErr) {
      console.warn('[NetworkSupervisor] Window redirect error:', redirectErr.message);
    }

    return {
      success: false,
      fallbackTriggered: true,
      channel: '2G_SMS_AND_INDEXED_DB',
      smsUri,
      queueRecord,
      error: err.message
    };
  }
}

/**
 * Drain and sync all pending IndexedDB incidents once network is restored
 */
export async function drainAndSyncPendingIncidents(activeSocket) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[NetworkSupervisor] Device offline. Cannot drain sync queue yet.');
    return;
  }

  const queued = await getQueuedIncidents();
  if (queued.length === 0) return;

  console.log(`[NetworkSupervisor 🔄] Network online: Draining and synchronizing ${queued.length} stored offline incidents...`);

  for (const item of queued) {
    try {
      const packet = item.payload;
      let synced = false;

      // 1. Try WebSocket
      const ws = activeSocket || window.__SILENTCALL_WS__;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(packet));
        synced = true;
      } else {
        // 2. Try REST fallback
        const res = await fetch(`${API_BASE_URL}/api/sos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(packet.payload || packet)
        });
        if (res.ok) synced = true;
      }

      if (synced) {
        await removeQueuedIncident(item.queueId);
        console.log(`[NetworkSupervisor] Successfully synchronized queued incident: ${item.queueId}`);
      }
    } catch (syncErr) {
      console.warn(`[NetworkSupervisor] Sync retry failed for ${item.queueId}:`, syncErr.message);
    }
  }
}

// Auto-register online listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[NetworkSupervisor 🌐] Network connection restored (online event fired).');
    drainAndSyncPendingIncidents(window.__SILENTCALL_WS__);
  });
}

