import React, { useState } from 'react';
import {
  Smartphone,
  ShieldCheck,
  Moon,
  Sun,
  Sliders,
  Volume2,
  VolumeX,
  RefreshCw,
  LogOut,
  Zap,
  Activity,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { TrackMetadata } from '../utils/audioPresets';

interface GuestViewProps {
  roomCode: string;
  deviceName: string;
  deviceId: string;
  isArmed: boolean;
  armSpeaker: () => void;
  syncState: 'SYNCING' | 'LOCKED' | 'DRIFTED';
  isPlaying: boolean;
  currentTrack: TrackMetadata;
  roundTripTime: number;
  clockOffset: number;
  jitter: number;
  driftMs: number;
  acousticOffsetMs: number;
  adjustAcousticOffset: (deltaMs: number) => void;
  physicalDistanceMeters: number;
  setPhysicalDistance: (meters: number) => void;
  activeChannel: 'all' | 'left' | 'right' | 'subwoofer';
  setActiveChannel: (ch: 'all' | 'left' | 'right' | 'subwoofer') => void;
  isMuted: boolean;
  batterySaver: boolean;
  setBatterySaver: (enabled: boolean) => void;
  wakeLockActive: boolean;
  analyserNode: AnalyserNode | null;
  onResync: () => void;
  onLeaveRoom: () => void;
}

export const GuestView: React.FC<GuestViewProps> = ({
  roomCode,
  deviceName,
  deviceId,
  isArmed,
  armSpeaker,
  syncState,
  isPlaying,
  currentTrack,
  roundTripTime,
  clockOffset,
  jitter,
  driftMs,
  acousticOffsetMs,
  adjustAcousticOffset,
  physicalDistanceMeters,
  setPhysicalDistance,
  activeChannel,
  setActiveChannel,
  isMuted,
  batterySaver,
  setBatterySaver,
  wakeLockActive,
  analyserNode,
  onResync,
  onLeaveRoom,
}) => {
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);

  const isLocked = syncState === 'LOCKED';
  const isDrifted = syncState === 'DRIFTED';

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-500 ${
        batterySaver ? 'bg-black text-zinc-300' : 'bg-[#08080C] text-zinc-100'
      } p-4 sm:p-6`}
    >
      {/* Top Bar */}
      <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#12121E]/80 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">{deviceName}</span>
              <span className="rounded bg-cyan-500/10 px-1.5 py-0.2 text-[10px] font-mono font-bold text-cyan-400 border border-cyan-500/20">
                ROOM: {roomCode}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400">Synchronized Satellite Speaker Node</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Battery Saver Toggle */}
          <button
            onClick={() => setBatterySaver(!batterySaver)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border transition-all ${
              batterySaver
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-white/5 text-zinc-400 hover:text-white border-white/10'
            }`}
            title="Toggle OLED Battery Saver"
            aria-label="Toggle OLED Battery Saver"
          >
            {batterySaver ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{batterySaver ? 'OLED Mode' : 'Normal'}</span>
          </button>

          {/* Leave Button */}
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-all"
            title="Disconnect from Room"
            aria-label="Disconnect from Room"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* Main Center Stage: Massive Audio Locked Status Ring */}
      <main className="my-auto flex flex-col items-center justify-center py-6 text-center">
        {!isArmed ? (
          /* Mobile Autoplay Unlock Banner */
          <div className="w-full max-w-sm rounded-3xl border border-violet-500/30 bg-gradient-to-b from-violet-950/60 to-[#0F0F1A] p-6 backdrop-blur-2xl shadow-2xl animate-pulse">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-xl shadow-violet-600/40 mb-4">
              <Zap className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-white">Arm Speaker Hardware</h2>
            <p className="mt-2 text-xs text-zinc-400">
              Mobile browsers require user interaction to unlock hardware audio scheduling and acquire the screen wake lock.
            </p>
            <button
              onClick={armSpeaker}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>Tap to Arm Speaker</span>
            </button>
          </div>
        ) : (
          <div className="relative flex flex-col items-center">
            {/* Massive Glowing Ring */}
            <div className="relative flex h-64 w-64 items-center justify-center">
              {/* Outer pulsing atmospheric rings */}
              <div
                className={`absolute inset-0 rounded-full transition-all duration-1000 ${
                  batterySaver
                    ? 'border border-zinc-800'
                    : isLocked
                    ? 'border-2 border-emerald-500/30 animate-ping'
                    : isDrifted
                    ? 'border-2 border-amber-500/30 animate-pulse'
                    : 'border-2 border-cyan-500/30 animate-pulse'
                }`}
                style={{ animationDuration: '3s' }}
              />

              <div
                className={`relative flex h-52 w-52 flex-col items-center justify-center rounded-full border-4 p-4 shadow-2xl transition-all duration-500 ${
                  batterySaver
                    ? 'border-zinc-700 bg-zinc-950'
                    : isLocked
                    ? 'border-emerald-400 bg-emerald-950/40 shadow-emerald-500/20'
                    : isDrifted
                    ? 'border-amber-400 bg-amber-950/40 shadow-amber-500/20'
                    : 'border-cyan-400 bg-cyan-950/40 shadow-cyan-500/20'
                }`}
              >
                {isLocked ? (
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-1" />
                ) : isDrifted ? (
                  <AlertTriangle className="h-10 w-10 text-amber-400 mb-1" />
                ) : (
                  <Activity className="h-10 w-10 text-cyan-400 mb-1 animate-spin" />
                )}

                <div className="text-xl font-black tracking-wider text-white">
                  {syncState === 'LOCKED' ? 'AUDIO LOCKED' : syncState === 'DRIFTED' ? 'RE-PHASING' : 'CALIBRATING'}
                </div>

                <div className="mt-1 font-mono text-xs font-semibold text-zinc-400">
                  {driftMs > 0 ? `+${driftMs}` : driftMs}ms drift
                </div>

                <div className="mt-2 flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-mono text-zinc-300">
                  <span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  <span>{isPlaying ? 'STREAMING' : 'IDLE / HOST PAUSED'}</span>
                </div>
              </div>
            </div>

            {/* Now Playing Banner */}
            <div className="mt-6">
              <div className="text-xs uppercase font-mono tracking-widest text-zinc-500">Currently Synchronized Track</div>
              <div className="text-lg font-bold text-white mt-0.5">{currentTrack.title}</div>
              <div className="text-xs text-zinc-400">{currentTrack.artist}</div>
            </div>

            {/* Muted Warning */}
            {isMuted && (
              <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-red-500/20 border border-red-500/30 px-3 py-1 text-xs text-red-300">
                <VolumeX className="h-4 w-4" />
                <span>Node muted by Host</span>
              </div>
            )}
          </div>
        )}

        {/* Visualizer when unmuted & armed */}
        {isArmed && !batterySaver && (
          <div className="mt-6 w-full max-w-md">
            <AudioVisualizer analyser={analyserNode} isPlaying={isPlaying} />
          </div>
        )}
      </main>

      {/* Bottom Controls: Calibration & Diagnostics */}
      <footer className="space-y-4">
        {/* Quick Diagnostics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="rounded-2xl border border-white/5 bg-[#12121E]/60 p-2.5 backdrop-blur-xl">
            <div className="text-[10px] font-mono uppercase text-zinc-400">Network RTT</div>
            <div className="text-xs font-mono font-bold text-cyan-400">{roundTripTime}ms</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#12121E]/60 p-2.5 backdrop-blur-xl">
            <div className="text-[10px] font-mono uppercase text-zinc-400">Clock Offset</div>
            <div className="text-xs font-mono font-bold text-violet-400">
              {clockOffset >= 0 ? `+${clockOffset}` : clockOffset}ms
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#12121E]/60 p-2.5 backdrop-blur-xl">
            <div className="text-[10px] font-mono uppercase text-zinc-400">Acoustic Delay</div>
            <div className="text-xs font-mono font-bold text-emerald-400">
              {acousticOffsetMs > 0 ? `+${acousticOffsetMs}` : acousticOffsetMs}ms
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#12121E]/60 p-2.5 backdrop-blur-xl">
            <div className="text-[10px] font-mono uppercase text-zinc-400">Screen Lock</div>
            <div className="text-xs font-mono font-bold text-white flex items-center justify-center gap-1">
              <ShieldCheck className={`h-3 w-3 ${wakeLockActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span>{wakeLockActive ? 'Active' : 'Standby'}</span>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#12121E]/80 p-3 backdrop-blur-xl">
          {/* Channel Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-zinc-400 mr-1 hidden sm:inline">Channel:</span>
            {(['all', 'left', 'right', 'subwoofer'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={`rounded-xl px-2.5 py-1 text-xs font-mono font-semibold uppercase transition-all ${
                  activeChannel === ch
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Acoustic Distance Calibration Button */}
            <button
              onClick={() => setShowCalibrationModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-all active:scale-95"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Calibrate Distance</span>
            </button>

            {/* Quick Re-Sync */}
            <button
              onClick={onResync}
              className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white transition-all active:scale-95"
              title="Re-run NTP handshake"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">NTP Sync</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Acoustic Calibration Modal */}
      {showCalibrationModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="calibration-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#141424] p-6 shadow-2xl">
            <h3 id="calibration-modal-title" className="text-base font-bold text-white">Acoustic Distance Calibration</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Sound travels ~343 m/s (~3ms per meter). Adjust micro-latency offset if this phone is positioned further away from the party crowd.
            </p>

            {/* Micro Slider +/- 5ms buttons */}
            <div className="my-5 rounded-2xl bg-[#0A0A10] p-4 border border-white/5 text-center">
              <div className="text-[11px] font-mono uppercase text-zinc-400">Total Acoustic Offset</div>
              <div className="text-2xl font-mono font-black text-cyan-400 my-1">
                {acousticOffsetMs > 0 ? `+${acousticOffsetMs}` : acousticOffsetMs} ms
              </div>

              <div className="flex items-center justify-center gap-2 mt-3">
                <button
                  onClick={() => adjustAcousticOffset(-5)}
                  className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-mono font-bold text-white active:scale-95"
                >
                  -5ms
                </button>
                <button
                  onClick={() => adjustAcousticOffset(-1)}
                  className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-mono font-bold text-white active:scale-95"
                >
                  -1ms
                </button>
                <button
                  onClick={() => adjustAcousticOffset(1)}
                  className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-mono font-bold text-white active:scale-95"
                >
                  +1ms
                </button>
                <button
                  onClick={() => adjustAcousticOffset(5)}
                  className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-mono font-bold text-white active:scale-95"
                >
                  +5ms
                </button>
              </div>

              {/* Physical distance slider */}
              <div className="mt-4 pt-3 border-t border-white/5 text-left">
                <div className="flex justify-between text-xs text-zinc-400 font-mono mb-1">
                  <span>Physical Distance:</span>
                  <span className="text-white font-bold">{physicalDistanceMeters}m</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={physicalDistanceMeters}
                  onChange={(e) => setPhysicalDistance(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            <button
              onClick={() => setShowCalibrationModal(false)}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30"
            >
              Done & Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
