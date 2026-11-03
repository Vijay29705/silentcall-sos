import React, { useState, useEffect, useRef, useCallback } from 'react';
import DuressLockscreen from './components/DuressLockscreen';
import CovertCalculator from './components/CovertCalculator';
import DispatcherDashboard from './components/DispatcherDashboard';
import {
  initProximityTrigger,
  collectEmergencyTelemetry,
  heartbeatManager
} from './utils/sensorTriggers';
import { acquireEmergencyWakeLock, releaseEmergencyWakeLock } from './utils/wakeLockManager';
import { signEmergencyPayload } from './utils/cryptoSigner';
import { transmitWithFallback, drainAndSyncPendingIncidents } from './utils/networkFallback';
import {
  Smartphone,
  LayoutDashboard,
  Columns,
  Radio,
  ShieldAlert,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Lock,
  Skull,
  Activity,
  FileCode
} from 'lucide-react';

// Production & Local Dynamic API/WS Configuration
const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.')
);
const defaultProto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const defaultHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
export const WS_URL = import.meta.env.VITE_WS_URL || (isLocal ? `${defaultProto}//${defaultHost}:5000` : 'wss://silentcall-sos.onrender.com');
export const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_WS_URL ? import.meta.env.VITE_WS_URL.replace(/^ws(s?):/, 'http$1:') : (isLocal ? `http://${defaultHost}:5000` : 'https://silentcall-sos.onrender.com'));

