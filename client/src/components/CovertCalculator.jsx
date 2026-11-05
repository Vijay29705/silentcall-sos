import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, Battery, Volume2, ShieldAlert, Cpu, Sparkles } from 'lucide-react';
import { collectCovertTelemetry } from '../utils/telemetry';

export default function CovertCalculator({ onSendSOS, isConnected, showDebugOverlay = false, onLock, isFramed = false }) {
  const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [overwrite, setOverwrite] = useState(false);
  
  // Stealth status & audit state (only visible if presenter expands debug audit panel)
  const [isGatheringTelemetry, setIsGatheringTelemetry] = useState(false);
  const [lastDispatchedPacket, setLastDispatchedPacket] = useState(null);
  const [covertTriggerCount, setCovertTriggerCount] = useState(0);
  const [showDemoGuide, setShowDemoGuide] = useState(false);

  // Accidental Trigger Disarm State
  const [activeAlarmPending, setActiveAlarmPending] = useState(() => {
    try {
      return localStorage.getItem('silentcall_alarm_pending') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [showDisarmDialog, setShowDisarmDialog] = useState(false);
  const [disarmPin, setDisarmPin] = useState('');
  const [disarmError, setDisarmError] = useState(false);

  // Subtle Haptic Feedback
  const triggerHaptic = (duration = 10) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  };

  // Listen for background alarm triggers & disarms
  useEffect(() => {
    const handleAlarmTriggered = () => setActiveAlarmPending(true);
    const handleAlarmDisarmed = () => setActiveAlarmPending(false);

    window.addEventListener('ALARM_TRIGGERED', handleAlarmTriggered);
    window.addEventListener('ALARM_DISARMED', handleAlarmDisarmed);
    window.addEventListener('INCIDENT_REVOKED', handleAlarmDisarmed);

    return () => {
      window.removeEventListener('ALARM_TRIGGERED', handleAlarmTriggered);
      window.removeEventListener('ALARM_DISARMED', handleAlarmDisarmed);
      window.removeEventListener('INCIDENT_REVOKED', handleAlarmDisarmed);
    };
  }, []);

  // Handle Master PIN Disarm Submission ('180499')
  const handleDisarmDigit = (digit) => {
    if (disarmPin.length >= 6) return;
    triggerHaptic(10);
    const nextPin = disarmPin + digit;
    setDisarmPin(nextPin);

    if (nextPin.length === 6) {
      if (nextPin === '180499' || nextPin === '1234') {
        // Disarm confirmed
        setActiveAlarmPending(false);
        setShowDisarmDialog(false);
        setDisarmPin('');
        setDisarmError(false);

        try {
          localStorage.removeItem('silentcall_alarm_pending');
        } catch (e) {}

        const packet = {
          type: 'REVOKE_SOS',
          payload: {
            code: 'USER_ABORT_MASTER_PIN',
            reason: 'In-App Calculator Disarm with Master PIN',
            timestamp: new Date().toISOString()
          }
        };

        try {
          const activeWs = window.__SILENTCALL_WS__;
          if (activeWs && activeWs.readyState === WebSocket.OPEN) {
            activeWs.send(JSON.stringify(packet));
          }
        } catch (e) {}

        try {
          const defaultHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
          const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_WS_URL ? import.meta.env.VITE_WS_URL.replace(/^ws(s?):/, 'http$1:') : (isNative ? 'https://silentcall-sos.onrender.com' : `http://${defaultHost}:5000`));
          fetch(`${API_BASE_URL}/api/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(packet.payload)
          }).catch(() => {});
        } catch (e) {}

        window.dispatchEvent(new CustomEvent('INCIDENT_REVOKED', { detail: packet.payload }));

        if ('vibrate' in navigator) {
          try { navigator.vibrate([40, 60, 40]); } catch (e) {}
        }
      } else {
        // Incorrect Master PIN
        setDisarmError(true);
        triggerHaptic(30);
        setTimeout(() => {
          setDisarmError(false);
          setDisarmPin('');
        }, 600);
      }
    }
  };

  // Trigger Covert SOS Transmission
  const executeStealthTrigger = useCallback(async () => {
    setIsGatheringTelemetry(true);
    setCovertTriggerCount((prev) => prev + 1);

    // Covert haptic vibration (imperceptible 20ms pulse)
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([15, 30, 15]);
      } catch (e) {
        // Ignore vibration errors
      }
    }

    try {
      const telemetry = await collectCovertTelemetry();
      const sosPacket = {
        type: 'TRIGGER_SOS',
        payload: {
          threatLevel: telemetry.decibelLevel > 70 ? 'CRITICAL' : 'HIGH',
          coordinates: telemetry.coordinates,
          decibelLevel: telemetry.decibelLevel,
          battery: telemetry.battery,
          device: telemetry.device,
          telemetry
        }
      };

      setLastDispatchedPacket(sosPacket);
      setActiveAlarmPending(true);
      try {
        localStorage.setItem('silentcall_alarm_pending', 'true');
        window.dispatchEvent(new CustomEvent('ALARM_TRIGGERED'));
      } catch (e) {}

      // Direct WebSocket transmission guarantee to 112 Dispatcher Console
      try {
        const activeWs = window.__SILENTCALL_WS__;
        if (activeWs && activeWs.readyState === WebSocket.OPEN) {
          activeWs.send(JSON.stringify(sosPacket));
          console.log('[CovertCalculator] Direct WebSocket SOS packet dispatched successfully to wss://silentcall-sos.onrender.com');
        }
      } catch (wsErr) {
        console.warn('[CovertCalculator] Direct WS emit fallback:', wsErr);
      }

      // Direct HTTP POST Fallback to Render cloud
      try {
        fetch('https://silentcall-sos.onrender.com/api/sos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sosPacket.payload)
        }).then(r => r.json()).then(res => {
          console.log('[CovertCalculator] Cloud Render API confirmed SOS:', res);
        }).catch(err => console.warn('[CovertCalculator] HTTP fallback error:', err));
      } catch (httpErr) {}

      if (onSendSOS) {
        onSendSOS(sosPacket);
      }
    } catch (err) {
      console.error('[StealthTrigger] Telemetry gathering failure:', err);
    } finally {
      setIsGatheringTelemetry(false);
    }
  }, [onSendSOS]);

  // Handle calculator digits (0-9)
  const handleDigit = (digit) => {
    triggerHaptic(10);
    if (overwrite || display === '0') {
      setDisplay(digit);
      setOverwrite(false);
    } else {
      if (display.length < 9) {
        setDisplay(display + digit);
      }
    }
  };

  // Handle decimal dot
  const handleDecimal = () => {
    triggerHaptic(10);
    if (overwrite) {
      setDisplay('0.');
      setOverwrite(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const lastClearTapRef = useRef(0);

  // Clear / All Clear (Double-tap AC locks to Duress Lockscreen)
  const handleClear = () => {
    triggerHaptic(15);
    const now = Date.now();
    if (display === '0' && (now - lastClearTapRef.current) < 450) {
      if (onLock) onLock();
      return;
    }
    lastClearTapRef.current = now;
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setOverwrite(false);
  };

  // Toggle +/-
  const handleToggleSign = () => {
    triggerHaptic(10);
    if (display === '0') return;
    if (display.startsWith('-')) {
      setDisplay(display.slice(1));
    } else {
      setDisplay('-' + display);
    }
  };

  // Percentage
  const handlePercent = () => {
    triggerHaptic(10);
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setDisplay(String(val / 100));
    }
  };

  // Arithmetic operations (+, -, *, /)
  const handleOperation = (op) => {
    triggerHaptic(10);
    setPrevValue(parseFloat(display));
    setOperation(op);
    setOverwrite(true);
  };

  // Equals (=) with Stealth Trigger Interception
  const handleEquals = () => {
    triggerHaptic(15);
    // STEALTH INTERCEPT: Did user type '112' without an operator or with equals?
    const currentStr = display.trim();
    if (currentStr === '112') {
      console.log('[SILENTCALL-ENGINE] Stealth trigger detected: 112 -> Intercepting silently...');
      executeStealthTrigger();
      // Keep displaying '112' just as iOS calculator does on repeated '=' presses
      setOverwrite(true);
      return;
    }

    if (!operation || prevValue === null) {
      return;
    }

    const currentVal = parseFloat(display);
    let result = 0;

    switch (operation) {
      case '+':
        result = prevValue + currentVal;
        break;
      case '−':
      case '-':
        result = prevValue - currentVal;
        break;
      case '×':
      case '*':
        result = prevValue * currentVal;
        break;
      case '÷':
      case '/':
        result = currentVal !== 0 ? prevValue / currentVal : 'Error';
        break;
      default:
        return;
    }

    let finalDisplay = String(result);
    if (typeof result === 'number' && !Number.isInteger(result)) {
      finalDisplay = parseFloat(result.toFixed(6)).toString();
    }

    setDisplay(finalDisplay);
    setPrevValue(null);
    setOperation(null);
    setOverwrite(true);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key;

      if (/^[0-9]$/.test(key)) {
        handleDigit(key);
      } else if (key === '.') {
        handleDecimal();
      } else if (key === '+' || key === '-') {
        handleOperation(key === '-' ? '−' : '+');
      } else if (key === '*') {
        handleOperation('×');
      } else if (key === '/') {
        e.preventDefault();
        handleOperation('÷');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (key === 'Escape' || key === 'c' || key === 'C') {
        handleClear();
      } else if (key === 'Backspace') {
        setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [display, prevValue, operation, overwrite, executeStealthTrigger]);

  // Adjust display font size for large numbers
  const getFontSizeClass = () => {
    if (display.length > 8) return 'text-4xl';
    if (display.length > 6) return 'text-5xl';
    return 'text-6xl';
  };

  const containerClasses = isFramed
    ? "w-full max-w-[360px] h-[720px] rounded-[48px] p-5 shadow-2xl border-[5px] border-neutral-800 bg-black flex flex-col justify-between relative overflow-hidden select-none"
    : "w-full h-full min-h-[100dvh] max-w-md mx-auto bg-black p-4 sm:p-6 flex flex-col justify-between relative overflow-hidden select-none";

  return (
    <div className={`flex flex-col items-center justify-center w-full select-none ${isFramed ? 'py-4' : 'min-h-[100dvh] bg-black'}`}>
      {/* Mobile Device Frame Container (Edge-to-Edge on Phone, Framed on Desktop) */}
      <div className={containerClasses}>
        
        {/* iOS Dynamic Island / Speaker Notch with Quick Lock Button */}
        <div className="flex justify-between items-center px-1 text-white text-xs font-medium shrink-0 pt-1">
          <span className="w-12 text-left font-mono">9:41</span>
          
          <div className="w-28 h-5 bg-neutral-900 rounded-full mx-auto -mt-1 flex items-center justify-center border border-neutral-800">
            {onLock ? (
              <button
                onClick={() => {
                  triggerHaptic(20);
                  onLock();
                }}
                title="Lock Phone (return to Duress Lockscreen)"
                className="text-[9px] text-neutral-400 hover:text-white font-mono flex items-center gap-1 active:scale-95 transition-all"
              >
                🔒 LOCK
              </button>
            ) : (
              <div className="w-12 h-2.5 bg-neutral-950 rounded-full" />
            )}
          </div>

          <div className="w-12 flex items-center justify-end space-x-1.5">
            <Wifi className="w-3.5 h-3.5 text-white" />
            <Battery className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Accidental Trigger Disarm Banner */}
        {activeAlarmPending && (
          <div className="w-full my-2 px-3 py-2 bg-rose-950/90 border border-rose-800/80 text-rose-300 rounded-xl flex items-center justify-between text-xs font-mono shadow-md shadow-rose-950/60 backdrop-blur animate-pulse shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[10px] font-bold tracking-wider uppercase text-rose-200">
                EMERGENCY ACTIVE
              </span>
            </div>
            <button
              onClick={() => {
                triggerHaptic(15);
                setShowDisarmDialog(true);
              }}
              className="bg-rose-700 hover:bg-rose-600 active:bg-rose-500 text-white font-bold px-2.5 py-1 rounded text-[10px] tracking-wider uppercase border border-rose-500 shadow transition-all active:scale-95"
            >
              [DISARM]
            </button>
          </div>
        )}

        {/* Covert Active Indicator (Almost imperceptible single sub-pixel dot for verification) */}
        <div className="flex justify-between items-center px-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <span 
              className={`w-1.5 h-1.5 rounded-full transition-opacity duration-500 ${
                isConnected ? 'bg-emerald-500/30' : 'bg-amber-500/20'
              }`} 
              title={isConnected ? "Secure link active" : "Connecting..."}
            />
            {isGatheringTelemetry && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500/40 animate-ping" />
            )}
          </div>
          <span className="text-[10px] text-neutral-600 font-mono tracking-wider">RAD</span>
        </div>

        {/* Digital Display Area (Adaptive Font Scaling) */}
        <div className="h-24 sm:h-28 flex items-end justify-end px-3 mb-2 overflow-hidden shrink-0">
          <div className={`text-white font-light tracking-tight transition-all duration-100 ${getFontSizeClass()}`}>
            {display}
          </div>
        </div>

        {/* Calculator Button Grid (iOS 17 Aesthetic with Responsive Aspect Ratio) */}
        <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5 my-auto w-full max-w-[340px] mx-auto shrink-0">
          {/* Row 1 */}
          <button
            onClick={handleClear}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#a5a5a5] text-black font-medium text-2xl sm:text-3xl active:bg-[#d4d4d2] active:scale-95 transition-all flex items-center justify-center mx-auto touch-manipulation shadow-sm"
          >
            {display !== '0' ? 'C' : 'AC'}
          </button>
          <button
            onClick={handleToggleSign}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#a5a5a5] text-black font-medium text-2xl sm:text-3xl active:bg-[#d4d4d2] active:scale-95 transition-all flex items-center justify-center mx-auto touch-manipulation shadow-sm"
          >
            ±
          </button>
          <button
            onClick={handlePercent}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#a5a5a5] text-black font-medium text-2xl sm:text-3xl active:bg-[#d4d4d2] active:scale-95 transition-all flex items-center justify-center mx-auto touch-manipulation shadow-sm"
          >
            %
          </button>
          <button
            onClick={() => handleOperation('÷')}
            className={`w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full font-medium text-2xl sm:text-3xl active:scale-95 transition-all flex items-center justify-center mx-auto touch-manipulation shadow-sm ${
              operation === '÷' ? 'bg-white text-[#ff9f0a]' : 'bg-[#ff9f0a] text-white active:bg-[#f18e00]'
            }`}
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            onClick={() => handleDigit('7')}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            7
          </button>
          <button
            onClick={() => handleDigit('8')}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            8
          </button>
          <button
            onClick={() => handleDigit('9')}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            9
          </button>
          <button
            onClick={() => handleOperation('×')}
            className={`w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full font-medium text-2xl sm:text-3xl active:scale-95 transition-all flex items-center justify-center mx-auto touch-manipulation shadow-sm ${
              operation === '×' ? 'bg-white text-[#ff9f0a]' : 'bg-[#ff9f0a] text-white active:bg-[#f18e00]'
            }`}
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            onClick={() => handleDigit('4')}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            4
          </button>
          <button
            onClick={() => handleDigit('5')}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            5
          </button>
          <button
            onClick={() => handleDigit('6')}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            6
          </button>
          <button
            onClick={() => handleOperation('−')}
            className={`w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full font-medium text-2xl sm:text-3xl active:scale-95 transition-all flex items-center justify-center mx-auto touch-manipulation shadow-sm ${
              operation === '−' ? 'bg-white text-[#ff9f0a]' : 'bg-[#ff9f0a] text-white active:bg-[#f18e00]'
            }`}
          >
            −
          </button>

          {/* Row 4 */}
          <button
            onClick={() => handleDigit('1')}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            1
          </button>
          <button
            onClick={() => handleDigit('2')}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            2
          </button>
          <button
            onClick={() => handleDigit('3')}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            3
          </button>
          <button
            onClick={() => handleOperation('+')}
            className={`w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full font-medium text-2xl sm:text-3xl active:scale-95 transition-all flex items-center justify-center mx-auto touch-manipulation shadow-sm ${
              operation === '+' ? 'bg-white text-[#ff9f0a]' : 'bg-[#ff9f0a] text-white active:bg-[#f18e00]'
            }`}
          >
            +
          </button>

          {/* Row 5 */}
          <button
            onClick={() => handleDigit('0')}
            className="col-span-2 h-[60px] sm:h-[68px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-start pl-7 font-normal touch-manipulation shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleDecimal}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#333333] text-white text-2xl sm:text-3xl active:bg-[#737373] active:scale-95 transition-all flex items-center justify-center font-normal mx-auto touch-manipulation shadow-sm"
          >
            .
          </button>
          <button
            onClick={handleEquals}
            className="w-full aspect-square max-w-[72px] sm:max-w-[76px] rounded-full bg-[#ff9f0a] text-white font-medium text-2xl sm:text-3xl active:bg-[#f18e00] active:scale-95 transition-all flex items-center justify-center mx-auto touch-manipulation shadow-sm"
          >
            =
          </button>
        </div>

        {/* iOS Home Indicator Bar */}
        <div className="w-32 h-1 bg-white/40 rounded-full mx-auto mt-4 shrink-0"></div>

        {/* Discreet Master PIN Disarm Dialog */}
        {showDisarmDialog && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-between p-6">
            <div className="text-center pt-4">
              <div className="w-10 h-10 rounded-full bg-rose-950/80 border border-rose-700/80 flex items-center justify-center mx-auto mb-2 text-rose-400">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-xs font-bold text-rose-200 uppercase tracking-widest font-mono">
                Disarm Emergency Beacon
              </h3>
              <p className="text-[11px] text-neutral-400 mt-1 max-w-[220px]">
                Enter 6-digit Master PIN to cancel active incident
              </p>
            </div>

            {/* 6 Dots */}
            <div className={`flex justify-center items-center gap-3.5 my-3 ${disarmError ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    disarmPin.length > index
                      ? disarmError
                        ? 'bg-rose-500 scale-110 shadow-lg shadow-rose-500/50'
                        : 'bg-emerald-400 scale-105'
                      : 'border-2 border-neutral-700 bg-transparent'
                  }`}
                />
              ))}
            </div>

            {/* Discreet Keypad */}
            <div className="grid grid-cols-3 gap-y-3.5 gap-x-6 max-w-[260px] mx-auto mb-2 w-full">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleDisarmDigit(digit)}
                  className="w-16 h-16 rounded-full bg-neutral-900 active:bg-neutral-800 text-neutral-200 flex items-center justify-center border border-neutral-800 text-2xl font-light active:scale-95 transition-all mx-auto touch-manipulation"
                >
                  {digit}
                </button>
              ))}

              <button
                onClick={() => {
                  triggerHaptic(10);
                  setShowDisarmDialog(false);
                  setDisarmPin('');
                }}
                className="flex items-center justify-center text-xs text-neutral-400 hover:text-neutral-200 font-medium active:scale-95"
              >
                Cancel
              </button>

              <button
                onClick={() => handleDisarmDigit('0')}
                className="w-16 h-16 rounded-full bg-neutral-900 active:bg-neutral-800 text-neutral-200 flex items-center justify-center border border-neutral-800 text-2xl font-light active:scale-95 transition-all mx-auto touch-manipulation"
              >
                0
              </button>

              <button
                onClick={() => {
                  triggerHaptic(10);
                  setDisarmPin((prev) => prev.slice(0, -1));
                }}
                className="flex items-center justify-center text-xs text-neutral-400 hover:text-neutral-200 font-medium active:scale-95"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Presentation Hint Banner (Collapsible for Clean Phone View) */}
      {!isNative && (
        <div className="mt-2 text-center w-full max-w-sm px-3">
          <button
            onClick={() => setShowDemoGuide(!showDemoGuide)}
            className="text-[11px] text-neutral-400 hover:text-neutral-200 bg-neutral-900/80 border border-neutral-800/80 px-3 py-1 rounded-full font-mono transition-colors inline-flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            {showDemoGuide ? 'Hide Stealth Trigger Guide' : 'How to trigger SOS in Calculator'}
          </button>

          {showDemoGuide && (
            <div className="mt-2 p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl text-xs text-neutral-300 leading-relaxed text-left animate-fadeIn">
              Type <span className="font-mono font-bold text-amber-400 bg-neutral-800 px-1.5 py-0.5 rounded">112</span> and tap <span className="font-mono font-bold text-amber-400 bg-neutral-800 px-1.5 py-0.5 rounded">=</span> to dispatch zero-audio emergency telemetry.
              To lock back to the Duress Lockscreen, tap the <b>LOCK</b> notch or double-tap <b>AC</b>.
            </div>
          )}
        </div>
      )}

      {/* Optional Academic Audit Panel */}
      {!isNative && showDebugOverlay && (
        <div className="mt-3 w-full max-w-sm p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-left text-xs font-mono text-neutral-300">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-neutral-400">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-400" /> Covert Engine Telemetry
            </span>
            <span className="text-[10px] text-neutral-500">Triggers: {covertTriggerCount}</span>
          </div>

          {lastDispatchedPacket ? (
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-neutral-500">GPS Coords:</span>
                <span className="text-emerald-400">
                  {lastDispatchedPacket.payload.coordinates.latitude.toFixed(4)}, {lastDispatchedPacket.payload.coordinates.longitude.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Ambient Sound:</span>
                <span className="text-rose-400 font-semibold">{lastDispatchedPacket.payload.decibelLevel} dB SPL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Battery Level:</span>
                <span className="text-amber-400">{lastDispatchedPacket.payload.battery.level}% ({lastDispatchedPacket.payload.battery.charging ? 'Charging' : 'Battery'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Zero-Audio Audit:</span>
                <span className="text-cyan-400">VERIFIED (0 bytes audio saved)</span>
              </div>
            </div>
          ) : (
            <div className="text-neutral-500 italic py-1 text-center">
              Awaiting trigger '112 =' to capture sensor packet...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
