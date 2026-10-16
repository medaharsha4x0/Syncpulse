import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Music,
  Sliders,
  Volume2,
  VolumeX,
  Radio,
  Zap,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  Disc,
} from 'lucide-react';
import { SAMPLE_TRACKS, TrackMetadata } from '../utils/audioPresets';
import { AudioVisualizer } from './AudioVisualizer';
import { SpeakerRadar } from './SpeakerRadar';
import { RoomCodeCard } from './RoomCodeCard';
import { DynamicQRCodeWidget } from './DynamicQRCodeWidget';
import { StreamingMusicSearch } from './StreamingMusicSearch';
import { NativeCompanionArchitecture } from './NativeCompanionArchitecture';
import { DeviceTelemetry } from '../hooks/useAudioSync';
import { QueuedTrack, StreamingTrack } from '../utils/streamingQueue';

interface HostDashboardProps {
  roomCode: string;
  deviceId: string;
  isPlaying: boolean;
  playbackPosition: number;
  duration: number;
  currentTrack: TrackMetadata;
  lookaheadMs: number;
  setLookaheadMs: (ms: number) => void;
  connectedDevices: DeviceTelemetry[];
  partyQueue: QueuedTrack[];
  analyserNode: AnalyserNode | null;
  roundTripTime: number;
  clockOffset: number;
  jitter: number;
  driftMs: number;
  syncState: string;
  hasCustomAudio: boolean;
  customAudioName: string | null;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (position: number) => void;
  onChangeTrack: (track: TrackMetadata) => void;
  onResyncAll: () => void;
  onMuteDevice: (deviceId: string, muted: boolean) => void;
  onKickDevice: (deviceId: string) => void;
  onSetChannel: (deviceId: string, channel: string) => void;
  onUploadAudio: (file: File) => Promise<void>;
  onAddToQueue: (track: StreamingTrack) => void;
  onRemoveFromQueue: (queueId: string) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onVoteTrack: (queueId: string) => void;
  onPlayQueuedTrack: (queueId: string, track?: StreamingTrack) => void;
  onPlayNext: () => void;
  onLeaveRoom: () => void;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  roomCode,
  deviceId,
  isPlaying,
  playbackPosition,
  duration,
  currentTrack,
  lookaheadMs,
  setLookaheadMs,
  connectedDevices,
  partyQueue,
  analyserNode,
  roundTripTime,
  clockOffset,
  jitter,
  driftMs,
  syncState,
  hasCustomAudio,
  customAudioName,
  onPlay,
  onPause,
  onSeek,
  onChangeTrack,
  onResyncAll,
  onMuteDevice,
  onKickDevice,
  onSetChannel,
  onUploadAudio,
  onAddToQueue,
  onRemoveFromQueue,
  onReorderQueue,
  onVoteTrack,
  onPlayQueuedTrack,
  onPlayNext,
  onLeaveRoom,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showNativeSpecs, setShowNativeSpecs] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      await onUploadAudio(file);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      await onUploadAudio(file);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080C] text-zinc-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Navbar */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-[#10101A]/80 px-6 py-4 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-400 p-[2px] shadow-lg shadow-violet-600/30">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#08080C]">
                <Radio className="h-5 w-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">SyncPulse</h1>
                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-violet-300 border border-violet-500/30 uppercase">
                  Host Studio
                </span>
              </div>
              <p className="text-xs text-zinc-400">Zero-latency multi-speaker sound system</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Native Specs Toggle Button */}
            <button
              onClick={() => setShowNativeSpecs(!showNativeSpecs)}
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
                showNativeSpecs
                  ? 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white border-cyan-400/40 shadow-lg shadow-cyan-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              <span>Native Companion Specs</span>
            </button>

            {/* Live Clock Offset & Health */}
            <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Master Clock</span>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {clockOffset >= 0 ? `+${clockOffset}` : clockOffset}ms offset
                </span>
              </div>
              <div className="h-6 w-[1px] bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Jitter / RTT</span>
                <span className="text-xs font-mono font-bold text-violet-400">
                  ±{jitter}ms / {roundTripTime}ms
                </span>
              </div>
            </div>

            <button
              onClick={onLeaveRoom}
              className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-all active:scale-95"
            >
              Exit Studio
            </button>
          </div>
        </header>

        {/* Room Code Banner */}
        <RoomCodeCard roomCode={roomCode} />

        {/* Main Grid: Left = Visualizer + Player + Tracks; Right = Radar + Mesh Nodes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols): Visualizer & Master Deck */}
          <div className="lg:col-span-7 space-y-6">
            {/* 60fps Audio Visualizer */}
            <AudioVisualizer analyser={analyserNode} isPlaying={isPlaying} />

            {/* Master Playback Deck Card */}
            <div className="rounded-3xl border border-white/10 bg-[#0E0E18]/80 p-6 backdrop-blur-2xl shadow-2xl">
              {/* Now Playing Info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30">
                    <Disc className={`h-6 w-6 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{currentTrack.title}</h3>
                    <p className="text-xs text-zinc-400">{currentTrack.artist} • {currentTrack.genre}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    BUFFER READY
                  </span>
                </div>
              </div>

              {/* Seek Bar */}
              <div className="space-y-1.5 my-5">
                <div className="relative flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={duration || 64}
                    step={0.1}
                    value={Math.min(playbackPosition, duration || 64)}
                    onChange={(e) => onSeek(parseFloat(e.target.value))}
                    className="h-2 w-full appearance-none rounded-lg bg-zinc-800 accent-cyan-400 cursor-pointer"
                  />
                </div>
                <div className="flex justify-between font-mono text-[11px] text-zinc-400">
                  <span>{formatTime(playbackPosition)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Master Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5">
                {/* Transport Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onSeek(0)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all active:scale-95"
                    title="Restart Track"
                    aria-label="Restart Track"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <button
                    onClick={isPlaying ? onPause : onPlay}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-violet-600/30 transition-all hover:scale-105 active:scale-95"
                    title={isPlaying ? 'Pause Mesh' : 'Broadcast Play to Mesh'}
                    aria-label={isPlaying ? 'Pause Mesh' : 'Broadcast Play to Mesh'}
                  >
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                  </button>

                  <div className="text-xs">
                    <div className="font-semibold text-white">
                      {isPlaying ? 'Mesh Broadcasting' : 'Standby / Paused'}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {isPlaying ? `Scheduled +${lookaheadMs}ms universal buffer` : 'Hit Play to sync all phones'}
                    </div>
                  </div>
                </div>

                {/* Pre-buffer Lookahead Latency Selector */}
                <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/5 px-3 py-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-mono text-zinc-400">Lookahead Buffer</span>
                    <select
                      value={lookaheadMs}
                      onChange={(e) => setLookaheadMs(Number(e.target.value))}
                      className="bg-transparent text-xs font-mono font-bold text-cyan-400 focus:outline-none cursor-pointer"
                    >
                      <option value={800} className="bg-[#12121E] text-white">800ms (Low Jitter)</option>
                      <option value={1500} className="bg-[#12121E] text-white">1500ms (Standard Sync)</option>
                      <option value={2200} className="bg-[#12121E] text-white">2200ms (Unstable Wi-Fi)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Track Selector & Uploader Section */}
            <div className="rounded-3xl border border-white/10 bg-[#0E0E18]/80 p-6 backdrop-blur-2xl shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-violet-400" />
                  <h3 className="font-bold text-white text-base">Audio Soundboard</h3>
                </div>
                <span className="text-xs text-zinc-400">Studio synthesized or upload file</span>
              </div>

              {/* Sample Track Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SAMPLE_TRACKS.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => onChangeTrack(track)}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all ${
                      currentTrack.id === track.id && !hasCustomAudio
                        ? 'bg-violet-600/20 border-violet-500/50 shadow-lg shadow-violet-600/20'
                        : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[10px] font-mono text-cyan-400">{track.bpm} BPM</span>
                      <span className="text-[10px] font-mono text-zinc-500">{track.duration}s</span>
                    </div>
                    <div className="font-bold text-sm text-white truncate">{track.title}</div>
                    <div className="text-[11px] text-zinc-400 truncate">{track.genre}</div>
                  </button>
                ))}
              </div>

              {/* Drag and Drop Uploader */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-cyan-400 bg-cyan-950/20'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mp3,audio/wav,audio/flac,audio/ogg,audio/mpeg"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/30 mb-2">
                  <Upload className="h-5 w-5" />
                </div>

                <div className="text-xs font-semibold text-white">
                  {isUploading ? 'Decoding & Buffering Track...' : 'Drag & drop MP3 / WAV audio file here'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Upload custom track to stream to all speaker phones synchronously
                </div>

                {hasCustomAudio && (
                  <div className="mt-3 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-mono text-emerald-300 border border-emerald-500/30">
                    Active Upload: {customAudioName || 'Custom Master Track'}
                  </div>
                )}
              </div>
            </div>

            {/* Streaming Music Hub: Spotify & Apple Music + Party Queue */}
            <StreamingMusicSearch
              queue={partyQueue}
              currentTrackId={currentTrack.id}
              onAddToQueue={onAddToQueue}
              onRemoveFromQueue={onRemoveFromQueue}
              onReorderQueue={onReorderQueue}
              onVoteTrack={onVoteTrack}
              onPlayQueuedTrack={onPlayQueuedTrack}
              onPlayNext={onPlayNext}
              deviceId={deviceId}
            />
          </div>

          {/* Right Column (5 cols): Dynamic QR Code Scanner & Speaker Mesh Radar */}
          <div className="lg:col-span-5 space-y-6">
            {/* Dynamic Room URL QR Code Scanner */}
            <DynamicQRCodeWidget
              roomCode={roomCode}
              deviceCount={connectedDevices.length}
            />

            <SpeakerRadar
              devices={connectedDevices}
              currentDeviceId={deviceId}
              onMuteDevice={onMuteDevice}
              onKickDevice={onKickDevice}
              onSetChannel={onSetChannel}
              onResyncAll={onResyncAll}
            />

            {/* Sync Protocol Diagnostics Card */}
            <div className="rounded-3xl border border-white/10 bg-[#0E0E18]/80 p-5 backdrop-blur-2xl shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-cyan-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">NTP & Hardware Pipeline</h4>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between rounded-xl bg-white/5 p-2">
                  <span className="text-zinc-400">Zero-Disturbance Gate</span>
                  <span className="text-emerald-400 font-bold">&lt; 5ms In-Phase</span>
                </div>
                <div className="flex justify-between rounded-xl bg-white/5 p-2">
                  <span className="text-zinc-400">Drift Glide Correction</span>
                  <span className="text-violet-400 font-bold">5ms - 25ms Rate Shift</span>
                </div>
                <div className="flex justify-between rounded-xl bg-white/5 p-2">
                  <span className="text-zinc-400">Comb-Filtering Shield</span>
                  <span className="text-cyan-400 font-bold">10-Burst Outlier Trim</span>
                </div>
                <div className="flex justify-between rounded-xl bg-white/5 p-2">
                  <span className="text-zinc-400">Mobile Sleep Guard</span>
                  <span className="text-emerald-400 font-bold">Screen Wake Lock API</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Native Companion Architecture Section */}
        {showNativeSpecs && (
          <div className="mt-8 pt-4 border-t border-white/10">
            <NativeCompanionArchitecture />
          </div>
        )}
      </div>
    </div>
  );
};
