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
  ChevronRight
} from 'lucide-react';
import { registerMockProximityTap } from '../utils/sensorTriggers';
import { acquireEmergencyWakeLock, releaseEmergencyWakeLock } from '../utils/wakeLockManager';

const defaultHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_WS_URL ? import.meta.env.VITE_WS_URL.replace(/^ws(s?):/, 'http$1:') : `http://${defaultHost}:5000`);

/**
 * DuressLockscreen
 * 
 * Multi-Tier False-Alarm Mitigation Protocol:
 * 1. State Machine: LOCKED -> SHUTTING_DOWN -> BLACKOUT -> REVOKE_MODAL -> UNLOCKED
 * 2. Long-Press Gesture Guard: Typing '9-9-9' requires holding the 4th digit '9' >= 1500ms.
 *    Quick taps (< 1500ms) by toddlers or pocket friction are rejected.
 * 3. 15-Second Silent Revocation Window: Simulated OS shutdown & blackout trigger immediately,
 *    holding network SOS dispatch in pending state for 15s.
 * 4. Hidden Escape / Abort Hatch: Double-clicking top-right corner on blackout screen opens
 *    a discreet Master PIN ('1234') prompt. Entering '1234' cancels pending SOS, emits
 *    REVOKE_SOS if already dispatched, and smoothly restores unlocked state.
 */