export default function App() {
  // Mobile Device State Machine: Defaults to LOCKSCREEN so it acts as the device lock guard
  const [activeTab, setActiveTab] = useState(isNative ? 'PHONE' : 'SPLIT');
  const [mobileScreenState, setMobileScreenState] = useState('LOCKSCREEN');

  const [incidents, setIncidents] = useState([]);
  const [pcrVehicles, setPcrVehicles] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isDeviceDestroyed, setIsDeviceDestroyed] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Auto-request GPS Location Permissions & Listen for Screen Wake Lock
  useEffect(() => {
    if (isNative) {
      // Prompt Android OS Geolocation Permission Dialog immediately on launch
      import('@capacitor/geolocation').then(({ Geolocation }) => {
        Geolocation.requestPermissions().then((status) => {
          console.log('[GPS] Geolocation permission status:', status);
        }).catch((err) => console.warn('[GPS] Geolocation request failed:', err));
      }).catch(() => {});
    }

    const handleShowLock = () => setMobileScreenState('LOCKSCREEN');
    window.addEventListener('SHOW_LOCKSCREEN', handleShowLock);
    return () => window.removeEventListener('SHOW_LOCKSCREEN', handleShowLock);
  }, []);

  // WebSocket broker connection
  const connectWebSocket = useCallback(() => {
    console.log(`[WS-Client] Connecting to ${WS_URL}...`);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS-Client] WebSocket connected successfully');
      window.__SILENTCALL_WS__ = ws;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[WS-Client] Received:', message.type);

        switch (message.type) {
          case 'INITIAL_STATE': {
            if (message.payload?.incidents) {
              setIncidents(message.payload.incidents);
            }
            if (message.payload?.pcrVehicles) {
              setPcrVehicles(message.payload.pcrVehicles);
            }
            break;
          }

          case 'TRIGGER_SOS': {
            const newIncident = message.payload;
            setActiveIncidentId(newIncident.id);
            setIncidents((prev) => [newIncident, ...prev.filter((i) => i.id !== newIncident.id)]);

            // Start 3-second heartbeat watchdog emitter
            heartbeatManager.start(newIncident.id, wsRef.current, () => ({
              battery: newIncident.telemetry?.battery,
              decibelLevel: newIncident.telemetry?.decibelLevel,
              coordinates: newIncident.coordinates
            }));

            const triggerLabel = (newIncident.triggerType || 'EMERGENCY').replace(/_/g, ' ');
            showNotification(`🚨 INCOMING ${triggerLabel}: ${newIncident.id} (Assigned: ${newIncident.assignedPcrUnit?.callsign || 'Patrol Unit'})`);
            break;
          }

          // INCIDENT REVOCATION (FALSE ALARM GUARD)
          case 'INCIDENT_REVOKED': {
            const { id, reason, incident } = message.payload || {};
            if (id === activeIncidentId) {
              heartbeatManager.stop();
              setActiveIncidentId(null);
            }
            setIncidents((prev) =>
              prev.map((i) =>
                i.id === id
                  ? {
                      ...i,
                      ...(incident || {}),
                      status: 'FALSE_ALARM_REVOKED',
                      threatLevel: 'REVOKED',
                      revocationReason: reason || 'Parent Master PIN Abort'
                    }
                  : i
              )
            );
            window.dispatchEvent(new CustomEvent('INCIDENT_REVOKED', { detail: message.payload }));
            showNotification(`⚠️ ALERT REVOKED: False alarm cancelled by citizen Master PIN (${reason || 'Parent Master PIN Abort'}).`);
            break;
          }

          // DEAD MAN'S SWITCH ESCLATION FROM SERVER (>8s missed heartbeat)
          case 'ESCALATE_DEVICE_DESTROYED': {
            const destroyedIncident = message.payload;
            setIsDeviceDestroyed(true);
            setIncidents((prev) =>
              prev.map((i) => (i.id === destroyedIncident.id ? { ...i, ...destroyedIncident } : i))
            );
            showNotification(`💀 DEAD MAN'S SWITCH FIRED: Device signal lost >8s for ${destroyedIncident.id}! Urgent armed backup dispatched.`);
            break;
          }

          case 'RESOLVE_INCIDENT': {
            const resolved = message.payload;
            if (resolved.id === activeIncidentId) {
              heartbeatManager.stop();
              setActiveIncidentId(null);
            }
            setIncidents((prev) =>
              prev.map((i) => (i.id === resolved.id ? { ...i, ...resolved } : i))
            );
            showNotification(`✓ Incident ${resolved.id} Marked Resolved`);
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[WS-Client] Parse error:', err);
      }
    };

    ws.onclose = () => {
      console.warn('[WS-Client] Disconnected. Reconnecting in 3s...');
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('[WS-Client] Socket error:', err);
      ws.close();
    };
  }, [activeIncidentId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      heartbeatManager.stop();
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  // Toast alert
  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 5000);
  };

  // Master SOS Transmission with Dual-Channel Fallback & Cryptographic Proof
  const triggerEmergency = useCallback(async (triggerType = 'COVERT_CALCULATOR_112') => {
    try {
      // 1. Prevent background throttling
      acquireEmergencyWakeLock();

      // 2. Collect 200ms acoustic & indoor geofenced telemetry
      const telemetry = await collectEmergencyTelemetry();

      const rawPayload = {
        threatLevel: triggerType === 'DURESS_PIN_COERCION' ? 'CRITICAL' : telemetry.decibelLevel > 75 ? 'CRITICAL' : 'HIGH',
        triggerType,
        coordinates: telemetry.coordinates,
        decibelLevel: telemetry.decibelLevel,
        battery: telemetry.battery,
        indoorFloorEstimate: telemetry.indoorFloorEstimate,
        device: telemetry.device,
        telemetry
      };

      // 3. Cryptographically sign payload with ECDSA (Section 63 BSA / 65B compliance)
      const signedPayload = await signEmergencyPayload(rawPayload);

      const packet = {
        type: 'TRIGGER_SOS',
        payload: signedPayload
      };

      // 4. Supervised dual-channel dispatch (WebSocket with 3000ms deadline -> 2G SMS + IndexedDB)
      const transmissionResult = await transmitWithFallback(packet, wsRef.current);

      if (transmissionResult.fallbackTriggered) {
        showNotification('📡 CELLULAR FALLBACK: WebSocket unavailable (>3000ms). Dispatched via 2G SMS & queued locally.');
      }

      console.log(`[SOS-TRIGGER] Emergency packet processed: ${triggerType}`, transmissionResult);
    } catch (err) {
      console.error('[SOS-TRIGGER ERROR]', err);
    }
  }, []);

  // Hardware Proximity Sensor listener
  useEffect(() => {
    const cleanup = initProximityTrigger((triggerCode) => {
      triggerEmergency('PROXIMITY_BLIND_TAP');
      showNotification('📡 PROXIMITY BLIND-TAP DETECTED: Covert SOS Dispatched!');
    });
    return cleanup;
  }, [triggerEmergency]);

  // Simulate Device Smashed / Dead Man's Switch test
  const handleSimulateDeviceDestroy = () => {
    heartbeatManager.simulateDestroy();
    setIsDeviceDestroyed(true);
    showNotification('⚠️ Device destroyed simulation active: Background pings terminated. Server watchdog will trigger in 8 seconds!');
  };

  // Resolve incident
  const handleResolveIncident = (id, notes) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'RESOLVE_INCIDENT',
          payload: { id, notes }
        })
      );
    } else {
      fetch(`${API_BASE_URL}/api/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes })
      }).catch((e) => console.error('HTTP Fallback Resolve Failed:', e));
    }
  };

  // Reset Demo State
  const handleResetDemo = () => {
    releaseEmergencyWakeLock();
    heartbeatManager.stop();
    setMobileScreenState('LOCKSCREEN');
    setIsDeviceDestroyed(false);
    setActiveIncidentId(null);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'RESET_DEMO' }));
    }
    showNotification('🔄 Demo Reset: Device locked & baseline incidents restored');
  };

  // Pure Native Mobile Viewport (Zero Demo UI / Zero Headers)
  if (isNative) {
    return (
      <div className="h-screen w-screen bg-black text-white overflow-hidden flex flex-col justify-center items-center select-none">
        {mobileScreenState === 'LOCKSCREEN' ? (
          <DuressLockscreen
            onUnlock={() => setMobileScreenState('CALCULATOR')}
            triggerEmergency={triggerEmergency}
            onRevokeSOS={(reason) => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'REVOKE_SOS',
                    payload: { id: activeIncidentId, reason: reason || 'Parent Master PIN Abort' }
                  })
                );
              }
              heartbeatManager.stop();
              setActiveIncidentId(null);
            }}
            onSimulateDeviceDestroy={handleSimulateDeviceDestroy}
            onResetDemo={handleResetDemo}
            isDeviceDestroyed={isDeviceDestroyed}
            ws={wsRef.current}
          />
        ) : (
          <CovertCalculator
            onSendSOS={() => triggerEmergency('COVERT_CALCULATOR_112')}
            isConnected={isConnected}
            showDebugOverlay={false}
            onLock={() => setMobileScreenState('LOCKSCREEN')}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* Top Presentation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-2.5 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <span className="font-extrabold text-white text-sm tracking-tight flex items-center gap-1.5">
              SilentCall-SOS
              <span className="text-[10px] bg-rose-600/30 text-rose-300 border border-rose-500/50 px-2 py-0.2 rounded-full font-mono">
                C-DAC ERSS 112 Triage
              </span>
            </span>
          </div>

          <button
            onClick={() => setShowProjectInfo(!showProjectInfo)}
            className="hidden md:flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700/60 transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            System Architecture
          </button>
        </div>

        {/* Dedicated 112 Dispatcher Console Header Tag */}
        <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-inner">
          <LayoutDashboard className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-bold tracking-wide text-slate-200 font-mono">
            112 CENTRAL DISPATCHER &amp; INVESTIGATION CONSOLE
          </span>
        </div>

        {/* Quick Controls & Status */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 mr-2">
            <button
              onClick={() => triggerEmergency('DURESS_PIN_COERCION')}
              className="text-[11px] bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
            >
              <Radio className="w-3 h-3 text-rose-400" />
              Simulate Duress
            </button>

            <button
              onClick={handleResetDemo}
              title="Reset Demo State"
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-lg border border-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="hidden xl:inline text-slate-400 text-[11px]">
              {isConnected ? 'NODE:5000 SYNCED' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-rose-500/80 text-white text-xs font-medium px-4 py-2 rounded-xl shadow-2xl shadow-rose-950/60 flex items-center gap-2 animate-bounce backdrop-blur">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Architecture Modal */}
      {showProjectInfo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-2xl p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setShowProjectInfo(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-rose-600/20 text-rose-400 rounded-xl border border-rose-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">SilentCall-SOS: Engine Specifications</h3>
                <p className="text-xs text-slate-400">Zero-Audio Emergency Triage Engine (Final Year B.Tech IT)</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed max-h-[65vh] overflow-y-auto pr-2">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-semibold text-rose-400 block mb-1">1. Multi-Modal Trigger Matrix</span>
                Supports 3 distinct stealth activation triggers:
                <ul className="list-disc ml-4 mt-1 space-y-0.5 text-neutral-300">
                  <li><b>Duress Lockscreen (PIN 9999)</b>: Simulates fake shutdown &amp; black screen while transmitting background beacons.</li>
                  <li><b>Proximity Blind-Tap (3x in 2s)</b>: Pocket tap trigger without needing to look at or unlock screen.</li>
                  <li><b>Covert iOS Calculator (PIN 1234 &rarr; 112=)</b>: Authentic math calculator intercepting emergency sequence.</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-semibold text-cyan-400 block mb-1">2. Dead Man's Switch (8s Watchdog)</span>
                Once an incident is triggered, the client transmits heartbeats every 3000ms. If the assailant smashes the phone or pulls the battery (&gt;8s missed heartbeats), the server automatically escalates the incident to <span className="text-rose-400 font-bold">CRITICAL_DEVICE_DESTROYED</span> with flashing skull markers.
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-semibold text-blue-400 block mb-1">3. Automated Nominatim Reverse Geocoding & PCR Vectoring</span>
                Server automatically queries OpenStreetMap Nominatim for exact Indian street names and dispatches the closest mock PCR patrol interceptor with real-time vectoring line.
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-semibold text-emerald-400 block mb-1">4. C-DAC ERSS 112 CAD Standard JSON</span>
                All packets format directly into the Indian Ministry of Home Affairs Computer-Aided Dispatch standard for seamless integration with police emergency servers.
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowProjectInfo(false)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
              >
                Close & Return to Live Demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Presentation Viewport: Dedicated 112 Dispatcher Console for Web */}
      <main className="flex-1 overflow-hidden relative">
        <DispatcherDashboard
          incidents={incidents}
          pcrVehicles={pcrVehicles}
          onResolveIncident={handleResolveIncident}
          onSimulateDemo={() => triggerEmergency('COVERT_CALCULATOR_112')}
          isConnected={isConnected}
        />
      </main>
    </div>
  );
}