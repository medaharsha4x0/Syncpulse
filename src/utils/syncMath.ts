/**
 * Pure mathematical algorithms for NTP clock synchronization,
 * drift detection, outlier rejection, and acoustic delay adjustment.
 */

export interface NTPBurst {
  t0: number; // Client transmit timestamp (ms)
  t1: number; // Server receive timestamp (ms)
  t2: number; // Server transmit timestamp (ms)
  t3: number; // Client receive timestamp (ms)
}

export interface NTPSyncResult {
  roundTripTime: number; // ms
  clockOffset: number;   // ms (ServerTime - ClientTime)
  jitter: number;        // ms
  sampleCount: number;
}

export type DriftAction =
  | { type: 'IN_PHASE'; driftMs: number }
  | { type: 'GLIDE'; driftMs: number; suggestedPlaybackRate: number; durationMs: number }
  | { type: 'MICRO_SEEK'; driftMs: number; targetTrackPosition: number };

/**
 * Calculates RTT and Offset for an individual NTP ping-pong sample.
 * RTT = (t3 - t0) - (t2 - t1)
 * Offset = ((t1 - t0) + (t2 - t3)) / 2
 */
export function calculateSingleNTPSample(burst: NTPBurst): { rtt: number; offset: number } {
  const rtt = Math.max(0, (burst.t3 - burst.t0) - (burst.t2 - burst.t1));
  const offset = ((burst.t1 - burst.t0) + (burst.t2 - burst.t3)) / 2;
  return { rtt, offset };
}

/**
 * Robust NTP filtering using trimmed mean:
 * 1. Calculate RTT and Offset for each burst.
 * 2. Sort by RTT ascending.
 * 3. Discard lowest 20% and highest 20% if at least 5 samples exist (neutralizes network jitter & buffer bloat).
 * 4. Compute mean offset, minimum RTT, and sample jitter.
 */
export function computeRobustNTPOffset(bursts: NTPBurst[]): NTPSyncResult {
  if (!bursts || bursts.length === 0) {
    return { roundTripTime: 0, clockOffset: 0, jitter: 0, sampleCount: 0 };
  }

  const samples = bursts.map(calculateSingleNTPSample);

  // If few samples, simple average
  if (samples.length < 5) {
    const avgRtt = samples.reduce((acc, s) => acc + s.rtt, 0) / samples.length;
    const avgOffset = samples.reduce((acc, s) => acc + s.offset, 0) / samples.length;
    return {
      roundTripTime: Math.round(avgRtt * 10) / 10,
      clockOffset: Math.round(avgOffset * 10) / 10,
      jitter: 0,
      sampleCount: samples.length,
    };
  }

  // Sort by RTT ascending (NTP standard: lowest RTT samples have lowest asymmetry error)
  samples.sort((a, b) => a.rtt - b.rtt);

  // Trim top 20% and bottom 20%
  const trimCount = Math.floor(samples.length * 0.2);
  const filtered = samples.slice(trimCount, samples.length - trimCount);

  const meanOffset = filtered.reduce((acc, s) => acc + s.offset, 0) / filtered.length;
  const meanRtt = filtered.reduce((acc, s) => acc + s.rtt, 0) / filtered.length;

  // Jitter is the standard deviation of RTTs
  const variance = filtered.reduce((acc, s) => acc + Math.pow(s.rtt - meanRtt, 2), 0) / filtered.length;
  const jitter = Math.sqrt(variance);

  return {
    roundTripTime: Math.round(meanRtt * 10) / 10,
    clockOffset: Math.round(meanOffset * 10) / 10,
    jitter: Math.round(jitter * 10) / 10,
    sampleCount: filtered.length,
  };
}

/**
 * Converts a Universal Server Timestamp into local AudioContext scheduling time.
 * @param targetServerTimestampMs The target timestamp when audio should start playing in server clock time
 * @param clockOffsetMs Clock offset where (ServerTime = ClientTime + clockOffset)
 * @param currentLocalTimeMs Local Date.now() or performance.now() epoch
 * @param audioCtxCurrentTime Local AudioContext.currentTime in seconds
 */
export function calculateScheduledAudioTime(
  targetServerTimestampMs: number,
  clockOffsetMs: number,
  currentLocalTimeMs: number,
  audioCtxCurrentTime: number,
  acousticCalibrationOffsetMs = 0
): { scheduleTimeAudioCtx: number; delaySeconds: number; isLate: boolean } {
  // Client time when targetServerTimestampMs occurs:
  const clientTargetTimeMs = (targetServerTimestampMs - clockOffsetMs) + acousticCalibrationOffsetMs;
  const delayMs = clientTargetTimeMs - currentLocalTimeMs;
  const delaySeconds = delayMs / 1000;

  if (delaySeconds <= 0) {
    // If we're already past the start time
    return {
      scheduleTimeAudioCtx: audioCtxCurrentTime,
      delaySeconds: 0,
      isLate: true,
    };
  }

  return {
    scheduleTimeAudioCtx: audioCtxCurrentTime + delaySeconds,
    delaySeconds,
    isLate: false,
  };
}

/**
 * Determine the drift correction action based on the difference between expected track position and actual playback position.
 * - Under 5ms: In phase, comb-filtering threshold not crossed.
 * - 5ms to 25ms: Subtle pitch-preserving rate adjustment (glide) to realign phase imperceptibly.
 * - Over 25ms: Micro-seek to correct significant desync.
 */
export function evaluateDriftCorrection(
  actualTrackPositionSec: number,
  expectedTrackPositionSec: number
): DriftAction {
  const driftSec = actualTrackPositionSec - expectedTrackPositionSec;
  const driftMs = Math.round(driftSec * 1000);
  const absDriftMs = Math.abs(driftMs);

  if (absDriftMs < 5) {
    return { type: 'IN_PHASE', driftMs };
  }

  if (absDriftMs <= 25) {
    // If actual > expected, guest is ahead -> slow down slightly (playbackRate = 0.998)
    // If actual < expected, guest is behind -> speed up slightly (playbackRate = 1.002)
    const suggestedPlaybackRate = driftMs > 0 ? 0.998 : 1.002;
    // Duration in ms to eliminate drift: e.g. at 0.002 rate change, 1 second glides 2ms.
    // To correct 10ms at 2ms/s takes 5 seconds, capped between 400ms and 1500ms
    const durationMs = Math.min(1500, Math.max(400, (absDriftMs / 0.002)));
    return {
      type: 'GLIDE',
      driftMs,
      suggestedPlaybackRate,
      durationMs,
    };
  }

  return {
    type: 'MICRO_SEEK',
    driftMs,
    targetTrackPosition: Math.max(0, expectedTrackPositionSec),
  };
}

/**
 * Computes speed-of-sound acoustic delay in milliseconds based on distance in meters.
 * Speed of sound in standard dry air @ 20°C is ~343 m/s.
 * Delay (ms) = (distance / 343) * 1000
 */
export function calculateAcousticDelayMs(distanceMeters: number): number {
  const SPEED_OF_SOUND_M_S = 343;
  return Math.round((distanceMeters / SPEED_OF_SOUND_M_S) * 1000 * 10) / 10;
}