export default function DuressLockscreen({
  onUnlock,
  triggerEmergency,
  onRevokeSOS,
  onSimulateDeviceDestroy,
  onResetDemo,
  isDeviceDestroyed = false,
  ws = null
}) {
  // State Machine: 'LOCKED' | 'SHUTTING_DOWN' | 'BLACKOUT' | 'REVOKE_MODAL' | 'UNLOCKED'
  const [screenState, setScreenState] = useState('LOCKED');

  // Lockscreen Pin State
  const [pin, setPin] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [gestureGuardAlert, setGestureGuardAlert] = useState(null);

  // Holding status for 4th digit '9'
  const [isHoldingFourthDigit, setIsHoldingFourthDigit] = useState(false);
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

  // Dispatch SOS over WebSocket and/or callback
  const executeSosDispatch = useCallback(() => {
    console.warn('[SECURITY] 15-second revocation grace expired. Emitting TRIGGER_SOS packet.');
    setIsSosDispatched(true);

    if (triggerEmergency) {
      triggerEmergency('DURESS_PIN_COERCION');
    }

    // Direct WebSocket dispatch if available
    try {
      const activeWs = ws || window.__SILENTCALL_WS__;
      if (activeWs && activeWs.readyState === WebSocket.OPEN) {
        activeWs.send(
          JSON.stringify({
            type: 'TRIGGER_SOS',
            payload: {
              triggerType: 'DURESS_PIN_COERCION',
              threatLevel: 'CRITICAL',
              timestamp: new Date().toISOString()
            }
          })
        );
      }
    } catch (err) {
      console.warn('[WS] Direct dispatch fallback:', err);
    }
  }, [triggerEmergency, ws]);

  // Duress Sequence Activated
  const enterDuressMode = useCallback(() => {
    console.warn('[SECURITY] Duress PIN verified with Long-Press Guard. Coercion sequence initiated.');

    // 0. Acquire emergency wake lock & start silent audio keep-alive loop
    acquireEmergencyWakeLock();

    // 1. Enter simulated shutdown immediately
    setScreenState('SHUTTING_DOWN');
    setGraceSecondsLeft(15);
    setIsSosDispatched(false);

    if ('vibrate' in navigator) {
      try { navigator.vibrate([40, 60, 40]); } catch (e) {}
    }

    // 2. Transition to 100% black screen after 2.5s OS shutdown animation
    shutdownTimeoutRef.current = setTimeout(() => {
      setScreenState('BLACKOUT');
    }, 2500);

    // 3. Start 15-Second Silent Revocation Window countdown
    if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    graceTimerRef.current = setInterval(() => {
      setGraceSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(graceTimerRef.current);
          graceTimerRef.current = null;
          executeSosDispatch();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [executeSosDispatch]);

  // Clean unlock handler (1234)
  const executeCleanUnlock = useCallback(() => {
    releaseEmergencyWakeLock();
    setScreenState('UNLOCKED');
    setTimeout(() => {
      if (onUnlock) onUnlock();
    }, 350);
  }, [onUnlock]);

  // Master PIN Revocation: Aborts pending SOS or sends REVOKE_SOS to server
  const executeMasterPinRevoke = useCallback(() => {
    console.log('[SECURITY] Master PIN 1234 verified! Aborting Duress Emergency Protocol.');

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

    setTimeout(() => {
      if (onUnlock) onUnlock();
    }, 400);
  }, [onRevokeSOS, onUnlock, ws]);

  // Handle standard lockscreen digit presses
  const handleDigitPress = (digit) => {
    if (screenState !== 'LOCKED' || pin.length >= 4) return;

    // If typing digits 1-3, or a digit other than 4th '9'
    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      if (nextPin === '1234') {
        executeCleanUnlock();
      } else {
        // If 4th digit entered without gesture guard (e.g. not 9999 or tapped quickly)
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
        }, 500);
      }
    }
  };

  // Long-Press Gesture Guard Handlers on Digit '9'
  const handleNinePressStart = () => {
    if (screenState !== 'LOCKED') return;

    pressStartRef.current = Date.now();
    longPressTriggeredRef.current = false;

    // If 3 digits '999' already entered, start hold tracker for 4th digit
    if (pin === '999') {
      setIsHoldingFourthDigit(true);
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
        setIsHoldingFourthDigit(false);
        setHoldProgress(100);
        if (holdProgressIntervalRef.current) {
          clearInterval(holdProgressIntervalRef.current);
          holdProgressIntervalRef.current = null;
        }
        enterDuressMode();
      }, 1500);
    }
  };

  const handleNinePressEnd = () => {
    if (screenState !== 'LOCKED') return;

    const duration = Date.now() - pressStartRef.current;
    setIsHoldingFourthDigit(false);
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

    // If pin is '999' and 4th digit was released too quickly (< 1500ms)
    if (pin === '999') {
      if (duration < 1500) {
        // Gesture Guard: Reject accidental / child sequential tapping
        console.warn(`[SECURITY GUARD] Duress 4th digit held for only ${duration}ms (< 1500ms). Tap rejected as child/accidental trigger.`);
        setIsShaking(true);
        setGestureGuardAlert('TAP REJECTED: Hold 4th "9" for 1.5s');
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
          setGestureGuardAlert(null);
        }, 800);
      } else {
        enterDuressMode();
      }
    } else {
      // Normal digit press for 1st, 2nd, or 3rd '9'
      handleDigitPress('9');
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
        } else if (e.key === '9' && pin === '999' && !e.repeat && pressStartRef.current === 0) {
          handleNinePressStart();
        } else if (/^[0-9]$/.test(e.key) && !(e.key === '9' && pin === '999')) {
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
      if (screenState === 'LOCKED' && e.key === '9' && pin === '999') {
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

  // Abort Keypad Handler in REVOKE_MODAL
  const handleAbortDigit = (digit) => {
    if (abortPin.length >= 4) return;
    const nextAbort = abortPin + digit;
    setAbortPin(nextAbort);

    if (nextAbort.length === 4) {
      if (nextAbort === '1234') {
        executeMasterPinRevoke();
      } else {
        // Wrong Master PIN: immediate return to blackout screen to protect stealth
        setIsAbortShaking(true);
        setTimeout(() => {
          setIsAbortShaking(false);
          setAbortPin('');
          setScreenState('BLACKOUT');
        }, 400);
      }
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
  if (screenState === 'REVOKE_MODAL') {
    return (
      <div className="w-full max-w-sm mx-auto select-none">
        <div className="w-full h-[620px] bg-neutral-950 rounded-[46px] p-6 shadow-2xl border-4 border-neutral-900 relative overflow-hidden flex flex-col items-center justify-between">
          
          {/* Subtle Header */}
          <div className="w-full pt-4 flex flex-col items-center text-center">
            <div className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-3">
              <ShieldCheck className="w-4 h-4 text-neutral-400" />
            </div>
            <h3 className="text-xs font-semibold text-neutral-300 tracking-wider uppercase font-mono">
              Master Passcode Verification
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1 max-w-[220px]">
              Enter Master PIN <span className="font-mono text-neutral-400">1234</span> to abort emergency dispatch
            </p>

            {/* Grace Window Status Banner */}
            <div className="mt-3 py-1 px-3 rounded-full bg-neutral-900/90 border border-neutral-800 flex items-center gap-2 text-[10px] font-mono">
              <Timer className={`w-3 h-3 ${graceSecondsLeft > 0 ? 'text-amber-400 animate-pulse' : 'text-rose-400'}`} />
              {graceSecondsLeft > 0 ? (
                <span className="text-amber-300">
                  Silent Revocation Grace: <b className="text-amber-200">{graceSecondsLeft}s</b> remaining
                </span>
              ) : (
                <span className="text-rose-400">
                  SOS Dispatched • Active Incident Recall
                </span>
              )}
            </div>
          </div>

          {/* 4 PIN Dots */}
          <div className={`flex justify-center items-center gap-4 my-2 ${isAbortShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = abortPin.length > index;
              return (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-150 ${
                    isFilled
                      ? 'bg-neutral-300 scale-105'
                      : 'border-2 border-neutral-700 bg-transparent'
                  }`}
                />
              );
            })}
          </div>

          {/* Discreet Low-Contrast Keypad */}
          <div className="grid grid-cols-3 gap-y-3 gap-x-5 max-w-[240px] mx-auto mb-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleAbortDigit(digit)}
                className="w-14 h-14 rounded-full bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 text-neutral-300 flex items-center justify-center border border-neutral-800 text-xl font-light active:scale-95 transition-all"
              >
                {digit}
              </button>
            ))}

            <button
              onClick={() => {
                setScreenState('BLACKOUT');
                setAbortPin('');
              }}
              className="flex items-center justify-center text-[11px] text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>

            <button
              onClick={() => handleAbortDigit('0')}
              className="w-14 h-14 rounded-full bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 text-neutral-300 flex items-center justify-center border border-neutral-800 text-xl font-light active:scale-95 transition-all mx-auto"
            >
              0
            </button>

            <button
              onClick={() => setAbortPin((prev) => prev.slice(0, -1))}
              className="flex items-center justify-center text-[11px] text-neutral-500 hover:text-neutral-300"
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
      <div className="w-full max-w-sm mx-auto select-none">
        <div className="w-full h-[620px] bg-black rounded-[46px] p-6 shadow-2xl border-4 border-neutral-900 relative overflow-hidden flex flex-col items-center justify-between">
          
          {/* Secret Escape Hatch Hitzone in Top Right */}
          <div
            onDoubleClick={handleSecretCornerDoubleInteract}
            onTouchStart={handleCornerTouchStart}
            className="absolute top-2 right-2 w-14 h-14 z-50 cursor-pointer opacity-0"
            title="Double-click secret escape hatch to enter Master PIN 1234 abort prompt"
          />

          {/* Top Status */}
          <div className="pt-2 text-[10px] text-neutral-800 font-mono tracking-wider select-none pointer-events-none opacity-40">
            {graceSecondsLeft > 0
              ? `[SILENT_REVOCATION_WINDOW_ACTIVE: ${graceSecondsLeft}s]`
              : '[STEALTH_BLACKOUT_HEARTBEAT_ACTIVE]'}
          </div>

          {/* Center Indicator */}
          <div className="text-center px-4">
            {isDeviceDestroyed ? (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-400 space-y-1 animate-pulse">
                <Skull className="w-6 h-6 mx-auto text-rose-500" />
                <div className="text-xs font-bold tracking-tight">DEAD MAN'S SWITCH FIRED</div>
                <div className="text-[10px] text-rose-300">Heartbeats stopped &gt;8s. Police dispatched with armed escalation.</div>
              </div>
            ) : graceSecondsLeft > 0 ? (
              <div className="space-y-2 text-neutral-800">
                <div className="text-xs font-mono text-neutral-700">Device Screen In Stealth Blackout</div>
                <div className="text-[10px] text-neutral-600 font-mono flex items-center justify-center gap-1.5">
                  <Timer className="w-3 h-3 text-neutral-600 animate-spin" />
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
          <div className="w-full space-y-2 pb-2">
            {!isDeviceDestroyed && (
              <button
                onClick={onSimulateDeviceDestroy}
                className="w-full py-2 px-3 bg-neutral-900/90 hover:bg-rose-950 text-neutral-400 hover:text-rose-300 rounded-xl text-xs font-mono border border-neutral-800 transition-colors flex items-center justify-center gap-1.5"
                title="Stops background heartbeats to test the 8-second Dead Man's Switch escalation"
              >
                <Skull className="w-3.5 h-3.5 text-rose-500" />
                Simulate Smashed Phone (Kill Heartbeat)
              </button>
            )}

            {/* Explicit Abort Hatch Pill */}
            <button
              onClick={handleSecretCornerDoubleInteract}
              className="w-full py-1.5 px-3 bg-neutral-950 hover:bg-neutral-900 text-neutral-500 hover:text-neutral-300 rounded-xl text-[11px] font-mono border border-neutral-900 transition-colors flex items-center justify-center gap-1"
            >
              <ShieldCheck className="w-3 h-3 text-amber-500/70" />
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
      <div className="w-full max-w-sm mx-auto select-none">
        <div className="w-full h-[620px] bg-black rounded-[46px] p-6 shadow-2xl border-4 border-neutral-900 relative overflow-hidden flex flex-col items-center justify-center">
          
          {/* Secret corner abort hitzone even during shutdown */}
          <div
            onDoubleClick={handleSecretCornerDoubleInteract}
            onTouchStart={handleCornerTouchStart}
            className="absolute top-2 right-2 w-14 h-14 z-50 cursor-pointer opacity-0"
          />

          <div className="flex flex-col items-center gap-4 text-neutral-300">
            <RefreshCw className="w-12 h-12 animate-spin text-neutral-400 stroke-[1.5]" />
            <div className="text-center">
              <span className="text-base font-medium tracking-wide block text-white">Shutting down...</span>
              <span className="text-xs text-neutral-400 mt-1 block">Goodbye</span>
            </div>
          </div>

          <div className="absolute bottom-6 text-[10px] text-neutral-600 font-mono tracking-widest uppercase">
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
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto select-none">
      <div className="w-full bg-gradient-to-b from-neutral-900 via-neutral-950 to-black rounded-[46px] p-6 shadow-2xl border-4 border-neutral-800 relative overflow-hidden backdrop-blur-2xl">
        
        {/* Dynamic Island with Interactive Proximity Test Notch */}
        <div className="flex justify-between items-center mb-6 px-2 text-white text-xs font-medium">
          <span>{hours}:{minutes}</span>

          {/* Interactive Camera Notch / Proximity Sensor */}
          <button
            onClick={handleNotchClick}
            className={`w-28 h-5 rounded-full mx-auto -mt-2 transition-all flex items-center justify-center border ${
              notchRipple
                ? 'bg-rose-600 border-rose-400 scale-105 shadow-md shadow-rose-900/60'
                : 'bg-black border-neutral-800 hover:border-neutral-700'
            }`}
            title="Interactive Proximity Sensor: Tap 3 times in 2 seconds for Proximity Blind-Tap"
          >
            <span className="text-[9px] text-neutral-600 font-mono">
              {notchRipple ? 'SENSOR' : ''}
            </span>
          </button>

          <div className="flex items-center space-x-1.5">
            <Wifi className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] tracking-tight">5G</span>
            <Battery className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Padlock Icon & Clock */}
        <div className="flex flex-col items-center mb-4">
          <div className="mb-2 text-neutral-400">
            {screenState === 'UNLOCKED' ? (
              <Unlock className="w-5 h-5 text-emerald-400 animate-bounce" />
            ) : (
              <Lock className="w-5 h-5 text-neutral-300" />
            )}
          </div>

          <div className="text-5xl font-light text-white tracking-tight mb-1 font-sans">
            {hours}:{minutes}
          </div>
          <div className="text-xs text-neutral-400 font-medium">
            {dateFormatted}
          </div>
        </div>

        {/* Enter Passcode or Gesture Guard Alert */}
        <div className="text-center mb-3 min-h-[22px]">
          {gestureGuardAlert ? (
            <span className="text-[11px] text-amber-400 font-medium tracking-wide animate-pulse">
              {gestureGuardAlert}
            </span>
          ) : isHoldingFourthDigit ? (
            <span className="text-[11px] text-rose-400 font-mono animate-pulse">
              Holding 4th digit: {holdProgress}% (Hold 1.5s)
            </span>
          ) : (
            <p className="text-xs text-neutral-300 font-medium tracking-wide">
              Enter Passcode
            </p>
          )}
        </div>

        {/* 4 PIN Dots */}
        <div className={`flex justify-center items-center gap-4 mb-6 ${isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            const isTargetFourth = index === 3 && isHoldingFourthDigit;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 relative ${
                  isFilled
                    ? screenState === 'UNLOCKED'
                      ? 'bg-emerald-400 scale-110 shadow-lg shadow-emerald-500/50'
                      : isShaking
                      ? 'bg-rose-500 scale-110 shadow-lg shadow-rose-500/50'
                      : 'bg-white scale-105'
                    : isTargetFourth
                    ? 'border-2 border-rose-500 bg-rose-500/40 scale-110'
                    : 'border-2 border-neutral-500/80 bg-transparent'
                }`}
              >
                {isTargetFourth && (
                  <span
                    className="absolute inset-0 rounded-full border border-rose-400 animate-ping opacity-75"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Keypad Grid (0-9 with letters) */}
        <div className="grid grid-cols-3 gap-y-3 gap-x-5 max-w-[260px] mx-auto mb-4">
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
                className={`w-16 h-16 rounded-full text-white flex flex-col items-center justify-center transition-all border backdrop-blur-md active:scale-95 relative overflow-hidden ${
                  isNine && isHoldingFourthDigit
                    ? 'bg-rose-900/80 border-rose-500 shadow-lg shadow-rose-950/80'
                    : 'bg-neutral-800/60 active:bg-neutral-600/60 border-neutral-700/30'
                }`}
              >
                {/* Hold Progress Background Fill for 4th digit 9 */}
                {isNine && isHoldingFourthDigit && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-rose-600/40 transition-all duration-75 pointer-events-none"
                    style={{ height: `${holdProgress}%` }}
                  />
                )}
                <span className="text-2xl font-light leading-none relative z-10">{item.num}</span>
                {item.letters && (
                  <span className="text-[9px] tracking-widest text-neutral-400 font-semibold mt-0.5 relative z-10">
                    {item.letters}
                  </span>
                )}
              </button>
            );
          })}

          {/* Bottom Row */}
          <div className="flex items-center justify-center">
            <span className="text-[11px] text-neutral-400 font-medium">
              Emergency
            </span>
          </div>

          <button
            onClick={() => handleDigitPress('0')}
            className="w-16 h-16 rounded-full bg-neutral-800/60 active:bg-neutral-600/60 text-white flex flex-col items-center justify-center transition-all border border-neutral-700/30 backdrop-blur-md active:scale-95 mx-auto"
          >
            <span className="text-2xl font-light leading-none">0</span>
          </button>

          <button
            onClick={pin.length > 0 ? () => setPin((prev) => prev.slice(0, -1)) : () => setPin('')}
            className="flex items-center justify-center text-xs text-neutral-300 font-medium active:text-white"
          >
            {pin.length > 0 ? 'Delete' : 'Cancel'}
          </button>
        </div>

        {/* iOS Home Indicator */}
        <div className="w-32 h-1 bg-white/30 rounded-full mx-auto mt-2"></div>
      </div>

      {/* Presentation Helper Chips */}
      <div className="mt-3.5 p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl text-center w-full max-w-sm backdrop-blur text-xs space-y-1.5">
        <div className="flex items-center justify-between text-neutral-300 text-[11px]">
          <span>Standard Unlock:</span>
          <code className="font-mono bg-neutral-800 px-1.5 py-0.5 rounded text-emerald-400 font-bold">1234</code>
        </div>
        <div className="flex items-center justify-between text-neutral-300 text-[11px]">
          <span>Duress PIN + Gesture Guard:</span>
          <code className="font-mono bg-neutral-800 px-1.5 py-0.5 rounded text-rose-400 font-bold">
            9-9-9 + Hold '9' &gt;=1.5s
          </code>
        </div>
        <div className="flex items-center justify-between text-neutral-400 text-[11px] pt-0.5 border-t border-neutral-800">
          <span>False-Alarm Revoke Window:</span>
          <span className="text-amber-400 font-semibold">15s Delay • Master PIN 1234</span>
        </div>
      </div>
    </div>
  );
}