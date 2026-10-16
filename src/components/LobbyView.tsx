import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Sparkles,
  Users,
  Volume2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Smartphone,
  Layers,
  ChevronRight,
  Headphones,
} from 'lucide-react';

interface LobbyViewProps {
  onCreateRoom: (deviceName: string) => void;
  onJoinRoom: (roomCode: string, deviceName: string) => void;
  initialRoomCode?: string;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  initialRoomCode = '',
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialRoomCode ? 'join' : 'create');
  const [roomCodeDigits, setRoomCodeDigits] = useState<string[]>(() => {
    if (initialRoomCode) {
      const padded = initialRoomCode.padEnd(6, '').slice(0, 6).toUpperCase().split('');
      return padded;
    }
    return ['', '', '', '', '', ''];
  });
  const [deviceName, setDeviceName] = useState(() => {
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent);
    return isMobile ? 'Mobile Node' : 'Studio Console';
  });
  const [errorMsg, setErrorMsg] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (initialRoomCode) {
      const chars = initialRoomCode.toUpperCase().slice(0, 6).split('');
      while (chars.length < 6) chars.push('');
      setRoomCodeDigits(chars);
      setActiveTab('join');
    }
  }, [initialRoomCode]);

  const handleDigitChange = (index: number, value: string) => {
    setErrorMsg('');
    const char = value.slice(-1).toUpperCase();
    const updated = [...roomCodeDigits];
    updated[index] = char;
    setRoomCodeDigits(updated);

    // Auto-advance focus
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !roomCodeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (pasted.length > 0) {
      const chars = pasted.slice(0, 6).split('');
      while (chars.length < 6) chars.push('');
      setRoomCodeDigits(chars);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const fullRoomCode = roomCodeDigits.join('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullRoomCode.length < 6) {
      setErrorMsg('Please enter all 6 characters of the room code');
      return;
    }
    onJoinRoom(fullRoomCode, deviceName || 'Guest Phone');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateRoom(deviceName || 'Master Host');
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#08080C] text-white overflow-hidden p-4 md:p-8">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-violet-600/15 blur-[128px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/15 blur-[128px]" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-400 p-[2px] shadow-xl shadow-violet-600/30">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#08080C]">
              <Radio className="h-5 w-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              SyncPulse
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
                v2.0 MESH
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Zero-latency multi-device synchronized audio array</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sub-millisecond Web Audio Engine</span>
        </div>
      </header>

      {/* Main Center Card */}
      <main className="relative z-10 mx-auto my-auto w-full max-w-lg py-8">
        <div className="rounded-3xl border border-white/10 bg-[#12121E]/80 p-6 md:p-8 backdrop-blur-2xl shadow-2xl">
          {/* Mode Tabs: Create vs Join */}
          <div className="flex rounded-2xl bg-[#0A0A12] p-1.5 border border-white/5 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
                activeTab === 'create'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Radio className="h-4 w-4" />
              <span className="hidden sm:inline">Create Party Room (Host)</span>
              <span className="sm:hidden">Host Party</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('join')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
                activeTab === 'join'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Join Speaker Mesh (Guest)</span>
              <span className="sm:hidden">Join Mesh</span>
            </button>
          </div>

          {/* Form Content */}
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                  Host Device Console Name
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0A0A12] px-4 py-3 focus-within:border-violet-500">
                  <Smartphone className="h-4 w-4 text-violet-400" />
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. Master Studio Console"
                    className="w-full bg-transparent text-sm font-medium text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Host Perks Banner */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  <span>Host Authority & Synchronous Control</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  You will generate a unique 6-character room code and QR code. Connected guest phones will lock into your master NTP clock and play in perfect zero-drift surround harmony.
                </p>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-600/30 transition-all hover:scale-[1.02] active:scale-95"
              >
                <span>Launch Audio Party Room</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinSubmit} className="space-y-5">
              {/* 6-Digit OTP Box */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                  Enter 6-Digit Room Code
                </label>
                <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
                  {roomCodeDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="flex h-14 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-[#0A0A12] text-center text-xl font-mono font-black text-cyan-300 shadow-inner focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    />
                  ))}
                </div>
                {errorMsg && <p className="mt-2 text-xs font-semibold text-red-400">{errorMsg}</p>}
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-2">
                  Your Device Name
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0A0A12] px-4 py-3 focus-within:border-cyan-500">
                  <Smartphone className="h-4 w-4 text-cyan-400" />
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. iPhone 15 Pro Max / Left Speaker"
                    className="w-full bg-transparent text-sm font-medium text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-xl shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-95"
              >
                <span>Connect to Speaker Mesh</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/5 bg-[#0C0C14]/60 p-3.5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
              <Zap className="h-3.5 w-3.5 text-cyan-400" />
              <span>NTP Clock Sync</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              10-burst handshake filters jitter outliers for sub-millisecond precision.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0C0C14]/60 p-3.5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Comb-Filter Guard</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Smooth rate gliding and scheduled buffering eradicate acoustic phase echoes.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0C0C14]/60 p-3.5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span>Screen Wake Lock</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Smartphones stay awake without dimming or interrupting the party sound.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mx-auto text-center text-xs text-zinc-500 py-4">
        SyncPulse • Multi-Phone Surround Sound Array • Powered by Web Audio API & WebSockets
      </footer>
    </div>
  );
};
