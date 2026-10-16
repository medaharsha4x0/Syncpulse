import React, { useState } from 'react';
import { Volume2, VolumeX, UserX, Smartphone, RefreshCw, Radio, ShieldCheck, Zap } from 'lucide-react';
import { DeviceTelemetry } from '../hooks/useAudioSync';

interface SpeakerRadarProps {
  devices: DeviceTelemetry[];
  currentDeviceId: string;
  onMuteDevice: (deviceId: string, muted: boolean) => void;
  onKickDevice: (deviceId: string) => void;
  onSetChannel: (deviceId: string, channel: string) => void;
  onResyncAll: () => void;
}

export const SpeakerRadar: React.FC<SpeakerRadarProps> = ({
  devices,
  currentDeviceId,
  onMuteDevice,
  onKickDevice,
  onSetChannel,
  onResyncAll,
}) => {
  const [selectedDevice, setSelectedDevice] = useState<DeviceTelemetry | null>(null);

  return (
    <div className="relative flex flex-col rounded-3xl border border-white/10 bg-[#0E0E17]/80 p-6 backdrop-blur-2xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-cyan-400 animate-pulse" />
            <h3 className="text-lg font-bold text-white tracking-wide">Speaker Mesh Radar</h3>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-mono font-medium text-cyan-400 border border-cyan-500/20">
              {devices.length} Nodes Active
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Spatial node topology & zero-latency sync monitoring</p>
        </div>

        <button
          onClick={onResyncAll}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 px-3 py-1.5 text-xs font-medium text-violet-300 transition-all active:scale-95 shadow-lg shadow-violet-600/10"
          title="Force Global Resync"
          aria-label="Force Global Resync"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Sync All</span>
        </button>
      </div>

      {/* Radar Canvas / Visualizer */}
      <div className="relative mx-auto flex h-72 w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-[#08080E]/90">
        {/* Radar concentric distance rings */}
        <div className="absolute h-60 w-60 rounded-full border border-cyan-500/15" />
        <div className="absolute h-44 w-44 rounded-full border border-cyan-500/20" />
        <div className="absolute h-28 w-28 rounded-full border border-cyan-500/25" />
        <div className="absolute h-14 w-14 rounded-full border border-cyan-500/30" />

        {/* Crosshair grid lines */}
        <div className="absolute h-full w-[1px] bg-cyan-500/10" />
        <div className="absolute h-[1px] w-full bg-cyan-500/10" />

        {/* Radar Sweep Beam */}
        <div
          className="pointer-events-none absolute h-60 w-60 origin-center rounded-full animate-spin"
          style={{
            animationDuration: '4s',
            animationTimingFunction: 'linear',
            background: 'conic-gradient(from 0deg, rgba(6, 182, 212, 0.25) 0deg, rgba(124, 58, 237, 0.05) 60deg, transparent 90deg)',
          }}
        />

        {/* Center Host Node */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-cyan-400 p-[2px] shadow-lg shadow-violet-500/40">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0E0E17]">
              <Zap className="h-4 w-4 text-cyan-300 animate-pulse" />
            </div>
          </div>
          <span className="mt-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-cyan-400">HOST</span>
        </div>

        {/* Guest Nodes Orbiting */}
        {devices.map((device, index) => {
          if (device.role === 'host') return null;

          // Calculate Cartesian coordinates from distance & angle
          const angleRad = ((device.angleDeg || (index * 60)) * Math.PI) / 180;
          const maxRadiusPx = 115;
          const distNorm = Math.min(1, Math.max(0.3, (device.distanceMeters || 2) / 4.5));
          const radiusPx = distNorm * maxRadiusPx;

          const x = Math.cos(angleRad) * radiusPx;
          const y = Math.sin(angleRad) * radiusPx;

          const isLocked = device.status === 'LOCKED';
          const isDrifted = device.status === 'DRIFTED';

          return (
            <button
              key={device.deviceId}
              onClick={() => setSelectedDevice(device)}
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
              className="absolute z-20 group flex flex-col items-center transition-all duration-300 focus:outline-none"
              title={`${device.deviceName} (${device.ping}ms)`}
              aria-label={`Node ${device.deviceName}`}
            >
              {/* Outer Pulse Ring */}
              <div
                className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-all group-hover:scale-125 ${
                  device.muted
                    ? 'border-2 border-red-500/60 bg-red-950/80 text-red-400'
                    : isLocked
                    ? 'border-2 border-emerald-400/80 bg-emerald-950/80 text-emerald-300 shadow-md shadow-emerald-500/40'
                    : isDrifted
                    ? 'border-2 border-amber-400/80 bg-amber-950/80 text-amber-300 shadow-md shadow-amber-500/40'
                    : 'border-2 border-cyan-400/80 bg-cyan-950/80 text-cyan-300 shadow-md shadow-cyan-500/40'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                {/* Ping dot */}
                <div
                  className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${
                    isLocked ? 'bg-emerald-400' : isDrifted ? 'bg-amber-400 animate-ping' : 'bg-cyan-400'
                  }`}
                />
              </div>

              {/* Tag Label */}
              <div className="mt-1 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-mono text-zinc-300 backdrop-blur-sm border border-white/5 pointer-events-none">
                <span>{device.deviceName.length > 10 ? device.deviceName.substring(0, 9) + '…' : device.deviceName}</span>
                <span className="text-cyan-400">{device.ping}ms</span>
              </div>
            </button>
          );
        })}

        {/* Distance Range Indicators */}
        <span className="absolute bottom-1 right-2 text-[10px] font-mono text-zinc-600">4.5m range</span>
      </div>

      {/* Selected Node Inspector Drawer / Card */}
      {selectedDevice && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#141422]/90 p-4 transition-all animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-violet-400" />
              <h4 className="font-semibold text-white text-sm">{selectedDevice.deviceName}</h4>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase font-bold ${
                  selectedDevice.status === 'LOCKED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : selectedDevice.status === 'DRIFTED'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}
              >
                {selectedDevice.status}
              </span>
            </div>
            <button
              onClick={() => setSelectedDevice(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Close
            </button>
          </div>

          {/* Diagnostics Grid */}
          <div className="grid grid-cols-4 gap-2 my-3 text-center">
            <div className="rounded-xl bg-white/5 p-2">
              <div className="text-[10px] uppercase font-mono text-zinc-400">Latency</div>
              <div className="text-sm font-mono font-bold text-cyan-400">{selectedDevice.ping}ms</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2">
              <div className="text-[10px] uppercase font-mono text-zinc-400">Drift</div>
              <div className="text-sm font-mono font-bold text-violet-400">
                {selectedDevice.driftMs > 0 ? `+${selectedDevice.driftMs}` : selectedDevice.driftMs}ms
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-2">
              <div className="text-[10px] uppercase font-mono text-zinc-400">Distance</div>
              <div className="text-sm font-mono font-bold text-emerald-400">{selectedDevice.distanceMeters}m</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2">
              <div className="text-[10px] uppercase font-mono text-zinc-400">Channel</div>
              <div className="text-sm font-mono font-bold uppercase text-amber-400">{selectedDevice.channel}</div>
            </div>
          </div>

          {/* Channel Selector & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-zinc-400 mr-1">Channel:</span>
              {(['all', 'left', 'right', 'subwoofer'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => onSetChannel(selectedDevice.deviceId, ch)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-mono font-medium uppercase transition-all ${
                    selectedDevice.channel === ch
                      ? 'bg-violet-600 text-white font-bold'
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onMuteDevice(selectedDevice.deviceId, !selectedDevice.muted)}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-all ${
                  selectedDevice.muted
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {selectedDevice.muted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5" />}
                <span>{selectedDevice.muted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                onClick={() => {
                  onKickDevice(selectedDevice.deviceId);
                  setSelectedDevice(null);
                }}
                className="flex items-center gap-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2.5 py-1 text-xs font-medium transition-all"
                title="Disconnect node"
              >
                <UserX className="h-3.5 w-3.5" />
                <span>Kick</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mesh Nodes Table */}
      <div className="mt-4 space-y-1.5 max-h-40 overflow-y-auto pr-1">
        {devices.map((device) => (
          <div
            key={device.deviceId}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
              selectedDevice?.deviceId === device.deviceId
                ? 'bg-violet-600/20 border border-violet-500/30'
                : 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/5'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  device.status === 'LOCKED' ? 'bg-emerald-400' : device.status === 'DRIFTED' ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
              />
              <span className="font-medium text-white">{device.deviceName}</span>
              {device.role === 'host' && (
                <span className="rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.2 text-[9px] font-mono">
                  MASTER
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-zinc-400">RTT: <span className="text-cyan-400">{device.ping}ms</span></span>
              <span className="text-zinc-400">Drift: <span className="text-violet-400">{device.driftMs}ms</span></span>
              <span className="text-zinc-500 capitalize">{device.channel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
