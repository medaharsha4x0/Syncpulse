import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

import {
  QueuedTrack,
  StreamingTrack,
  addToQueue,
  removeFromQueue,
  reorderQueue,
  voteTrackInQueue,
  advanceQueue,
  normalizeTrack,
} from './src/utils/streamingQueue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConnectedDevice {
  ws: WebSocket;
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
  joinedAt: number;
}

interface RoomPlaybackState {
  isPlaying: boolean;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackDuration: number;
  isCustomUpload: boolean;
  previewUrl?: string | null;
  trackArtwork?: string;
  provider?: string;
  startServerTime: number; // Scheduled universal epoch ms
  startPositionSec: number;
  playbackRate: number;
  lookaheadMs: number;
}

interface Room {
  code: string;
  createdAt: number;
  hostWs: WebSocket | null;
  hostDeviceId: string | null;
  devices: Map<string, ConnectedDevice>;
  playbackState: RoomPlaybackState;
  queue: QueuedTrack[];
  queueHistory: QueuedTrack[];
  customAudio: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
  } | null;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function getOrCreateRoom(code: string): Room {
  const upper = code.trim().toUpperCase();
  let room = rooms.get(upper);
  if (!room) {
    room = {
      code: upper,
      createdAt: Date.now(),
      hostWs: null,
      hostDeviceId: null,
      devices: new Map(),
      playbackState: {
        isPlaying: false,
        trackId: 'cyber-neon-pulse',
        trackTitle: 'Cyber Neon Pulse',
        trackArtist: 'SyncPulse Lab',
        trackDuration: 64,
        isCustomUpload: false,
        previewUrl: null,
        trackArtwork: '',
        provider: 'local',
        startServerTime: 0,
        startPositionSec: 0,
        playbackRate: 1.0,
        lookaheadMs: 1500,
      },
      queue: [],
      queueHistory: [],
      customAudio: null,
    };
    rooms.set(upper, room);
  }
  return room;
}

function broadcastToRoom(room: Room, message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const device of room.devices.values()) {
    if (device.ws !== excludeWs && device.ws.readyState === WebSocket.OPEN) {
      device.ws.send(payload);
    }
  }
}

