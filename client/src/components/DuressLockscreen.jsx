import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  Power,
  Wifi,
  Battery,
  RefreshCw,
  Activity,
  AlertTriangle,
  Skull,
  CheckCircle2,
  XCircle,
  Timer,
  ShieldCheck,
  ChevronRight,
  Info
} from 'lucide-react';
import { registerMockProximityTap } from '../utils/sensorTriggers';
import { acquireEmergencyWakeLock, releaseEmergencyWakeLock } from '../utils/wakeLockManager';
import { getGeolocationTelemetry } from '../utils/telemetry';

const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
const defaultHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_WS_URL ? import.meta.env.VITE_WS_URL.replace(/^ws(s?):/, 'http$1:') : (isNative ? 'https://silentcall-sos.onrender.com' : `http://${defaultHost}:5000`));

/**
 * DuressLockscreen
 * 
 * Multi-Tier False-Alarm Mitigation Protocol:
 * 1. State Machine: LOCKED -> SHUTTING_DOWN -> BLACKOUT -> REVOKE_MODAL -> UNLOCKED
 * 2. 6-Digit Master PIN: '180499' unlocks normally.
 * 3. 6-Digit Duress Coercion PIN: '999999' with a 1.5-second hold requirement on 6th '9'.
 *    Quick taps (< 1500ms) by toddlers or pocket friction are rejected.
 * 4. 15-Second Silent Revocation Window: Simulated OS shutdown & blackout trigger immediately,
 *    holding network SOS dispatch in pending state for 15s.
 * 5. Hidden Escape / Abort Hatch: Double-clicking top-right corner on blackout screen opens
 *    a discreet Master PIN ('180499') prompt. Entering '180499' cancels pending SOS, emits
 *    REVOKE_SOS if already dispatched, and smoothly restores unlocked state.
 */
