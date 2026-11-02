/**
 * SilentCall-SOS: Proximity Blind-Tap Detection Engine
 * 
 * Detects covert pocket blind-taps or hand gestures over the proximity sensor:
 * - W3C Generic Sensor API (ProximitySensor)
 * - Legacy deviceproximity / userproximity events
 * - 3 'near' events within a 2000ms rolling window -> Triggers PROXIMITY_BLIND_TAP
 * - Desktop/Presentation Fallback: Simulated camera notch tap/hover tracking
 */

const WINDOW_MS = 2000;
const REQUIRED_NEAR_COUNT = 3;
let rollingTimestamps = [];
let lastTriggerTime = 0;

/**
 * Evaluates whether the rolling window of 'near' events satisfies the trigger threshold
 */
function recordNearState(onTriggerCallback, source = 'HARDWARE_SENSOR') {
  const now = Date.now();

  // Debounce multiple triggers within 3 seconds
  if (now - lastTriggerTime < 3000) {
    return false;
  }

  // Filter out events older than 2000ms
  rollingTimestamps = rollingTimestamps.filter((t) => now - t <= WINDOW_MS);
  rollingTimestamps.push(now);

  console.log(`[ProximityEngine] 'Near' state recorded (${rollingTimestamps.length}/${REQUIRED_NEAR_COUNT}) via ${source}`);

  if (rollingTimestamps.length >= REQUIRED_NEAR_COUNT) {
    lastTriggerTime = now;
    rollingTimestamps = [];
    console.warn('[ProximityEngine] Threshold met! Firing PROXIMITY_BLIND_TAP covert emergency trigger.');
    
    // Tactile haptic feedback if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([30, 50, 30, 50, 80]);
      } catch (e) {}
    }

    if (onTriggerCallback) {
      onTriggerCallback('PROXIMITY_BLIND_TAP');
    }
    return true;
  }
  return false;
}

/**
 * Attaches native W3C or legacy ProximitySensor event listeners
 * @param {Function} onTriggerCallback - callback receiving ('PROXIMITY_BLIND_TAP')
 * @returns {Function} cleanup function
 */
export function setupProximityTrigger(onTriggerCallback) {
  let proximitySensor = null;

  // 1. Try W3C Generic Sensor API ProximitySensor
  if ('ProximitySensor' in window) {
    try {
      // @ts-ignore
      proximitySensor = new window.ProximitySensor({ frequency: 10 });
      proximitySensor.addEventListener('reading', () => {
        // proximitySensor.near === true indicates object/hand is near (<5cm)
        if (proximitySensor.near) {
          recordNearState(onTriggerCallback, 'W3C_PROXIMITY_SENSOR');
        }
      });
      proximitySensor.start();
      console.log('[ProximityEngine] W3C ProximitySensor initialized.');
    } catch (err) {
      console.warn('[ProximityEngine] W3C ProximitySensor start failed:', err.message);
    }
  }

  // 2. Legacy Firefox / WebKit deviceproximity event listener
  const handleDeviceProximity = (event) => {
    // event.value in centimeters, event.min, event.max
    const isNear = event.value !== undefined && event.min !== undefined && event.value <= event.min + 1;
    if (isNear) {
      recordNearState(onTriggerCallback, 'LEGACY_DEVICE_PROXIMITY');
    }
  };

  // 3. UserProximity event
  const handleUserProximity = (event) => {
    if (event.near) {
      recordNearState(onTriggerCallback, 'LEGACY_USER_PROXIMITY');
    }
  };

  window.addEventListener('deviceproximity', handleDeviceProximity);
  window.addEventListener('userproximity', handleUserProximity);

  // Return comprehensive cleanup function
  return () => {
    if (proximitySensor) {
      try {
        proximitySensor.stop();
      } catch (e) {}
    }
    window.removeEventListener('deviceproximity', handleDeviceProximity);
    window.removeEventListener('userproximity', handleUserProximity);
  };
}

/**
 * Desktop / Laptop Presentation Fallback:
 * Allows tapping or clicking the simulated camera notch/island 3 times in 2 seconds
 * to demonstrate the blind-tap trigger without physical sensor hardware.
 */
export function registerMockProximityTap(onTriggerCallback) {
  return recordNearState(onTriggerCallback, 'MOCK_CAMERA_NOTCH');
}
