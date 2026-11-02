/**
 * SilentCall-SOS: OS Background Throttling & Process Sleep Prevention
 * 
 * Manages W3C Screen Wake Lock API and an iOS WebKit silent audio loop fallback.
 * Prevents mobile Safari and Chromium OS power-savers from throttling or sleeping
 * JavaScript background timers (15s grace countdown, Dead Man's Switch watchdog,
 * and sensor polling) during simulated device blackout.
 */

let wakeLockSentinel = null;
let silentAudioElement = null;
let isAcquiring = false;
let visibilityListenerAttached = false;

/**
 * Dynamically synthesizes an inaudible 1-second 8kHz 8-bit unsigned mono PCM WAV data URI.
 * Guarantees zero external network dependencies and absolute privacy.
 */
function generateSilentWavDataUri(durationSeconds = 1) {
  const sampleRate = 8000;
  const numSamples = sampleRate * durationSeconds;
  const buffer = new Uint8Array(44 + numSamples);

  // Write ASCII identifier
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      buffer[offset + i] = string.charCodeAt(i);
    }
  };

  writeString(0, 'RIFF');
  const fileSize = 36 + numSamples;
  buffer[4] = fileSize & 0xff;
  buffer[5] = (fileSize >> 8) & 0xff;
  buffer[6] = (fileSize >> 16) & 0xff;
  buffer[7] = (fileSize >> 24) & 0xff;

  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  buffer[16] = 16; buffer[17] = 0; buffer[18] = 0; buffer[19] = 0; // Subchunk1Size (16 for PCM)
  buffer[20] = 1;  buffer[21] = 0; // AudioFormat (1 = PCM)
  buffer[22] = 1;  buffer[23] = 0; // NumChannels (1 = Mono)
  buffer[24] = sampleRate & 0xff;
  buffer[25] = (sampleRate >> 8) & 0xff;
  buffer[26] = (sampleRate >> 16) & 0xff;
  buffer[27] = 0; // SampleRate (8000 Hz)
  buffer[28] = sampleRate & 0xff;
  buffer[29] = (sampleRate >> 8) & 0xff;
  buffer[30] = (sampleRate >> 16) & 0xff;
  buffer[31] = 0; // ByteRate (SampleRate * NumChannels * BitsPerSample / 8)
  buffer[32] = 1;  buffer[33] = 0; // BlockAlign
  buffer[34] = 8;  buffer[35] = 0; // BitsPerSample (8-bit)

  writeString(36, 'data');
  buffer[40] = numSamples & 0xff;
  buffer[41] = (numSamples >> 8) & 0xff;
  buffer[42] = (numSamples >> 16) & 0xff;
  buffer[43] = 0;

  // Unsigned 8-bit PCM center silence is 128 (0x80)
  buffer.fill(128, 44);

  // Convert buffer to binary string
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }

  return 'data:audio/wav;base64,' + btoa(binary);
}

/**
 * Handle re-acquiring wake lock when browser tab regains visibility
 */
async function handleVisibilityChange() {
  if (wakeLockSentinel !== null && document.visibilityState === 'visible') {
    try {
      if ('wakeLock' in navigator) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        console.log('[WakeLock] Screen WakeLock re-acquired after tab visibility restoration.');
      }
    } catch (err) {
      console.warn('[WakeLock] Re-acquisition on visibility change failed:', err.message);
    }
  }
}

/**
 * Acquire emergency wake lock across W3C Screen Wake Lock and iOS WebKit audio loop fallback
 */
export async function acquireEmergencyWakeLock() {
  if (isAcquiring) return;
  isAcquiring = true;

  console.log('[WakeLock] Initiating dual-tier OS background throttling guard...');

  // Tier 1: W3C Screen Wake Lock API
  if ('wakeLock' in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] W3C Screen WakeLock successfully granted.');

      wakeLockSentinel.addEventListener('release', () => {
        console.warn('[WakeLock] W3C Screen WakeLock was released by OS.');
      });

      if (!visibilityListenerAttached) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        visibilityListenerAttached = true;
      }
    } catch (err) {
      console.warn('[WakeLock] W3C Screen WakeLock request rejected or unsupported:', err.name, err.message);
    }
  } else {
    console.warn('[WakeLock] W3C Screen WakeLock API not supported in this environment.');
  }

  // Tier 2: iOS WebKit Fallback (Inaudible 1-Second Silent Audio Loop)
  // Keeps mobile Safari AudioSession active, preventing WebKit from freezing background timers
  try {
    if (!silentAudioElement) {
      const silentWavUri = generateSilentWavDataUri(1);
      silentAudioElement = new Audio(silentWavUri);
      silentAudioElement.loop = true;
      silentAudioElement.volume = 0.01; // Ultra-low volume (inaudible PCM silence)
      silentAudioElement.setAttribute('playsinline', 'true');
      silentAudioElement.setAttribute('webkit-playsinline', 'true');
    }

    const playPromise = silentAudioElement.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('[WakeLock] iOS WebKit inaudible audio loop active (Background timer throttling prevented).');
        })
        .catch((playError) => {
          console.warn('[WakeLock] Silent audio autoplay restricted (awaiting user gesture):', playError.message);
        });
    }
  } catch (audioErr) {
    console.warn('[WakeLock] iOS WebKit audio loop setup failed:', audioErr.message);
  } finally {
    isAcquiring = false;
  }
}

/**
 * Release all emergency wake locks and terminate the silent audio loop
 */
export async function releaseEmergencyWakeLock() {
  console.log('[WakeLock] Releasing emergency wake lock & background keep-alive hooks.');

  // Release W3C Wake Lock
  if (wakeLockSentinel !== null) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
      console.log('[WakeLock] Screen WakeLock released successfully.');
    } catch (err) {
      console.warn('[WakeLock] Error releasing Screen WakeLock:', err.message);
    }
  }

  // Cleanup visibility listener
  if (visibilityListenerAttached) {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    visibilityListenerAttached = false;
  }

  // Terminate iOS WebKit audio loop
  if (silentAudioElement) {
    try {
      silentAudioElement.pause();
      silentAudioElement.currentTime = 0;
      silentAudioElement.src = '';
      silentAudioElement = null;
      console.log('[WakeLock] iOS WebKit background audio element halted.');
    } catch (err) {
      console.warn('[WakeLock] Error pausing silent audio element:', err.message);
    }
  }
}

/**
 * Check if any wake lock or keep-alive hook is currently active
 */
export function isWakeLockActive() {
  return wakeLockSentinel !== null || (silentAudioElement !== null && !silentAudioElement.paused);
}

