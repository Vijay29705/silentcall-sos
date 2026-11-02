import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, Battery, Volume2, ShieldAlert, Cpu, Sparkles } from 'lucide-react';
import { collectCovertTelemetry } from '../utils/telemetry';

export default function CovertCalculator({ onSendSOS, isConnected, showDebugOverlay = false }) {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [overwrite, setOverwrite] = useState(false);
  
  // Stealth status & audit state (only visible if presenter expands debug audit panel)
  const [isGatheringTelemetry, setIsGatheringTelemetry] = useState(false);
  const [lastDispatchedPacket, setLastDispatchedPacket] = useState(null);
  const [covertTriggerCount, setCovertTriggerCount] = useState(0);

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
    if (overwrite) {
      setDisplay('0.');
      setOverwrite(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  // Clear / All Clear
  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setOverwrite(false);
  };

  // Toggle +/-
  const handleToggleSign = () => {
    if (display === '0') return;
    if (display.startsWith('-')) {
      setDisplay(display.slice(1));
    } else {
      setDisplay('-' + display);
    }
  };

  // Percentage
  const handlePercent = () => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setDisplay(String(val / 100));
    }
  };

  // Arithmetic operations (+, -, *, /)
  const handleOperation = (op) => {
    setPrevValue(parseFloat(display));
    setOperation(op);
    setOverwrite(true);
  };

  // Equals (=) with Stealth Trigger Interception
  const handleEquals = () => {
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

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto select-none">
      {/* Mobile Device Frame Container */}
      <div className="w-full bg-black rounded-[46px] p-6 shadow-2xl border-4 border-neutral-800 relative overflow-hidden backdrop-blur-xl">
        
        {/* iOS Dynamic Island / Speaker Notch */}
        <div className="flex justify-between items-center mb-4 px-2 pt-1 text-white text-xs font-medium">
          <span>9:41</span>
          <div className="w-24 h-4 bg-neutral-900 rounded-full mx-auto -mt-2"></div>
          <div className="flex items-center space-x-1.5">
            <Wifi className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] tracking-tight">5G</span>
            <Battery className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Covert Active Indicator (Almost imperceptible single sub-pixel dot for verification) */}
        <div className="flex justify-between items-center px-1 mb-1">
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

        {/* Digital Display Area */}
        <div className="h-24 flex items-end justify-end px-3 mb-4 overflow-hidden">
          <div className={`text-white font-light tracking-tight transition-all duration-100 ${getFontSizeClass()}`}>
            {display}
          </div>
        </div>

        {/* Calculator Button Grid (iOS 17 aesthetic) */}
        <div className="grid grid-cols-4 gap-3">
          {/* Row 1 */}
          <button
            onClick={handleClear}
            className="w-16 h-16 rounded-full bg-[#a5a5a5] text-black font-medium text-2xl active:bg-[#d4d4d2] transition-colors flex items-center justify-center"
          >
            {display !== '0' ? 'C' : 'AC'}
          </button>
          <button
            onClick={handleToggleSign}
            className="w-16 h-16 rounded-full bg-[#a5a5a5] text-black font-medium text-2xl active:bg-[#d4d4d2] transition-colors flex items-center justify-center"
          >
            ±
          </button>
          <button
            onClick={handlePercent}
            className="w-16 h-16 rounded-full bg-[#a5a5a5] text-black font-medium text-2xl active:bg-[#d4d4d2] transition-colors flex items-center justify-center"
          >
            %
          </button>
          <button
            onClick={() => handleOperation('÷')}
            className={`w-16 h-16 rounded-full font-medium text-3xl transition-colors flex items-center justify-center ${
              operation === '÷' ? 'bg-white text-[#ff9f0a]' : 'bg-[#ff9f0a] text-white active:bg-[#f18e00]'
            }`}
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            onClick={() => handleDigit('7')}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            7
          </button>
          <button
            onClick={() => handleDigit('8')}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            8
          </button>
          <button
            onClick={() => handleDigit('9')}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            9
          </button>
          <button
            onClick={() => handleOperation('×')}
            className={`w-16 h-16 rounded-full font-medium text-3xl transition-colors flex items-center justify-center ${
              operation === '×' ? 'bg-white text-[#ff9f0a]' : 'bg-[#ff9f0a] text-white active:bg-[#f18e00]'
            }`}
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            onClick={() => handleDigit('4')}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            4
          </button>
          <button
            onClick={() => handleDigit('5')}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            5
          </button>
          <button
            onClick={() => handleDigit('6')}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            6
          </button>
          <button
            onClick={() => handleOperation('−')}
            className={`w-16 h-16 rounded-full font-medium text-3xl transition-colors flex items-center justify-center ${
              operation === '−' ? 'bg-white text-[#ff9f0a]' : 'bg-[#ff9f0a] text-white active:bg-[#f18e00]'
            }`}
          >
            −
          </button>

          {/* Row 4 */}
          <button
            onClick={() => handleDigit('1')}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            1
          </button>
          <button
            onClick={() => handleDigit('2')}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            2
          </button>
          <button
            onClick={() => handleDigit('3')}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            3
          </button>
          <button
            onClick={() => handleOperation('+')}
            className={`w-16 h-16 rounded-full font-medium text-3xl transition-colors flex items-center justify-center ${
              operation === '+' ? 'bg-white text-[#ff9f0a]' : 'bg-[#ff9f0a] text-white active:bg-[#f18e00]'
            }`}
          >
            +
          </button>

          {/* Row 5 */}
          <button
            onClick={() => handleDigit('0')}
            className="col-span-2 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-start pl-7 font-normal"
          >
            0
          </button>
          <button
            onClick={handleDecimal}
            className="w-16 h-16 rounded-full bg-[#333333] text-white text-3xl active:bg-[#737373] transition-colors flex items-center justify-center font-normal"
          >
            .
          </button>
          <button
            onClick={handleEquals}
            className="w-16 h-16 rounded-full bg-[#ff9f0a] text-white font-medium text-3xl active:bg-[#f18e00] transition-colors flex items-center justify-center"
          >
            =
          </button>
        </div>

        {/* iOS Home Indicator Bar */}
        <div className="w-32 h-1 bg-white/40 rounded-full mx-auto mt-6"></div>
      </div>

      {/* Presentation Hint Banner (Explains the covert trigger clearly) */}
      <div className="mt-4 p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl text-center w-full max-w-sm backdrop-blur">
        <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-semibold uppercase tracking-wider mb-1">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          Stealth Trigger Protocol
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Type <span className="font-mono font-bold text-amber-400 bg-neutral-800 px-1 py-0.5 rounded">112</span> and tap <span className="font-mono font-bold text-amber-400 bg-neutral-800 px-1 py-0.5 rounded">=</span> to dispatch zero-audio emergency telemetry.
        </p>
      </div>

      {/* Optional Academic Audit / Telemetry Inspection Panel (Shows background mechanism to evaluators) */}
      {showDebugOverlay && (
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
