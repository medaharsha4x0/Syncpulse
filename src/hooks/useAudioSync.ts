import { useEffect, useRef, useState, useCallback } from 'react';
import {
  NTPBurst,
  NTPSyncResult,
  computeRobustNTPOffset,
  calculateScheduledAudioTime,
  evaluateDriftCorrection,
  calculateAcousticDelayMs,
} from '../utils/syncMath';
import { SAMPLE_TRACKS, generateProceduralAudioBuffer, TrackMetadata } from '../utils/audioPresets';
import { QueuedTrack, StreamingTrack } from '../utils/streamingQueue';

export interface DeviceTelemetry {
  deviceId: string;
  deviceName: string;
  role: 'host' | 'guest';
  channel: string;
  muted: boolean;
  ping: number;
  offset: number;
  jitter: number;
  driftMs: number;
  status: 'LOCKED' | 'SYNCING' | 'DRIFTED';
  armed: boolean;
  batterySaver: boolean;
  acousticOffsetMs: number;
  distanceMeters: number;
  angleDeg: number;
}

export interface UseAudioSyncOptions {
  roomCode: string;
  role: 'host' | 'guest';
  deviceName?: string;
  onKicked?: () => void;
  onHostDisconnected?: () => void;
}

export function useAudioSync({
  roomCode,
  role,
  deviceName = 'Audio Node',
  onKicked,
  onHostDisconnected,
}: UseAudioSyncOptions) {
  // Connection and Identity
  const [isConnected, setIsConnected] = useState(false);
  const [deviceId] = useState(() => 'dev_' + Math.random().toString(36).substring(2, 8));
  const [activeChannel, setActiveChannel] = useState<'all' | 'left' | 'right' | 'subwoofer'>('all');
  const [isMuted, setIsMuted] = useState(false);

  // Sync Diagnostics
  const [syncState, setSyncState] = useState<'SYNCING' | 'LOCKED' | 'DRIFTED'>('SYNCING');
  const [roundTripTime, setRoundTripTime] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [driftMs, setDriftMs] = useState(0);
  const [handshakeProgress, setHandshakeProgress] = useState(0); // 0 to 100%

  // Acoustic Distance Offset (in ms)
  const [acousticOffsetMs, setAcousticOffsetMs] = useState(0);
  const [physicalDistanceMeters, setPhysicalDistanceMeters] = useState(0);

  // Audio Playback State
  const [isArmed, setIsArmed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata>(SAMPLE_TRACKS[0]);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(SAMPLE_TRACKS[0].duration);
  const [lookaheadMs, setLookaheadMs] = useState(1500);

  // Mesh Network & Party Queue
  const [connectedDevices, setConnectedDevices] = useState<DeviceTelemetry[]>([]);
  const [partyQueue, setPartyQueue] = useState<QueuedTrack[]>([]);
  const [hasCustomAudio, setHasCustomAudio] = useState(false);
  const [customAudioName, setCustomAudioName] = useState<string | null>(null);

  // Battery Saver / Wake Lock
  const [batterySaver, setBatterySaver] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Audio Context & Nodes References
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const subFilterRef = useRef<BiquadFilterNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);

  // Synchronization references
  const wsRef = useRef<WebSocket | null>(null);
  const ntpBurstsRef = useRef<NTPBurst[]>([]);
  const isSyncingRef = useRef(false);
  const clockOffsetRef = useRef(0);
  const acousticOffsetRef = useRef(0);
  acousticOffsetRef.current = acousticOffsetMs;
  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;

  // Scheduled playback tracking
  const playScheduleRef = useRef<{
    startServerTime: number;
    startPositionSec: number;
    localScheduledTime: number;
    audioCtxStartTime: number;
  } | null>(null);

  // Drift check timer
  const driftIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Initialize Web Audio Context (lazy/unlock on gesture)
  const getOrCreateAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const masterGain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;

      let panner: StereoPannerNode | null = null;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
      }

      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(140, ctx.currentTime);

      // Routing: source -> panner (or filter) -> masterGain -> analyser -> destination
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainNodeRef.current = masterGain;
      pannerNodeRef.current = panner;
      subFilterRef.current = subFilter;
      analyserRef.current = analyser;

      // Handle audio interruption (e.g., incoming phone call, backgrounding)
      ctx.onstatechange = () => {
        if (ctx.state === 'suspended' && isArmed) {
          ctx.resume().catch(() => {});
        }
      };
    }
    return audioCtxRef.current;
  }, [isArmed]);

  // Request Mobile Screen Wake Lock
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      }
    } catch (err) {
      // WakeLock not supported or denied
    }
  }, []);

  // Unlock iOS/Android Audio Restrictions (Arm Speaker)
  const armSpeaker = useCallback(async () => {
    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Play ultra-short silent tick to prime hardware audio pipeline
    const osc = ctx.createOscillator();
    const silentGain = ctx.createGain();
    silentGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    osc.connect(silentGain);
    silentGain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);

    setIsArmed(true);
    requestWakeLock();

    // Notify server telemetry
    sendTelemetry({ armed: true, status: syncState });
  }, [getOrCreateAudioContext, requestWakeLock, syncState]);

  // Configure Channel Routing (Left, Right, All, Subwoofer)
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (activeChannel === 'left') {
      if (pannerNodeRef.current) pannerNodeRef.current.pan.setValueAtTime(-1.0, ctx.currentTime);
    } else if (activeChannel === 'right') {
      if (pannerNodeRef.current) pannerNodeRef.current.pan.setValueAtTime(1.0, ctx.currentTime);
    } else {
      if (pannerNodeRef.current) pannerNodeRef.current.pan.setValueAtTime(0.0, ctx.currentTime);
    }
  }, [activeChannel]);

  // Mute control
  useEffect(() => {
    const gain = gainNodeRef.current;
    const ctx = audioCtxRef.current;
    if (gain && ctx) {
      gain.gain.setValueAtTime(isMuted ? 0 : 0.9, ctx.currentTime);
    }
  }, [isMuted]);

  // Load / Pre-buffer Track into Memory
  const loadTrackBuffer = useCallback(async (track: TrackMetadata) => {
    const ctx = getOrCreateAudioContext();
    try {
      const buffer = await generateProceduralAudioBuffer(ctx, track.id);
      currentBufferRef.current = buffer;
      setDuration(buffer.duration);
      return buffer;
    } catch (err) {
      console.error('Error generating audio buffer:', err);
      return null;
    }
  }, [getOrCreateAudioContext]);

  // Load custom uploaded audio from server
  const loadCustomAudioBuffer = useCallback(async (audioUrl: string) => {
    const ctx = getOrCreateAudioContext();
    try {
      const resp = await fetch(audioUrl);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      currentBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);
      return audioBuffer;
    } catch (err) {
      console.error('Failed to load custom audio:', err);
      return null;
    }
  }, [getOrCreateAudioContext]);

  // Execute NTP Burst Handshake (10 bursts)
  const startNTPHandshake = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || isSyncingRef.current) return;

    isSyncingRef.current = true;
    ntpBurstsRef.current = [];
    setSyncState('SYNCING');
    setHandshakeProgress(10);

    const TOTAL_BURSTS = 10;
    let burstIndex = 0;

    const sendBurst = () => {
      if (burstIndex >= TOTAL_BURSTS) return;
      const t0 = Date.now();
      ws.send(
        JSON.stringify({
          type: 'NTP_PING',
          t0,
          burstIndex,
          totalBursts: TOTAL_BURSTS,
        })
      );
      burstIndex++;
    };

    sendBurst();
  }, []);

  // Refs to stabilize WebSocket and prevent reconnection thrashing
  const roundTripTimeRef = useRef(roundTripTime);
  roundTripTimeRef.current = roundTripTime;
  const jitterRef = useRef(jitter);
  jitterRef.current = jitter;
  const driftMsRef = useRef(driftMs);
  driftMsRef.current = driftMs;
  const syncStateRef = useRef(syncState);
  syncStateRef.current = syncState;
  const isArmedRef = useRef(isArmed);
  isArmedRef.current = isArmed;
  const batterySaverRef = useRef(batterySaver);
  batterySaverRef.current = batterySaver;
  const physicalDistanceMetersRef = useRef(physicalDistanceMeters);
  physicalDistanceMetersRef.current = physicalDistanceMeters;
  const activeChannelRef = useRef(activeChannel);
  activeChannelRef.current = activeChannel;
  const roleRef = useRef(role);
  roleRef.current = role;
  const deviceNameRef = useRef(deviceName);
  deviceNameRef.current = deviceName;
  const onKickedRef = useRef(onKicked);
  onKickedRef.current = onKicked;
  const onHostDisconnectedRef = useRef(onHostDisconnected);
  onHostDisconnectedRef.current = onHostDisconnected;

  // Send Telemetry to Server
  const sendTelemetry = useCallback((customProps: Partial<DeviceTelemetry> = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: 'DEVICE_TELEMETRY',
        ping: roundTripTimeRef.current,
        offset: clockOffsetRef.current,
        jitter: jitterRef.current,
        driftMs: driftMsRef.current,
        status: syncStateRef.current,
        armed: isArmedRef.current,
        batterySaver: batterySaverRef.current,
        acousticOffsetMs: acousticOffsetRef.current,
        distanceMeters: physicalDistanceMetersRef.current,
        channel: activeChannelRef.current,
        ...customProps,
      })
    );
  }, []);

  // Stop current Web Audio Source
  const stopAudioSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    playScheduleRef.current = null;
    setIsPlaying(false);
  }, []);

  // Schedule Audio Node for Universal Timestamp
  const scheduleAudioPlayback = useCallback((
    startServerTime: number,
    startPositionSec: number
  ) => {
    const ctx = getOrCreateAudioContext();
    const buffer = currentBufferRef.current;
    if (!ctx || !buffer) {
      console.warn('AudioContext or Buffer not ready for scheduled playback');
      return;
    }

    // Stop any existing playback
    stopAudioSource();

    // Calculate exact AudioContext scheduling time
    const { scheduleTimeAudioCtx, delaySeconds, isLate } = calculateScheduledAudioTime(
      startServerTime,
      clockOffsetRef.current,
      Date.now(),
      ctx.currentTime,
      acousticOffsetRef.current
    );

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Connect node chain
    const masterGain = gainNodeRef.current;
    const panner = pannerNodeRef.current;
    const subFilter = subFilterRef.current;

    if (activeChannel === 'subwoofer' && subFilter && masterGain) {
      source.connect(subFilter);
      subFilter.connect(masterGain);
    } else if (panner && masterGain) {
      source.connect(panner);
      panner.connect(masterGain);
    } else if (masterGain) {
      source.connect(masterGain);
    } else {
      source.connect(ctx.destination);
    }

    const offsetSeconds = isLate ? startPositionSec + Math.abs(delaySeconds) : startPositionSec;
    if (offsetSeconds < buffer.duration) {
      source.start(scheduleTimeAudioCtx, offsetSeconds);
      sourceNodeRef.current = source;
      playScheduleRef.current = {
        startServerTime,
        startPositionSec: offsetSeconds,
        localScheduledTime: Date.now() + Math.max(0, delaySeconds * 1000),
        audioCtxStartTime: scheduleTimeAudioCtx,
      };
      setIsPlaying(true);
      setPlaybackPosition(offsetSeconds);
    }

    source.onended = () => {
      if (sourceNodeRef.current === source) {
        setIsPlaying(false);
        sourceNodeRef.current = null;
        playScheduleRef.current = null;
      }
    };
  }, [getOrCreateAudioContext, stopAudioSource, activeChannel]);

  // Continuous Drift Monitoring Loop (every 2.5s)
  useEffect(() => {
    if (!isPlaying) {
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
      return;
    }

    driftIntervalRef.current = setInterval(() => {
      const schedule = playScheduleRef.current;
      const ctx = audioCtxRef.current;
      const source = sourceNodeRef.current;
      if (!schedule || !ctx || !source) return;

      // Current synced server time
      const currentServerTime = Date.now() + clockOffsetRef.current;
      const serverElapsedSec = (currentServerTime - schedule.startServerTime) / 1000;
      const expectedTrackPosition = schedule.startPositionSec + Math.max(0, serverElapsedSec);

      // Actual local audio context playback position
      const audioElapsedSec = ctx.currentTime - schedule.audioCtxStartTime;
      const actualTrackPosition = schedule.startPositionSec + Math.max(0, audioElapsedSec);

      setPlaybackPosition(actualTrackPosition);

      // Evaluate drift
      const action = evaluateDriftCorrection(actualTrackPosition, expectedTrackPosition);
      setDriftMs(action.driftMs);

      if (action.type === 'IN_PHASE') {
        setSyncState('LOCKED');
      } else if (action.type === 'GLIDE') {
        setSyncState('LOCKED');
        // Gently adjust playbackRate to glide back into phase without clicks
        try {
          source.playbackRate.setValueAtTime(action.suggestedPlaybackRate, ctx.currentTime);
          setTimeout(() => {
            if (sourceNodeRef.current === source) {
              source.playbackRate.setValueAtTime(1.0, ctx.currentTime);
            }
          }, action.durationMs);
        } catch (e) {}
      } else if (action.type === 'MICRO_SEEK') {
        setSyncState('DRIFTED');
        // Re-schedule cleanly
        const nextLookahead = 400; // fast micro-resync
        const nextServerTime = currentServerTime + nextLookahead;
        scheduleAudioPlayback(nextServerTime, action.targetTrackPosition + nextLookahead / 1000);
      }

      sendTelemetry({ driftMs: action.driftMs, status: syncState });
    }, 2500);

    return () => {
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
    };
  }, [isPlaying, scheduleAudioPlayback, sendTelemetry, syncState]);

  // Function refs to avoid triggering WebSocket reconnects
  const scheduleAudioPlaybackRef = useRef(scheduleAudioPlayback);
  scheduleAudioPlaybackRef.current = scheduleAudioPlayback;
  const stopAudioSourceRef = useRef(stopAudioSource);
  stopAudioSourceRef.current = stopAudioSource;
  const loadTrackBufferRef = useRef(loadTrackBuffer);
  loadTrackBufferRef.current = loadTrackBuffer;
  const loadCustomAudioBufferRef = useRef(loadCustomAudioBuffer);
  loadCustomAudioBufferRef.current = loadCustomAudioBuffer;
  const startNTPHandshakeRef = useRef(startNTPHandshake);
  startNTPHandshakeRef.current = startNTPHandshake;
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const hasCustomAudioRef = useRef(hasCustomAudio);
  hasCustomAudioRef.current = hasCustomAudio;

  // WebSocket Connection & Protocol Handler
  useEffect(() => {
    if (!roomCode) return;

    let isMounted = true;
    const ws = new WebSocket("wss://syncpulse-0gq1.onrender.com/ws");

    ws.onopen = () => {
      if (!isMounted) {
        ws.close();
        return;
      }
      setIsConnected(true);
      // Send JOIN
      ws.send(
        JSON.stringify({
          type: 'JOIN',
          roomCode,
          role: roleRef.current,
          deviceId,
          deviceName: deviceNameRef.current,
          channel: activeChannelRef.current,
        })
      );
      // Run initial 10-burst NTP sync handshake
      setTimeout(() => {
        if (isMounted) startNTPHandshakeRef.current();
      }, 300);
    };

    ws.onmessage = async (event) => {
      const t3 = Date.now(); // Client receive timestamp for NTP
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }

      // 1. NTP Pong
      if (msg.type === 'NTP_PONG') {
        ntpBurstsRef.current.push({
          t0: msg.t0,
          t1: msg.t1,
          t2: msg.t2,
          t3,
        });

        const progress = Math.min(100, Math.round((ntpBurstsRef.current.length / 10) * 100));
        setHandshakeProgress(progress);

        if (ntpBurstsRef.current.length < 10) {
          // Immediately send next burst with slight 20ms pacing
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const nextT0 = Date.now();
              ws.send(
                JSON.stringify({
                  type: 'NTP_PING',
                  t0: nextT0,
                  burstIndex: ntpBurstsRef.current.length,
                  totalBursts: 10,
                })
              );
            }
          }, 25);
        } else {
          // Handshake complete! Run robust outlier rejection filter
          const result: NTPSyncResult = computeRobustNTPOffset(ntpBurstsRef.current);
          setRoundTripTime(result.roundTripTime);
          setClockOffset(result.clockOffset);
          setJitter(result.jitter);
          clockOffsetRef.current = result.clockOffset;
          isSyncingRef.current = false;
          setSyncState('LOCKED');

          sendTelemetry({
            ping: result.roundTripTime,
            offset: result.clockOffset,
            jitter: result.jitter,
            status: 'LOCKED',
          });
        }
        return;
      }

      // 2. Mesh Update
      if (msg.type === 'MESH_UPDATE') {
        setConnectedDevices(msg.devices || []);
        if (msg.queue) {
          setPartyQueue(msg.queue);
        }
        if (msg.hasCustomAudio !== undefined) {
          setHasCustomAudio(msg.hasCustomAudio);
          setCustomAudioName(msg.customAudioName || null);
        }
        return;
      }

      // 3. Play Scheduled from Host
      if (msg.type === 'PLAY_SCHEDULED') {
        // Pre-buffer if previewUrl or custom audio
        if (msg.previewUrl) {
          setCurrentTrack({
            id: msg.trackId,
            title: msg.trackTitle || 'Streaming Track',
            artist: msg.trackArtist || 'Streaming Artist',
            duration: msg.trackDuration || 30,
            bpm: 120,
            genre: msg.provider === 'spotify' ? 'Spotify Sync' : 'Apple Music Sync',
            description: 'Synchronized Streaming Mesh Track',
            color: msg.provider === 'spotify' ? 'from-emerald-500 to-green-600' : 'from-rose-500 to-pink-600',
          });
          await loadCustomAudioBufferRef.current(msg.previewUrl);
        } else if (!currentBufferRef.current) {
          if (hasCustomAudioRef.current) {
            await loadCustomAudioBufferRef.current(`/api/rooms/${roomCode}/audio`);
          } else {
            await loadTrackBufferRef.current(currentTrackRef.current);
          }
        }
        scheduleAudioPlaybackRef.current(msg.startServerTime, msg.positionSec);
        return;
      }

      // 4. Playback Paused
      if (msg.type === 'PLAYBACK_PAUSED') {
        stopAudioSourceRef.current();
        setPlaybackPosition(msg.positionSec);
        return;
      }

      // 5. Playback Seeked
      if (msg.type === 'PLAYBACK_SEEKED') {
        if (msg.isPlaying) {
          scheduleAudioPlaybackRef.current(msg.startServerTime, msg.positionSec);
        } else {
          stopAudioSourceRef.current();
          setPlaybackPosition(msg.positionSec);
        }
        return;
      }

      // 6. Track Changed
      if (msg.type === 'TRACK_CHANGED') {
        stopAudioSourceRef.current();
        setCurrentTrack(msg.track);
        setPlaybackPosition(0);
        await loadTrackBufferRef.current(msg.track);
        return;
      }

      // 7. Custom Audio Ready
      if (msg.type === 'CUSTOM_AUDIO_READY') {
        stopAudioSourceRef.current();
        setHasCustomAudio(true);
        setCustomAudioName(msg.trackTitle);
        setCurrentTrack({
          id: msg.trackId,
          title: msg.trackTitle,
          artist: msg.trackArtist,
          duration: 0,
          bpm: 120,
          genre: 'Custom Master',
          description: 'Uploaded by Host',
          color: 'from-emerald-500 to-cyan-500',
        });
        await loadCustomAudioBufferRef.current(msg.audioUrl);
        return;
      }

      // 8. Force Resync
      if (msg.type === 'FORCE_RESYNC') {
        startNTPHandshake();
        return;
      }

      // 9. Host Mute / Kick / Channel Commands
      if (msg.type === 'SET_MUTE') {
        setIsMuted(!!msg.muted);
        return;
      }
      if (msg.type === 'SET_CHANNEL') {
        setActiveChannel(msg.channel);
        return;
      }
      if (msg.type === 'PLAY_TEST_CHIME') {
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const chimeGain = ctx.createGain();

        if (msg.channel === 'subwoofer') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(90, now);
          osc.frequency.exponentialRampToValueAtTime(45, now + 0.4);
          chimeGain.gain.setValueAtTime(0.8, now);
          chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        } else {
          osc.type = 'triangle';
          const freq = msg.channel === 'left' ? 523.25 : msg.channel === 'right' ? 659.25 : 587.33; // C5 / E5 / D5
          osc.frequency.setValueAtTime(freq, now);
          chimeGain.gain.setValueAtTime(0.5, now);
          chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        }

        osc.connect(chimeGain);
        chimeGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
        return;
      }
      if (msg.type === 'KICKED') {
        stopAudioSourceRef.current();
        onKickedRef.current?.();
        return;
      }
      if (msg.type === 'HOST_DISCONNECTED') {
        onHostDisconnectedRef.current?.();
        return;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      isMounted = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else {
        ws.onopen = () => ws.close();
      }
      stopAudioSourceRef.current();
    };
  }, [roomCode, deviceId, sendTelemetry, getOrCreateAudioContext]);

  // Pre-load default track initially
  useEffect(() => {
    loadTrackBuffer(currentTrack);
  }, [currentTrack, loadTrackBuffer]);

  // Host Actions
  const hostPlay = useCallback(() => {
    if (role !== 'host' || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'HOST_PLAY',
        trackId: currentTrack.id,
        positionSec: playbackPosition,
        lookaheadMs,
      })
    );
  }, [role, currentTrack.id, playbackPosition, lookaheadMs]);

  const hostPause = useCallback(() => {
    if (role !== 'host' || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'HOST_PAUSE',
        positionSec: playbackPosition,
      })
    );
  }, [role, playbackPosition]);

  const hostSeek = useCallback((newPositionSec: number) => {
    if (role !== 'host' || !wsRef.current) return;
    setPlaybackPosition(newPositionSec);
    wsRef.current.send(
      JSON.stringify({
        type: 'HOST_SEEK',
        positionSec: newPositionSec,
      })
    );
  }, [role]);

  const hostChangeTrack = useCallback((track: TrackMetadata) => {
    if (role !== 'host' || !wsRef.current) return;
    setCurrentTrack(track);
    wsRef.current.send(
      JSON.stringify({
        type: 'HOST_TRACK_CHANGE',
        track,
      })
    );
  }, [role]);

  const hostResyncAll = useCallback(() => {
    if (role !== 'host' || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'HOST_RESYNC',
      })
    );
    startNTPHandshake();
  }, [role, startNTPHandshake]);

  const hostMuteDevice = useCallback((targetDeviceId: string, muted: boolean) => {
    if (role !== 'host' || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'MUTE_DEVICE',
        targetDeviceId,
        muted,
      })
    );
  }, [role]);

  const hostKickDevice = useCallback((targetDeviceId: string) => {
    if (role !== 'host' || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'KICK_DEVICE',
        targetDeviceId,
      })
    );
  }, [role]);

  const hostSetDeviceChannel = useCallback((targetDeviceId: string, channel: string) => {
    if (role !== 'host' || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'SET_CHANNEL',
        targetDeviceId,
        channel,
      })
    );
  }, [role]);

  // Acoustic Calibration Offset (+/- 5ms slider or distance in meters)
  const adjustAcousticOffset = useCallback((deltaMs: number) => {
    setAcousticOffsetMs((prev) => {
      const next = Math.max(-50, Math.min(50, prev + deltaMs));
      acousticOffsetRef.current = next;
      sendTelemetry({ acousticOffsetMs: next });
      return next;
    });
  }, [sendTelemetry]);

  const setPhysicalDistance = useCallback((meters: number) => {
    setPhysicalDistanceMeters(meters);
    const ms = calculateAcousticDelayMs(meters);
    setAcousticOffsetMs(ms);
    acousticOffsetRef.current = ms;
    sendTelemetry({ acousticOffsetMs: ms, distanceMeters: meters });
  }, [sendTelemetry]);

  // Party Queue Action Callbacks
  const addToPartyQueue = useCallback((track: StreamingTrack) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'QUEUE_ADD', track }));
  }, []);

  const removeFromPartyQueue = useCallback((queueId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'QUEUE_REMOVE', queueId }));
  }, []);

  const reorderPartyQueue = useCallback((fromIndex: number, toIndex: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'QUEUE_REORDER', fromIndex, toIndex }));
  }, []);

  const voteInPartyQueue = useCallback((queueId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'QUEUE_VOTE', queueId }));
  }, []);

  const playQueuedTrack = useCallback((queueId: string, track?: StreamingTrack) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'QUEUE_PLAY_TRACK', queueId, track }));
  }, []);

  const playNextInQueue = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'QUEUE_NEXT' }));
  }, []);

  const hostBatchSetChannel = useCallback((deviceIds: string[], channel: string) => {
    if (role !== 'host' || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'BATCH_SET_CHANNEL',
        deviceIds,
        channel,
      })
    );
  }, [role]);

  const hostTestChannelPing = useCallback((channel: string) => {
    if (role !== 'host' || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'TEST_CHANNEL_PING',
        channel,
      })
    );
  }, [role]);

  return {
    deviceId,
    isConnected,
    isArmed,
    armSpeaker,
    syncState,
    roundTripTime,
    clockOffset,
    jitter,
    driftMs,
    handshakeProgress,
    startNTPHandshake,
    isPlaying,
    playbackPosition,
    duration,
    currentTrack,
    lookaheadMs,
    setLookaheadMs,
    activeChannel,
    setActiveChannel,
    isMuted,
    setIsMuted,
    acousticOffsetMs,
    setAcousticOffsetMs,
    adjustAcousticOffset,
    physicalDistanceMeters,
    setPhysicalDistance,
    connectedDevices,
    partyQueue,
    addToPartyQueue,
    removeFromPartyQueue,
    reorderPartyQueue,
    voteInPartyQueue,
    playQueuedTrack,
    playNextInQueue,
    hasCustomAudio,
    customAudioName,
    batterySaver,
    setBatterySaver,
    wakeLockActive,
    analyserNode: analyserRef.current,
    audioContext: audioCtxRef.current,
    hostPlay,
    hostPause,
    hostSeek,
    hostChangeTrack,
    hostResyncAll,
    hostMuteDevice,
    hostKickDevice,
    hostSetDeviceChannel,
    hostBatchSetChannel,
    hostTestChannelPing,
    loadCustomAudioBuffer,
  };
}