function broadcastMeshState(room: Room) {
  const deviceList = Array.from(room.devices.values()).map((d) => ({
    deviceId: d.deviceId,
    deviceName: d.deviceName,
    role: d.role,
    channel: d.channel,
    muted: d.muted,
    ping: d.ping,
    offset: d.offset,
    jitter: d.jitter,
    driftMs: d.driftMs,
    status: d.status,
    armed: d.armed,
    batterySaver: d.batterySaver,
    acousticOffsetMs: d.acousticOffsetMs,
    distanceMeters: d.distanceMeters,
    angleDeg: d.angleDeg,
  }));

  const message = {
    type: 'MESH_UPDATE',
    roomCode: room.code,
    devices: deviceList,
    deviceCount: deviceList.length,
    playbackState: room.playbackState,
    queue: room.queue,
    hasCustomAudio: !!room.customAudio,
    customAudioName: room.customAudio?.filename,
  };

  broadcastToRoom(room, message);
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '60mb' }));
  app.use(express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '60mb' }));

  // REST API Endpoints
  app.post('/api/rooms', (req, res) => {
    const code = generateRoomCode();
    const room = getOrCreateRoom(code);
    res.json({ success: true, roomCode: room.code });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({
      success: true,
      roomCode: room.code,
      deviceCount: room.devices.size,
      hasHost: !!room.hostWs,
      playbackState: room.playbackState,
      hasCustomAudio: !!room.customAudio,
      customAudioName: room.customAudio?.filename,
    });
  });

  // Custom audio upload for room
  app.post('/api/rooms/:code/audio', (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = getOrCreateRoom(code);

    let audioBuffer: Buffer;
    let mimeType = 'audio/mpeg';
    let filename = 'custom-audio.mp3';

    if (Buffer.isBuffer(req.body)) {
      audioBuffer = req.body;
      mimeType = (req.headers['content-type'] as string) || 'audio/mpeg';
      filename = (req.headers['x-filename'] as string) || 'uploaded-track.mp3';
    } else if (req.body && req.body.base64) {
      audioBuffer = Buffer.from(req.body.base64, 'base64');
      mimeType = req.body.mimeType || 'audio/mpeg';
      filename = req.body.filename || 'uploaded-track.mp3';
    } else {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    room.customAudio = {
      buffer: audioBuffer,
      mimeType,
      filename,
    };

    room.playbackState.isCustomUpload = true;
    room.playbackState.trackId = 'custom-' + Date.now();
    room.playbackState.trackTitle = filename.replace(/\.[^/.]+$/, '');
    room.playbackState.trackArtist = 'Host Upload';
    room.playbackState.isPlaying = false;
    room.playbackState.startPositionSec = 0;

    broadcastToRoom(room, {
      type: 'CUSTOM_AUDIO_READY',
      trackId: room.playbackState.trackId,
      trackTitle: room.playbackState.trackTitle,
      trackArtist: room.playbackState.trackArtist,
      audioUrl: `/api/rooms/${room.code}/audio`,
    });

    broadcastMeshState(room);

    res.json({
      success: true,
      audioUrl: `/api/rooms/${room.code}/audio`,
      filename,
      size: audioBuffer.length,
    });
  });

  app.get('/api/rooms/:code/audio', (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room || !room.customAudio) {
      return res.status(404).json({ error: 'Audio not found' });
    }

    res.setHeader('Content-Type', room.customAudio.mimeType);
    res.setHeader('Content-Length', room.customAudio.buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(room.customAudio.buffer);
  });

  // Spotify Token Caching Helper
  let spotifyAccessToken: string | null = null;
  let spotifyTokenExpiresAt = 0;

  async function getSpotifyToken(): Promise<string | null> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    if (spotifyAccessToken && Date.now() < spotifyTokenExpiresAt - 60000) {
      return spotifyAccessToken;
    }

    try {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      spotifyAccessToken = data.access_token;
      spotifyTokenExpiresAt = Date.now() + (data.expires_in * 1000);
      return spotifyAccessToken;
    } catch (err) {
      return null;
    }
  }

  // Streaming Music Search API (Apple Music & Spotify)
  app.get('/api/music/search', async (req, res) => {
    const query = (req.query.q as string || '').trim();
    const provider = ((req.query.provider as string) || 'apple-music').toLowerCase();

    if (!query) {
      return res.json({ success: true, tracks: [] });
    }

    try {
      if (provider === 'spotify') {
        const token = await getSpotifyToken();
        if (token) {
          const resp = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            const tracks = (data.tracks?.items || []).map((t: any) => normalizeTrack(t, 'spotify'));
            return res.json({ success: true, provider: 'spotify', isLiveApi: true, tracks });
          }
        }

        // Seamless fallback to Apple Music / iTunes high-fidelity audio streams with Spotify presentation
        const itunesResp = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=20`
        );
        const itunesData = await itunesResp.json();
        const tracks = (itunesData.results || []).map((t: any) => {
          const norm = normalizeTrack(t, 'apple-music');
          return {
            ...norm,
            provider: 'spotify',
            id: `spot_${t.trackId}`,
          };
        });
        return res.json({
          success: true,
          provider: 'spotify',
          isLiveApi: false,
          tracks,
          note: 'Spotify Preview Stream (Synced Web Audio)',
        });
      }

      // Default: Apple Music / iTunes Search API
      const resp = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=25`
      );
      const data = await resp.json();
      const tracks = (data.results || []).map((t: any) => normalizeTrack(t, 'apple-music'));
      return res.json({ success: true, provider: 'apple-music', isLiveApi: true, tracks });
    } catch (err: any) {
      console.error('Music search error:', err);
      return res.status(500).json({ error: 'Search failed' });
    }
  });

  // Streaming Configuration & Capabilities Endpoint
  app.get('/api/streaming/config', (req, res) => {
    res.json({
      spotifyConfigured: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      appleMusicConfigured: true,
      features: {
        partyQueue: true,
        synchronizedPreviewMesh: true,
        drmFairPlayWidevineProtected: true,
        description:
          'Commercial music services enforce FairPlay and Widevine DRM encryption preventing raw PCM distribution. SyncPulse enables synchronized high-definition streaming preview arrays, custom full-length audio tracks, and native companion deep-linking.',
      },
    });
  });

  // WebSocket Server Setup
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    let currentRoom: Room | null = null;
    let currentDeviceId: string | null = null;

    ws.on('message', (raw) => {
      const serverReceiveTime = Date.now();
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch (err) {
        return;
      }

      // Fast NTP Ping-Pong Handshake
      if (data.type === 'NTP_PING') {
        const serverTransmitTime = Date.now();
        ws.send(
          JSON.stringify({
            type: 'NTP_PONG',
            t0: data.t0,
            t1: serverReceiveTime,
            t2: serverTransmitTime,
            burstIndex: data.burstIndex,
            totalBursts: data.totalBursts,
          })
        );
        return;
      }

      // Join Room
      if (data.type === 'JOIN') {
        const roomCode = (data.roomCode || '').toUpperCase().trim();
        if (!roomCode) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room code required' }));
          return;
        }

        currentRoom = getOrCreateRoom(roomCode);
        const devId = data.deviceId || 'dev_' + Math.random().toString(36).substring(2, 9);
        currentDeviceId = devId;
        const role = data.role === 'host' ? 'host' : 'guest';

        // Assign angle on radar circle
        const existingCount = currentRoom.devices.size;
        const angleDeg = (existingCount * 60) % 360;
        const distanceMeters = Math.min(5, Math.max(1.2, 1.5 + (existingCount * 0.4)));

        const device: ConnectedDevice = {
          ws,
          deviceId: devId,
          deviceName: data.deviceName || (role === 'host' ? 'Master Host Console' : `Speaker Node #${existingCount + 1}`),
          role,
          channel: data.channel || 'all',
          muted: false,
          ping: 0,
          offset: 0,
          jitter: 0,
          driftMs: 0,
          status: 'SYNCING',
          armed: false,
          batterySaver: false,
          acousticOffsetMs: 0,
          distanceMeters: Math.round(distanceMeters * 10) / 10,
          angleDeg,
          joinedAt: Date.now(),
        };

        if (role === 'host') {
          currentRoom.hostWs = ws;
          currentRoom.hostDeviceId = devId;
        }

        currentRoom.devices.set(devId, device);

        ws.send(
          JSON.stringify({
            type: 'JOINED_SUCCESS',
            roomCode: currentRoom.code,
            deviceId: currentDeviceId,
            role,
            playbackState: currentRoom.playbackState,
            hasCustomAudio: !!currentRoom.customAudio,
          })
        );

        broadcastMeshState(currentRoom);
        return;
      }

      if (!currentRoom || !currentDeviceId) return;

      // Guest Device Telemetry Update
      if (data.type === 'DEVICE_TELEMETRY') {
        const dev = currentRoom.devices.get(currentDeviceId);
        if (dev) {
          if (data.ping !== undefined) dev.ping = data.ping;
          if (data.offset !== undefined) dev.offset = data.offset;
          if (data.jitter !== undefined) dev.jitter = data.jitter;
          if (data.driftMs !== undefined) dev.driftMs = data.driftMs;
          if (data.status !== undefined) dev.status = data.status;
          if (data.armed !== undefined) dev.armed = data.armed;
          if (data.batterySaver !== undefined) dev.batterySaver = data.batterySaver;
          if (data.acousticOffsetMs !== undefined) dev.acousticOffsetMs = data.acousticOffsetMs;
          if (data.distanceMeters !== undefined) dev.distanceMeters = data.distanceMeters;
          if (data.channel !== undefined) dev.channel = data.channel;
          broadcastMeshState(currentRoom);
        }
        return;
      }

      // Host Audio Playback Control Actions
      const isHost = currentRoom.hostWs === ws || currentRoom.hostDeviceId === currentDeviceId;

      if (data.type === 'HOST_PLAY' && isHost) {
        const lookaheadMs = data.lookaheadMs || currentRoom.playbackState.lookaheadMs || 1500;
        const startServerTime = Date.now() + lookaheadMs;
        const positionSec = data.positionSec ?? currentRoom.playbackState.startPositionSec ?? 0;

        currentRoom.playbackState.isPlaying = true;
        currentRoom.playbackState.startServerTime = startServerTime;
        currentRoom.playbackState.startPositionSec = positionSec;
        currentRoom.playbackState.lookaheadMs = lookaheadMs;
        if (data.trackId) currentRoom.playbackState.trackId = data.trackId;

        broadcastToRoom(currentRoom, {
          type: 'PLAY_SCHEDULED',
          startServerTime,
          positionSec,
          trackId: currentRoom.playbackState.trackId,
          lookaheadMs,
        });

        broadcastMeshState(currentRoom);
        return;
      }

      if (data.type === 'HOST_PAUSE' && isHost) {
        currentRoom.playbackState.isPlaying = false;
        currentRoom.playbackState.startPositionSec = data.positionSec ?? 0;

        broadcastToRoom(currentRoom, {
          type: 'PLAYBACK_PAUSED',
          positionSec: currentRoom.playbackState.startPositionSec,
        });

        broadcastMeshState(currentRoom);
        return;
      }

      if (data.type === 'HOST_SEEK' && isHost) {
        const lookaheadMs = currentRoom.playbackState.lookaheadMs || 1500;
        const startServerTime = Date.now() + lookaheadMs;
        currentRoom.playbackState.startPositionSec = data.positionSec;
        currentRoom.playbackState.startServerTime = startServerTime;

        broadcastToRoom(currentRoom, {
          type: 'PLAYBACK_SEEKED',
          startServerTime,
          positionSec: data.positionSec,
          isPlaying: currentRoom.playbackState.isPlaying,
        });

        broadcastMeshState(currentRoom);
        return;
      }

      if (data.type === 'HOST_TRACK_CHANGE' && isHost) {
        currentRoom.playbackState.trackId = data.track.id;
        currentRoom.playbackState.trackTitle = data.track.title;
        currentRoom.playbackState.trackArtist = data.track.artist;
        currentRoom.playbackState.trackDuration = data.track.duration;
        currentRoom.playbackState.isCustomUpload = false;
        currentRoom.playbackState.isPlaying = false;
        currentRoom.playbackState.startPositionSec = 0;

        broadcastToRoom(currentRoom, {
          type: 'TRACK_CHANGED',
          track: data.track,
        });

        broadcastMeshState(currentRoom);
        return;
      }

      if (data.type === 'HOST_RESYNC' && isHost) {
        broadcastToRoom(currentRoom, {
          type: 'FORCE_RESYNC',
        });
        return;
      }

      if (data.type === 'MUTE_DEVICE' && isHost) {
        const target = currentRoom.devices.get(data.targetDeviceId);
        if (target) {
          target.muted = !!data.muted;
          target.ws.send(JSON.stringify({ type: 'SET_MUTE', muted: target.muted }));
          broadcastMeshState(currentRoom);
        }
        return;
      }

      if (data.type === 'KICK_DEVICE' && isHost) {
        const target = currentRoom.devices.get(data.targetDeviceId);
        if (target) {
          target.ws.send(JSON.stringify({ type: 'KICKED', reason: 'Removed by host' }));
          target.ws.close();
          currentRoom.devices.delete(data.targetDeviceId);
          broadcastMeshState(currentRoom);
        }
        return;
      }

      if (data.type === 'SET_CHANNEL' && isHost) {
        const target = currentRoom.devices.get(data.targetDeviceId);
        if (target) {
          target.channel = data.channel;
          target.ws.send(JSON.stringify({ type: 'SET_CHANNEL', channel: data.channel }));
          broadcastMeshState(currentRoom);
        }
        return;
      }

      if (data.type === 'BATCH_SET_CHANNEL' && isHost) {
        const deviceIds: string[] = data.deviceIds || [];
        const channel: string = data.channel;
        for (const devId of deviceIds) {
          const target = currentRoom.devices.get(devId);
          if (target) {
            target.channel = channel;
            target.ws.send(JSON.stringify({ type: 'SET_CHANNEL', channel }));
          }
        }
        broadcastMeshState(currentRoom);
        return;
      }

      if (data.type === 'TEST_CHANNEL_PING' && isHost) {
        const targetChannel: string = data.channel;
        for (const dev of currentRoom.devices.values()) {
          if (targetChannel === 'all' || dev.channel === targetChannel) {
            dev.ws.send(JSON.stringify({ type: 'PLAY_TEST_CHIME', channel: targetChannel }));
          }
        }
        return;
      }

      // Party Queue Operations
      if (data.type === 'QUEUE_ADD') {
        const dev = currentRoom.devices.get(currentDeviceId);
        currentRoom.queue = addToQueue(
          currentRoom.queue,
          data.track,
          dev?.deviceName || (isHost ? 'Host' : 'Guest')
        );
        broadcastMeshState(currentRoom);
        return;
      }

      if (data.type === 'QUEUE_REMOVE' && isHost) {
        currentRoom.queue = removeFromQueue(currentRoom.queue, data.queueId);
        broadcastMeshState(currentRoom);
        return;
      }

      if (data.type === 'QUEUE_REORDER' && isHost) {
        currentRoom.queue = reorderQueue(currentRoom.queue, data.fromIndex, data.toIndex);
        broadcastMeshState(currentRoom);
        return;
      }

      if (data.type === 'QUEUE_VOTE') {
        currentRoom.queue = voteTrackInQueue(currentRoom.queue, data.queueId, currentDeviceId);
        broadcastMeshState(currentRoom);
        return;
      }

      if (data.type === 'QUEUE_PLAY_TRACK' && isHost) {
        const targetTrack = currentRoom.queue.find((t) => t.queueId === data.queueId) || data.track;
        if (targetTrack) {
          const lookaheadMs = currentRoom.playbackState.lookaheadMs || 1500;
          const startServerTime = Date.now() + lookaheadMs;

          currentRoom.playbackState.isPlaying = true;
          currentRoom.playbackState.trackId = targetTrack.id;
          currentRoom.playbackState.trackTitle = targetTrack.title;
          currentRoom.playbackState.trackArtist = targetTrack.artist;
          currentRoom.playbackState.trackDuration = Math.round(targetTrack.durationMs / 1000);
          currentRoom.playbackState.previewUrl = targetTrack.previewUrl;
          currentRoom.playbackState.trackArtwork = targetTrack.albumArt;
          currentRoom.playbackState.provider = targetTrack.provider;
          currentRoom.playbackState.isCustomUpload = false;
          currentRoom.playbackState.startServerTime = startServerTime;
          currentRoom.playbackState.startPositionSec = 0;

          // Remove played track from upcoming queue
          currentRoom.queue = currentRoom.queue.filter((t) => t.queueId !== data.queueId);

          broadcastToRoom(currentRoom, {
            type: 'PLAY_SCHEDULED',
            startServerTime,
            positionSec: 0,
            trackId: targetTrack.id,
            trackTitle: targetTrack.title,
            trackArtist: targetTrack.artist,
            trackDuration: currentRoom.playbackState.trackDuration,
            previewUrl: targetTrack.previewUrl,
            trackArtwork: targetTrack.albumArt,
            provider: targetTrack.provider,
            lookaheadMs,
          });

          broadcastMeshState(currentRoom);
        }
        return;
      }

      if (data.type === 'QUEUE_NEXT' && isHost) {
        if (currentRoom.queue.length > 0) {
          const nextTrack = currentRoom.queue[0];
          const lookaheadMs = currentRoom.playbackState.lookaheadMs || 1500;
          const startServerTime = Date.now() + lookaheadMs;

          currentRoom.playbackState.isPlaying = true;
          currentRoom.playbackState.trackId = nextTrack.id;
          currentRoom.playbackState.trackTitle = nextTrack.title;
          currentRoom.playbackState.trackArtist = nextTrack.artist;
          currentRoom.playbackState.trackDuration = Math.round(nextTrack.durationMs / 1000);
          currentRoom.playbackState.previewUrl = nextTrack.previewUrl;
          currentRoom.playbackState.trackArtwork = nextTrack.albumArt;
          currentRoom.playbackState.provider = nextTrack.provider;
          currentRoom.playbackState.isCustomUpload = false;
          currentRoom.playbackState.startServerTime = startServerTime;
          currentRoom.playbackState.startPositionSec = 0;

          currentRoom.queue = currentRoom.queue.slice(1);

          broadcastToRoom(currentRoom, {
            type: 'PLAY_SCHEDULED',
            startServerTime,
            positionSec: 0,
            trackId: nextTrack.id,
            trackTitle: nextTrack.title,
            trackArtist: nextTrack.artist,
            trackDuration: currentRoom.playbackState.trackDuration,
            previewUrl: nextTrack.previewUrl,
            trackArtwork: nextTrack.albumArt,
            provider: nextTrack.provider,
            lookaheadMs,
          });

          broadcastMeshState(currentRoom);
        }
        return;
      }
    });

    ws.on('close', () => {
      if (currentRoom && currentDeviceId) {
        const dev = currentRoom.devices.get(currentDeviceId);
        currentRoom.devices.delete(currentDeviceId);
        if (currentRoom.hostWs === ws) {
          currentRoom.hostWs = null;
          broadcastToRoom(currentRoom, {
            type: 'HOST_DISCONNECTED',
            message: 'Host has disconnected from this room.',
          });
        }
        broadcastMeshState(currentRoom);
      }
    });
  });

  // Vite Integration
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SyncPulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SyncPulse server:', err);
  process.exit(1);
});