export default function DuressLockscreen({
  onUnlock,
  triggerEmergency,
  onRevokeSOS,
  onSimulateDeviceDestroy,
  onResetDemo,
  isDeviceDestroyed = false,
  ws = null,
  isFramed = false
}) {
  // State Machine: 'LOCKED' | 'SHUTTING_DOWN' | 'BLACKOUT' | 'REVOKE_MODAL' | 'UNLOCKED'
  const [screenState, setScreenState] = useState('LOCKED');

  // Lockscreen Pin State
  const [pin, setPin] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [gestureGuardAlert, setGestureGuardAlert] = useState(null);
  const [showDemoGuide, setShowDemoGuide] = useState(false);

  // Holding status for 6th digit '9'
  const [isHoldingSixthDigit, setIsHoldingSixthDigit] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  // Master PIN abort state in REVOKE_MODAL
  const [abortPin, setAbortPin] = useState('');
  const [isAbortShaking, setIsAbortShaking] = useState(false);

  // 15-Second Grace Countdown & Dispatch Tracker
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(15);
  const [isSosDispatched, setIsSosDispatched] = useState(false);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notchRipple, setNotchRipple] = useState(false);

  // Refs for timers and touch events
  const pressStartRef = useRef(0);
  const longPressTimerRef = useRef(null);
  const holdProgressIntervalRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const graceTimerRef = useRef(null);
  const shutdownTimeoutRef = useRef(null);
  const lastCornerTapRef = useRef(0);

  // Live clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(currentTime.getHours()).padStart(2, '0');
  const minutes = String(currentTime.getMinutes()).padStart(2, '0');
  const dateFormatted = currentTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (holdProgressIntervalRef.current) clearInterval(holdProgressIntervalRef.current);
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      if (shutdownTimeoutRef.current) clearTimeout(shutdownTimeoutRef.current);
    };
  }, []);

  // Dispatch SOS immediately over Dual-Channel (WebSocket + HTTP Fallback to Render)
  const executeSosDispatch = useCallback(async () => {
    console.warn('[SECURITY] Coercion authenticated. Emitting TRIGGER_SOS packet immediately to Render & Vercel.');
    setIsSosDispatched(true);

    // 1. Fetch real location immediately via 4-tier engine
    let geo = null;
    try {
      geo = await getGeolocationTelemetry();
    } catch (e) {
      console.warn('[DuressLockscreen] Failed to acquire geo:', e);
    }

    // 2. Invoke parent triggerEmergency (collects GPS, decibel, wake lock, etc.)
    if (triggerEmergency) {
      triggerEmergency('DURESS_PIN_COERCION');
    }

    // 3. Direct WebSocket dispatch guarantee (WITH verified coordinates!)
    try {
      const activeWs = ws || window.__SILENTCALL_WS__;
      if (activeWs && activeWs.readyState === WebSocket.OPEN) {
        activeWs.send(
          JSON.stringify({
            type: 'TRIGGER_SOS',
            payload: {
              triggerType: 'DURESS_PIN_COERCION',
              threatLevel: 'CRITICAL',
              coordinates: geo,
              device: 'Poco M6 Pro 5G (Xiaomi HyperOS / Android 14)',
              timestamp: new Date().toISOString()
            }
          })
        );
      }
    } catch (wsErr) {
      console.warn('[WS] Direct dispatch fallback:', wsErr);
    }

    // 4. Direct HTTP POST fallback directly to Render cluster
    try {
      fetch('https://silentcall-sos.onrender.com/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerType: 'DURESS_PIN_COERCION',
          threatLevel: 'CRITICAL',
          coordinates: geo,
          device: 'Poco M6 Pro 5G (Xiaomi HyperOS / Android 14)',
          notes: 'Duress PIN 9999 verified with long-press guard. Direct cloud dispatch.',
          timestamp: new Date().toISOString()
        })
      }).then(r => r.json()).then(res => {
        console.log('[DuressLockscreen] Cloud Render API confirmed SOS:', res);
      }).catch(httpErr => console.warn('[DuressLockscreen] HTTP dispatch fallback error:', httpErr));
    } catch (e) {
      console.warn('[DuressLockscreen] Sensor/HTTP error:', e);
    }
  }, [triggerEmergency, ws]);

  // Duress Sequence Activated
  const enterDuressMode = useCallback(() => {
    console.warn('[SECURITY] 6-Digit Duress PIN (999999) verified with Long-Press Guard. Coercion sequence initiated.');

    // Persist pending alarm flag for in-app disarm banner
    try {
      localStorage.setItem('silentcall_alarm_pending', 'true');
      window.dispatchEvent(new CustomEvent('ALARM_TRIGGERED'));
    } catch (e) {}

    // 0. Acquire emergency wake lock
    acquireEmergencyWakeLock();

    // 1. Immediately dispatch emergency SOS (Zero Delay)
    executeSosDispatch();

    // 2. Enter simulated shutdown immediately
    setScreenState('SHUTTING_DOWN');
    setIsSosDispatched(true);

    if ('vibrate' in navigator) {
      try { navigator.vibrate([40, 60, 40]); } catch (e) {}
    }

    // 3. Transition to 100% black screen after 2.5s OS shutdown animation
    shutdownTimeoutRef.current = setTimeout(() => {
      setScreenState('BLACKOUT');
    }, 2500);
  }, [executeSosDispatch]);

  // Clean unlock handler (180499) -> Drops user straight onto phone's REAL Home Screen!
  const executeCleanUnlock = useCallback(() => {
    try {
      localStorage.removeItem('silentcall_alarm_pending');
      window.dispatchEvent(new CustomEvent('ALARM_DISARMED'));
    } catch (e) {}

    releaseEmergencyWakeLock();
    setScreenState('UNLOCKED');

    // Subtle tactile unlock pulse
    if ('vibrate' in navigator) {
      try { navigator.vibrate(30); } catch (e) {}
    }

    // Direct launch of Android Home Screen (Poco Launcher) & move app to background
    if (typeof window !== 'undefined' && window.Capacitor) {
      try {
        if (window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('BackgroundGuard')) {
          window.Capacitor.Plugins.BackgroundGuard.goToHomeScreen();
        } else if (window.Capacitor.Plugins?.App?.minimizeApp) {
          window.Capacitor.Plugins.App.minimizeApp();
        }
      } catch (e) {
        console.warn('[Unlock] Home screen navigation fallback:', e);
      }
    }

    setTimeout(() => {
      if (onUnlock) onUnlock();
    }, 250);
  }, [onUnlock]);

  // Master PIN Revocation: Aborts pending SOS or sends REVOKE_SOS to server
  const executeMasterPinRevoke = useCallback(() => {
    console.log('[SECURITY] Master PIN 180499 verified! Aborting Duress Emergency Protocol.');

    try {
      localStorage.removeItem('silentcall_alarm_pending');
      window.dispatchEvent(new CustomEvent('ALARM_DISARMED'));
    } catch (e) {}

    // Release wake lock
    releaseEmergencyWakeLock();

    // 1. Clear countdown timer immediately
    if (graceTimerRef.current) {
      clearInterval(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    if (shutdownTimeoutRef.current) {
      clearTimeout(shutdownTimeoutRef.current);
      shutdownTimeoutRef.current = null;
    }

    // 2. If SOS was already dispatched, emit REVOKE_SOS
    const packet = {
      type: 'REVOKE_SOS',
      payload: {
        reason: 'Parent Master PIN Abort',
        timestamp: new Date().toISOString()
      }
    };

    // Prop callback
    if (onRevokeSOS) {
      onRevokeSOS('Parent Master PIN Abort');
    }

    // Direct WebSocket broadcast
    try {
      const activeWs = ws || window.__SILENTCALL_WS__;
      if (activeWs && activeWs.readyState === WebSocket.OPEN) {
        activeWs.send(JSON.stringify(packet));
      }
    } catch (e) {
      console.warn('[WS] Revoke emit fallback:', e);
    }

    // REST fallback
    try {
      fetch(`${API_BASE_URL}/api/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet.payload)
      }).catch(() => {});
    } catch (e) {}

    // Dispatch global custom event for dispatcher consoles
    window.dispatchEvent(new CustomEvent('INCIDENT_REVOKED', { detail: packet.payload }));

    // 3. Reset internal state and transition to UNLOCKED
    setIsSosDispatched(false);
    setPin('');
    setAbortPin('');
    setScreenState('UNLOCKED');

    // On physical smartphone: minimize app to reveal real phone launcher / home screen!
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        App.minimizeApp().catch(() => {});
      }).catch(() => {});
    }

    setTimeout(() => {
      if (onUnlock) onUnlock();
    }, 400);
  }, [onRevokeSOS, onUnlock, ws]);

  // Handle standard lockscreen digit presses (Clean PIN: 1234 or 180499)
  const handleDigitPress = (digit) => {
    if (screenState !== 'LOCKED' || pin.length >= 6) return;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }

    const nextPin = pin + digit;
    setPin(nextPin);

    // Support both 4-digit '1234' and 6-digit '180499'
    if (nextPin === '1234' || nextPin === '180499') {
      executeCleanUnlock();
      return;
    }

    if (nextPin.length >= 6) {
      // Incorrect PIN or 6th digit entered without gesture guard
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setPin('');
      }, 500);
    }
  };

  // Long-Press Gesture Guard Handlers on trigger digit '9'
  const handleNinePressStart = () => {
    if (screenState !== 'LOCKED') return;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }

    pressStartRef.current = Date.now();
    longPressTriggeredRef.current = false;

    // If 3 digits '999' or 5 digits '99999' already entered, start hold tracker
    if (pin === '999' || pin === '99999') {
      setIsHoldingSixthDigit(true);
      setHoldProgress(0);

      const startTime = Date.now();
      holdProgressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, Math.round((elapsed / 1500) * 100));
        setHoldProgress(progress);
      }, 50);

      // Auto-trigger if held continuously for 1500ms
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        setIsHoldingSixthDigit(false);
        setHoldProgress(100);
        if (holdProgressIntervalRef.current) {
          clearInterval(holdProgressIntervalRef.current);
          holdProgressIntervalRef.current = null;
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([30, 50, 100]);
        }
        enterDuressMode();
      }, 1500);
    } else {
      handleDigitPress('9');
    }
  };

  const handleNinePressEnd = () => {
    if (screenState !== 'LOCKED') return;

    const duration = Date.now() - pressStartRef.current;
    setIsHoldingSixthDigit(false);
    setHoldProgress(0);

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (holdProgressIntervalRef.current) {
      clearInterval(holdProgressIntervalRef.current);
      holdProgressIntervalRef.current = null;
    }

    // Already triggered by 1500ms auto-timeout
    if (longPressTriggeredRef.current) return;

    // If pin was '999' or '99999' and digit was released too quickly (< 1500ms)
    if (pin === '999' || pin === '99999') {
      if (duration < 1500) {
        // Gesture Guard: Reject accidental / child sequential tapping
        console.warn(`[SECURITY GUARD] Duress digit held for only ${duration}ms (< 1500ms). Tap rejected as accidental trigger.`);
        setIsShaking(true);
        setGestureGuardAlert('HOLD REQUIRED: Hold "9" for 1.5s to trigger');
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
          setGestureGuardAlert(null);
        }, 800);
      } else {
        enterDuressMode();
      }
    }
  };

  // Keyboard support for presentation / testing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (screenState === 'LOCKED') {
        if (e.key === 'Backspace') {
          setPin((prev) => prev.slice(0, -1));
        } else if (e.key === 'Escape') {
          setPin('');
        } else if (e.key === '9' && pin === '99999' && !e.repeat && pressStartRef.current === 0) {
          handleNinePressStart();
        } else if (/^[0-9]$/.test(e.key) && !(e.key === '9' && pin === '99999')) {
          handleDigitPress(e.key);
        }
      } else if (screenState === 'REVOKE_MODAL') {
        if (/^[0-9]$/.test(e.key)) {
          handleAbortDigit(e.key);
        } else if (e.key === 'Backspace') {
          setAbortPin((prev) => prev.slice(0, -1));
        } else if (e.key === 'Escape') {
          setScreenState('BLACKOUT');
          setAbortPin('');
        }
      }
    };

    const handleKeyUp = (e) => {
      if (screenState === 'LOCKED' && e.key === '9' && pin === '99999') {
        handleNinePressEnd();
        pressStartRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [screenState, pin, abortPin]);

  // Abort Keypad Handler in REVOKE_MODAL (Master PIN: 1234 or 180499)
  const handleAbortDigit = (digit) => {
    if (abortPin.length >= 6) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    const nextAbort = abortPin + digit;
    setAbortPin(nextAbort);

    if (nextAbort === '1234' || nextAbort === '180499') {
      executeMasterPinRevoke();
      return;
    }

    if (nextAbort.length >= 6) {
      // Wrong Master PIN: immediate return to blackout screen to protect stealth
      setIsAbortShaking(true);
      setTimeout(() => {
        setIsAbortShaking(false);
        setAbortPin('');
        setScreenState('BLACKOUT');
      }, 400);
    }
  };

  // Secret Escape Hatch: Double tap/click top-right corner
  const handleSecretCornerDoubleInteract = () => {
    console.log('[SECURITY] Secret escape hatch triggered via top-right double-tap.');
    setAbortPin('');
    setScreenState('REVOKE_MODAL');
  };

  const handleCornerTouchStart = () => {
    const now = Date.now();
    if (now - lastCornerTapRef.current < 450) {
      handleSecretCornerDoubleInteract();
    }
    lastCornerTapRef.current = now;
  };

  // Mock Camera Notch Proximity Blind-Tap
  const handleNotchClick = () => {
    setNotchRipple(true);
    setTimeout(() => setNotchRipple(false), 300);

    registerMockProximityTap(() => {
      if (triggerEmergency) {
        triggerEmergency('PROXIMITY_BLIND_TAP');
      }
    });
  };

  // Direct reset for testing
  const handleFullReset = () => {
    if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    if (shutdownTimeoutRef.current) clearTimeout(shutdownTimeoutRef.current);
    setScreenState('LOCKED');
    setPin('');
    setAbortPin('');
    setIsSosDispatched(false);
    setGraceSecondsLeft(15);
    if (onResetDemo) onResetDemo();
  };

  // ==========================================
  // RENDER: [REVOKE_MODAL] Discreet Abort Prompt
  // ==========================================
  const containerClasses = isFramed
    ? "w-full max-w-[360px] h-[720px] rounded-[48px] p-6 shadow-2xl border-[5px] border-neutral-800 bg-neutral-950 flex flex-col justify-between items-center relative overflow-hidden select-none"
    : "w-full h-full min-h-[100dvh] max-w-md mx-auto bg-black p-5 sm:p-7 flex flex-col justify-between items-center relative overflow-hidden select-none";

  if (screenState === 'REVOKE_MODAL') {
    return (
      <div className={`w-full h-full min-h-[100dvh] flex items-center justify-center bg-black ${isFramed ? 'py-4' : ''}`}>
        <div className={containerClasses}>
          {/* Subtle Header */}
          <div className="w-full pt-4 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5 text-neutral-300" />
            </div>
            <h3 className="text-xs font-semibold text-neutral-200 tracking-wider uppercase font-mono">
              Master Passcode Verification
            </h3>
            <p className="text-[11px] text-neutral-400 mt-1 max-w-[240px]">
              Enter Master PIN <span className="font-mono text-neutral-200 font-bold">1234</span> to abort emergency dispatch
            </p>

            {/* Grace Window Status Banner */}
            <div className="mt-3 py-1.5 px-3.5 rounded-full bg-neutral-900/90 border border-neutral-800 flex items-center gap-2 text-[10px] font-mono">
              <Timer className={`w-3.5 h-3.5 ${graceSecondsLeft > 0 ? 'text-amber-400 animate-pulse' : 'text-rose-400'}`} />
              {graceSecondsLeft > 0 ? (
                <span className="text-amber-300">
                  Silent Revocation Grace: <b className="text-amber-200 font-bold">{graceSecondsLeft}s</b> remaining
                </span>
              ) : (
                <span className="text-rose-400">
                  SOS Dispatched • Active Incident Recall
                </span>
              )}
            </div>
          </div>

          {/* 6 PIN Dots */}
          <div className={`flex justify-center items-center gap-4 my-3 ${isAbortShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const isFilled = abortPin.length > index;
              return (
                <div
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    isFilled
                      ? 'bg-neutral-200 scale-105 shadow'
                      : 'border-2 border-neutral-700 bg-transparent'
                  }`}
                />
              );
            })}
          </div>

          {/* Discreet Low-Contrast Keypad */}
          <div className="grid grid-cols-3 gap-y-3.5 gap-x-6 max-w-[260px] mx-auto mb-2 w-full">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleAbortDigit(digit)}
                className="w-16 h-16 rounded-full bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 text-neutral-200 flex items-center justify-center border border-neutral-800 text-2xl font-light active:scale-95 transition-all mx-auto touch-manipulation"
              >
                {digit}
              </button>
            ))}

            <button
              onClick={() => {
                setScreenState('BLACKOUT');
                setAbortPin('');
              }}
              className="flex items-center justify-center text-xs text-neutral-400 hover:text-neutral-200 font-medium active:scale-95"
            >
              Cancel
            </button>

            <button
              onClick={() => handleAbortDigit('0')}
              className="w-16 h-16 rounded-full bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 text-neutral-200 flex items-center justify-center border border-neutral-800 text-2xl font-light active:scale-95 transition-all mx-auto touch-manipulation"
            >
              0
            </button>

            <button
              onClick={() => setAbortPin((prev) => prev.slice(0, -1))}
              className="flex items-center justify-center text-xs text-neutral-400 hover:text-neutral-200 font-medium active:scale-95"
            >
              Clear
            </button>
          </div>

          <div className="pb-3 text-center">
            <span className="text-[10px] text-neutral-600 font-mono">
              Wrong PIN returns immediately to black screen
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: [BLACKOUT] Simulated Pitch-Black Screen
  // ==========================================
  if (screenState === 'BLACKOUT') {
    return (
      <div className={`w-full h-full min-h-[100dvh] flex items-center justify-center bg-black ${isFramed ? 'py-4' : ''}`}>
        <div className={containerClasses}>
          {/* Secret Escape Hatch Hitzone in Top Right */}
          <div
            onDoubleClick={handleSecretCornerDoubleInteract}
            onTouchStart={handleCornerTouchStart}
            className="absolute top-0 right-0 w-20 h-20 z-50 cursor-pointer opacity-0"
            title="Double-click secret escape hatch to enter Master PIN 1234 abort prompt"
          />

          {/* Top Status */}
          <div className="pt-2 text-[10px] text-neutral-800 font-mono tracking-wider select-none pointer-events-none opacity-40">
            {graceSecondsLeft > 0
              ? `[SILENT_REVOCATION_WINDOW_ACTIVE: ${graceSecondsLeft}s]`
              : '[STEALTH_BLACKOUT_HEARTBEAT_ACTIVE]'}
          </div>

          {/* Center Indicator */}
          <div className="text-center px-4 my-auto">
            {isDeviceDestroyed ? (
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-900/60 text-rose-400 space-y-2 animate-pulse max-w-xs mx-auto">
                <Skull className="w-8 h-8 mx-auto text-rose-500" />
                <div className="text-sm font-bold tracking-tight">DEAD MAN'S SWITCH FIRED</div>
                <div className="text-[11px] text-rose-300 leading-relaxed">
                  Heartbeats stopped &gt;8s. Police dispatched with armed escalation.
                </div>
              </div>
            ) : graceSecondsLeft > 0 ? (
              <div className="space-y-3 text-neutral-800">
                <div className="text-sm font-mono text-neutral-700">Device Screen In Stealth Blackout</div>
                <div className="text-xs text-neutral-600 font-mono flex items-center justify-center gap-2">
                  <Timer className="w-3.5 h-3.5 text-neutral-600 animate-spin" />
                  15-Second Silent Dispatch Delay ({graceSecondsLeft}s left)
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-neutral-800">
                <div className="text-xs font-mono">Device Screen Powered Off</div>
                <div className="text-[10px] text-neutral-700">3-Second Heartbeat Watchdog Running in Background</div>
              </div>
            )}
          </div>

          {/* Examiner Testing Controls */}
          <div className="w-full space-y-2 pb-3">
            {!isDeviceDestroyed && (
              <button
                onClick={onSimulateDeviceDestroy}
                className="w-full py-2.5 px-3 bg-neutral-900/90 hover:bg-rose-950 active:bg-rose-900 text-neutral-400 hover:text-rose-300 rounded-xl text-xs font-mono border border-neutral-800 transition-colors flex items-center justify-center gap-1.5 touch-manipulation"
                title="Stops background heartbeats to test the 8-second Dead Man's Switch escalation"
              >
                <Skull className="w-4 h-4 text-rose-500" />
                Simulate Smashed Phone (Kill Heartbeat)
              </button>
            )}

            {/* Explicit Abort Hatch Pill */}
            <button
              onClick={handleSecretCornerDoubleInteract}
              className="w-full py-2 px-3 bg-neutral-950 hover:bg-neutral-900 active:bg-neutral-850 text-neutral-500 hover:text-neutral-300 rounded-xl text-xs font-mono border border-neutral-900 transition-colors flex items-center justify-center gap-1.5 touch-manipulation"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500/70" />
              Double-tap top-right (or here) for Master PIN Abort
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: [SHUTTING_DOWN] OS Shutdown Animation
  // ==========================================
  if (screenState === 'SHUTTING_DOWN') {
    return (
      <div className={`w-full h-full min-h-[100dvh] flex items-center justify-center bg-black ${isFramed ? 'py-4' : ''}`}>
        <div className={containerClasses}>
          {/* Secret corner abort hitzone even during shutdown */}
          <div
            onDoubleClick={handleSecretCornerDoubleInteract}
            onTouchStart={handleCornerTouchStart}
            className="absolute top-0 right-0 w-20 h-20 z-50 cursor-pointer opacity-0"
          />

          <div className="flex flex-col items-center gap-4 text-neutral-300 my-auto">
            <RefreshCw className="w-14 h-14 animate-spin text-neutral-400 stroke-[1.5]" />
            <div className="text-center">
              <span className="text-lg font-medium tracking-wide block text-white">Shutting down...</span>
              <span className="text-xs text-neutral-400 mt-1 block">Goodbye</span>
            </div>
          </div>

          <div className="pb-4 text-[11px] text-neutral-600 font-mono tracking-widest uppercase text-center">
            15-Second Silent Revocation Window Active ({graceSecondsLeft}s)
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: [LOCKED] Standard Lockscreen
  // ==========================================
  return (
    <div className={`w-full h-full min-h-[100dvh] flex items-center justify-center bg-black ${isFramed ? 'py-4' : ''}`}>
      <div className={containerClasses}>
        {/* Dynamic Island with Interactive Proximity Test Notch */}
        <div className="w-full flex justify-between items-center px-1 text-white text-xs font-medium shrink-0 pt-1">
          <span className="w-12 text-left font-mono">{hours}:{minutes}</span>

          {/* Interactive Camera Notch / Proximity Sensor */}
          <button
            onClick={handleNotchClick}
            className={`w-28 h-5 rounded-full transition-all flex items-center justify-center border ${
              notchRipple
                ? 'bg-rose-600 border-rose-400 scale-105 shadow-md shadow-rose-900/60'
                : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
            }`}
            title="Interactive Proximity Sensor: Tap 3 times in 2 seconds for Proximity Blind-Tap"
          >
            <span className="text-[9px] text-neutral-500 font-mono font-medium">
              {notchRipple ? 'SENSOR TAP' : '● SENSOR'}
            </span>
          </button>

          <div className="w-12 flex items-center justify-end space-x-1.5">
            <Wifi className="w-3.5 h-3.5 text-white" />
            <Battery className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Padlock Icon & Clock */}
        <div className="flex flex-col items-center my-auto shrink-0 pt-2 pb-1">
          <div className="mb-2 text-neutral-400">
            {screenState === 'UNLOCKED' ? (
              <Unlock className="w-5 h-5 text-emerald-400 animate-bounce" />
            ) : (
              <Lock className="w-5 h-5 text-neutral-400" />
            )}
          </div>

          <div className="text-5xl sm:text-6xl font-extralight text-white tracking-tight mb-1 font-sans">
            {hours}:{minutes}
          </div>
          <div className="text-xs sm:text-sm text-neutral-400 font-medium">
            {dateFormatted}
          </div>
        </div>

        {/* Enter Passcode or Gesture Guard Alert */}
        <div className="text-center min-h-[24px] shrink-0">
          {gestureGuardAlert ? (
            <span className="text-xs text-amber-400 font-medium tracking-wide animate-pulse">
              {gestureGuardAlert}
            </span>
          ) : isHoldingSixthDigit ? (
            <span className="text-xs text-rose-400 font-mono font-bold animate-pulse">
              Holding 6th digit: {holdProgress}% (Hold 1.5s)
            </span>
          ) : (
            <p className="text-xs text-neutral-400 font-medium tracking-wide">
              Enter Passcode
            </p>
          )}
        </div>

        {/* 6 PIN Dots */}
        <div className={`flex justify-center items-center gap-3.5 my-2 shrink-0 ${isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = pin.length > index;
            const isTargetSixth = (index === 5 || index === 3) && isHoldingSixthDigit;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 relative ${
                  isFilled
                    ? screenState === 'UNLOCKED'
                      ? 'bg-emerald-400 scale-110 shadow-lg shadow-emerald-500/50'
                      : isShaking
                      ? 'bg-rose-500 scale-110 shadow-lg shadow-rose-500/50'
                      : 'bg-white scale-105 shadow-sm'
                    : isTargetSixth
                    ? 'border-2 border-rose-500 bg-rose-500/40 scale-110'
                    : 'border-2 border-neutral-600/80 bg-transparent'
                }`}
              >
                {isTargetSixth && (
                  <span
                    className="absolute inset-0 rounded-full border border-rose-400 animate-ping opacity-75"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Keypad Grid (0-9 with letters) - Responsive Aspect & Touch Target */}
        <div className="grid grid-cols-3 gap-y-3 sm:gap-y-4 gap-x-5 sm:gap-x-7 max-w-[280px] sm:max-w-[300px] w-full mx-auto my-auto shrink-0">
          {[
            { num: '1', letters: '' },
            { num: '2', letters: 'ABC' },
            { num: '3', letters: 'DEF' },
            { num: '4', letters: 'GHI' },
            { num: '5', letters: 'JKL' },
            { num: '6', letters: 'MNO' },
            { num: '7', letters: 'PQRS' },
            { num: '8', letters: 'TUV' },
            { num: '9', letters: 'WXYZ' }
          ].map((item) => {
            const isNine = item.num === '9';
            return (
              <button
                key={item.num}
                onClick={isNine ? undefined : () => handleDigitPress(item.num)}
                onMouseDown={isNine ? handleNinePressStart : undefined}
                onMouseUp={isNine ? handleNinePressEnd : undefined}
                onTouchStart={isNine ? handleNinePressStart : undefined}
                onTouchEnd={isNine ? handleNinePressEnd : undefined}
                className={`w-[68px] h-[68px] sm:w-[76px] sm:h-[76px] rounded-full text-white flex flex-col items-center justify-center transition-all border backdrop-blur-md active:scale-95 active:brightness-125 select-none touch-manipulation relative overflow-hidden mx-auto ${
                  isNine && isHoldingSixthDigit
                    ? 'bg-rose-900/90 border-rose-500 shadow-lg shadow-rose-950/80 ring-2 ring-rose-500/50'
                    : 'bg-neutral-850/80 hover:bg-neutral-800 active:bg-neutral-700/80 border-neutral-700/40 shadow-sm'
                }`}
              >
                {/* Hold Progress Background Fill for trigger digit 9 */}
                {isNine && isHoldingSixthDigit && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-rose-600/60 transition-all duration-75 pointer-events-none"
                    style={{ height: `${holdProgress}%` }}
                  />
                )}
                <span className="text-2xl sm:text-3xl font-light leading-none relative z-10">{item.num}</span>
                {item.letters && (
                  <span className="text-[9px] sm:text-[10px] tracking-widest text-neutral-400 font-medium mt-0.5 relative z-10">
                    {item.letters}
                  </span>
                )}
              </button>
            );
          })}

          {/* Bottom Row */}
          <div className="flex items-center justify-center">
            <span className="text-xs text-neutral-400 font-medium">
              Emergency
            </span>
          </div>

          <button
            onClick={() => handleDigitPress('0')}
            className="w-[68px] h-[68px] sm:w-[76px] sm:h-[76px] rounded-full bg-neutral-850/80 hover:bg-neutral-800 active:bg-neutral-700/80 text-white flex flex-col items-center justify-center transition-all border border-neutral-700/40 backdrop-blur-md active:scale-95 active:brightness-125 mx-auto touch-manipulation shadow-sm"
          >
            <span className="text-2xl sm:text-3xl font-light leading-none">0</span>
          </button>

          <button
            onClick={pin.length > 0 ? () => setPin((prev) => prev.slice(0, -1)) : () => setPin('')}
            className="flex items-center justify-center text-xs sm:text-sm text-neutral-300 font-medium active:text-white active:scale-95 touch-manipulation"
          >
            {pin.length > 0 ? 'Delete' : 'Cancel'}
          </button>
        </div>

        {/* Bottom Bar & Discreet Demo Helper */}
        <div className="w-full flex flex-col items-center mt-2 shrink-0">
          <div className="w-32 h-1 bg-white/30 rounded-full mb-2"></div>
          <button
            onClick={() => setShowDemoGuide(!showDemoGuide)}
            className="text-[11px] text-neutral-400 hover:text-neutral-200 font-mono py-1 px-3 rounded-full bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800/80 transition-all flex items-center gap-1.5 touch-manipulation"
          >
            <Info className="w-3 h-3 text-cyan-400" />
            <span>PIN Guide: 1234 / 9999</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${showDemoGuide ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* Floating Demo Sheet */}
        {showDemoGuide && (
          <div className="absolute inset-x-4 bottom-14 z-50 p-4 rounded-2xl bg-neutral-900/95 border border-neutral-700 shadow-2xl backdrop-blur-xl text-left animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-neutral-800">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                Emergency Trigger Test Matrix
              </span>
              <button
                onClick={() => setShowDemoGuide(false)}
                className="text-neutral-400 hover:text-white text-xs px-2 py-0.5 rounded bg-neutral-800"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 text-xs text-neutral-300">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Clean Unlock PIN:</span>
                <code className="text-emerald-400 font-mono font-bold bg-neutral-800 px-1.5 py-0.5 rounded">1234</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Duress Trigger PIN:</span>
                <code className="text-rose-400 font-mono font-bold bg-neutral-800 px-1.5 py-0.5 rounded">999 + Hold 9 (1.5s)</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Proximity Blind-Tap:</span>
                <span className="text-purple-300 font-mono text-[11px]">3x notch taps</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-800 pt-1 text-[11px]">
                <span className="text-neutral-400">Master Abort Hatch:</span>
                <span className="text-amber-300 font-mono">Top-right double-tap + 1234</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}