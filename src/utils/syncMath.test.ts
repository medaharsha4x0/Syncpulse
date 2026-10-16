import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSingleNTPSample,
  computeRobustNTPOffset,
  calculateScheduledAudioTime,
  evaluateDriftCorrection,
  calculateAcousticDelayMs,
} from './syncMath.ts';

test('calculateSingleNTPSample computes accurate RTT and offset', () => {
  // Client sends at 1000, server gets at 1050 (offset +50 - 10ms one-way network delay)
  // Server sends back at 1060, client gets at 1080
  const burst = {
    t0: 1000,
    t1: 1050,
    t2: 1060,
    t3: 1080,
  };
  const { rtt, offset } = calculateSingleNTPSample(burst);
  // RTT = (1080 - 1000) - (1060 - 1050) = 80 - 10 = 70
  assert.equal(rtt, 70);
  // Offset = ((1050 - 1000) + (1060 - 1080)) / 2 = (50 + (-20)) / 2 = 15
  assert.equal(offset, 15);
});

test('computeRobustNTPOffset filters extreme jitter outliers with trimmed mean', () => {
  // 10 samples: 8 normal with ~20ms RTT and +50ms offset, 2 extreme outliers (spikes)
  const bursts = [
    { t0: 100, t1: 160, t2: 162, t3: 182 }, // normal: rtt 80, offset 50
    { t0: 200, t1: 260, t2: 262, t3: 282 }, // normal
    { t0: 300, t1: 360, t2: 362, t3: 382 }, // normal
    { t0: 400, t1: 460, t2: 462, t3: 482 }, // normal
    { t0: 500, t1: 560, t2: 562, t3: 582 }, // normal
    { t0: 600, t1: 660, t2: 662, t3: 682 }, // normal
    { t0: 700, t1: 760, t2: 762, t3: 782 }, // normal
    { t0: 800, t1: 860, t2: 862, t3: 882 }, // normal
    { t0: 900, t1: 1500, t2: 1510, t3: 1650 }, // extreme delay spike! rtt 740, offset 545
    { t0: 1000, t1: 1010, t2: 1011, t3: 1012 }, // abnormally low rtt outlier
  ];

  const result = computeRobustNTPOffset(bursts);
  assert.ok(result.sampleCount >= 6, 'Should keep trimmed inner samples');
  // The normal samples have (t1 - t0)=60 and (t2 - t3)=-20 -> offset = (60 - 20)/2 = 20
  assert.ok(Math.abs(result.clockOffset - 20) < 5, `Expected offset close to 20, got ${result.clockOffset}`);
});

test('calculateScheduledAudioTime maps universal server time to AudioContext', () => {
  const targetServerTimestampMs = 10000;
  const clockOffsetMs = 200; // server is 200ms ahead of client
  const currentLocalTimeMs = 8500;
  const audioCtxCurrentTime = 12.0;

  // clientTargetTime = 10000 - 200 = 9800ms
  // delayMs = 9800 - 8500 = 1300ms = 1.3s
  const { scheduleTimeAudioCtx, delaySeconds, isLate } = calculateScheduledAudioTime(
    targetServerTimestampMs,
    clockOffsetMs,
    currentLocalTimeMs,
    audioCtxCurrentTime
  );

  assert.equal(isLate, false);
  assert.ok(Math.abs(delaySeconds - 1.3) < 0.001);
  assert.ok(Math.abs(scheduleTimeAudioCtx - 13.3) < 0.001);
});

test('evaluateDriftCorrection classifies in-phase, glide, and micro-seek thresholds', () => {
  // <5ms drift -> IN_PHASE
  const inPhase = evaluateDriftCorrection(10.002, 10.0);
  assert.equal(inPhase.type, 'IN_PHASE');

  // 12ms drift -> GLIDE (smooth pitch-safe rate alteration)
  const glideAhead = evaluateDriftCorrection(10.015, 10.0);
  assert.equal(glideAhead.type, 'GLIDE');
  if (glideAhead.type === 'GLIDE') {
    assert.equal(glideAhead.suggestedPlaybackRate, 0.998); // Slow down
  }

  const glideBehind = evaluateDriftCorrection(9.985, 10.0);
  assert.equal(glideBehind.type, 'GLIDE');
  if (glideBehind.type === 'GLIDE') {
    assert.equal(glideBehind.suggestedPlaybackRate, 1.002); // Speed up
  }

  // >25ms drift -> MICRO_SEEK
  const desync = evaluateDriftCorrection(10.080, 10.0);
  assert.equal(desync.type, 'MICRO_SEEK');
  if (desync.type === 'MICRO_SEEK') {
    assert.equal(desync.targetTrackPosition, 10.0);
  }
});

test('calculateAcousticDelayMs converts meter distance to ms sound flight time', () => {
  // At ~343 m/s, 3.43 meters is ~10ms
  const delay = calculateAcousticDelayMs(3.43);
  assert.ok(Math.abs(delay - 10.0) < 0.2, `Expected ~10ms delay for 3.43m, got ${delay}`);
});
