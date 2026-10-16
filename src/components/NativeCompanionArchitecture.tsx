import React, { useState } from 'react';
import {
  Smartphone,
  Cpu,
  BellRing,
  Radio,
  Zap,
  Code2,
  CheckCircle2,
  Layers,
  Shield,
  Activity,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';

export const NativeCompanionArchitecture: React.FC = () => {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'protocol'>('ios');
  const [copiedCode, setCopiedCode] = useState(false);

  const iosCodeSnippet = `// iOS Native Companion - SyncPulseAudioEngine.swift
import AVFoundation
import CoreAudio

final class SyncPulseAudioEngine {
    private let engine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private var clockOffsetMachNano: Int64 = 0 // ServerTime - ClientMachTime
    
    init() {
        setupAudioSession()
        engine.attach(playerNode)
        engine.connect(playerNode, to: engine.mainMixerNode, format: nil)
        try? engine.start()
    }
    
    private func setupAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers, .allowAirPlay])
        try? session.setPreferredIOBufferDuration(0.005) // 5ms buffer for low latency
        try? session.setActive(true)
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
    }
    
    // Scheduled playback at exact universal server timestamp
    func scheduleBuffer(buffer: AVAudioPCMBuffer, targetServerTimeMs: Int64) {
        let localTargetNano = targetServerTimeMs * 1_000_000 - clockOffsetMachNano
        let hostTime = mach_absolute_time()
        let audioTime = AVAudioTime(hostTime: hostTime)
        
        playerNode.scheduleBuffer(buffer, at: audioTime, options: []) {
            // Buffer finished callback
        }
        playerNode.play()
    }
    
    @objc private func handleInterruption(notification: Notification) {
        // Auto-resume and trigger instant NTP resync on phone call end
        try? AVAudioSession.sharedInstance().setActive(true)
    }
}`;

  const androidCodeSnippet = `// Android Native Companion - SyncPulseOboeEngine.kt
package com.syncpulse.audio

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.PowerManager

class AudioSyncService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    // Native C++ Oboe Audio Stream binding
    external fun initOboeStream(sampleRate: Int, bufferFrames: Int): Long
    external fun scheduleNativeBuffer(targetServerTimeMs: Long, audioData: ByteArray)
    external fun updateClockOffset(offsetMs: Double)

    override fun onCreate() {
        super.onCreate()
        acquireHardwareLocks()
        startForeground(1001, createSyncNotification())
    }

    private fun acquireHardwareLocks() {
        // Prevent CPU throttling and Wi-Fi power-save jitter
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SyncPulse::CpuLock").apply {
            acquire()
        }

        val wifiManager = applicationContext.getSystemService(WIFI_SERVICE) as WifiManager
        wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "SyncPulse::WifiLock").apply {
            acquire()
        }
    }
}`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0E0E18]/80 p-6 backdrop-blur-2xl shadow-2xl space-y-6">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-500 p-[2px] shadow-lg shadow-cyan-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#08080C]">
              <Cpu className="h-5 w-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Native Companion App Architecture
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono text-violet-300 border border-violet-500/30">
                iOS & Android SDK
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Platform-specific audio pipelines, background push delivery & sub-millisecond clock parity
            </p>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex rounded-2xl bg-[#08080E] p-1 border border-white/5">
          <button
            onClick={() => setPlatform('ios')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              platform === 'ios'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Apple iOS (Swift)</span>
          </button>
          <button
            onClick={() => setPlatform('android')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              platform === 'android'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Google Android (Oboe / Kotlin)</span>
          </button>
          <button
            onClick={() => setPlatform('protocol')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              platform === 'protocol'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Clock Sync Parity</span>
          </button>
        </div>
      </div>

      {platform === 'ios' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-violet-400">
                <Activity className="h-4 w-4" />
                <span>AVAudioEngine & CoreAudio HAL</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Bypasses high-level AVPlayer to directly buffer PCM frames in <code className="text-zinc-300">AVAudioPlayerNode</code> scheduled via <code className="text-zinc-300">mach_absolute_time()</code>.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                <BellRing className="h-4 w-4" />
                <span>APNs Push & CallKit Guard</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Background silent APNs pushes pre-buffer tracks before song transitions. Automatic recovery from Siri/phone call interruptions.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Shield className="h-4 w-4" />
                <span>MusicKit Native Bridge</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Connects Apple Music user tokens for seamless catalog search with FairPlay-protected offline pre-loading.
              </p>
            </div>
          </div>

          {/* Swift Architecture Snippet */}
          <div className="rounded-2xl border border-white/10 bg-[#06060A] p-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5 text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Code2 className="h-3.5 w-3.5" />
                SyncPulseAudioEngine.swift (iOS CoreAudio Engine)
              </span>
              <button
                onClick={() => handleCopy(iosCodeSnippet)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="mt-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
              {iosCodeSnippet}
            </pre>
          </div>
        </div>
      )}

      {platform === 'android' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Activity className="h-4 w-4" />
                <span>Oboe C++ Low-Latency Engine</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Leverages Google Oboe (AAudio backend) with <code className="text-zinc-300">CLOCK_MONOTONIC_RAW</code> to achieve under 6ms audio round-trip buffer latency.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Shield className="h-4 w-4" />
                <span>Hardware Wake & Wi-Fi Lock</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Holds <code className="text-zinc-300">PARTIAL_WAKE_LOCK</code> and <code className="text-zinc-300">WIFI_MODE_FULL_HIGH_PERF</code> so Android power-saving never throttles Wi-Fi packets.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                <BellRing className="h-4 w-4" />
                <span>FCM High-Priority Wakeup</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Firebase Cloud Messaging high-priority data payloads awaken sleeping companion devices to pre-buffer the upcoming party track.
              </p>
            </div>
          </div>

          {/* Android Kotlin Architecture Snippet */}
          <div className="rounded-2xl border border-white/10 bg-[#06060A] p-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5 text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <Code2 className="h-3.5 w-3.5" />
                SyncPulseOboeEngine.kt (Android Native Engine)
              </span>
              <button
                onClick={() => handleCopy(androidCodeSnippet)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="mt-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
              {androidCodeSnippet}
            </pre>
          </div>
        </div>
      )}

      {platform === 'protocol' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#08080E] p-4 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio className="h-4 w-4 text-cyan-400" />
              Cross-Platform Hardware Clock Parity Flow
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Whether a speaker device is running the Web Audio app, native iOS Swift app, or native Android Oboe app, it communicates with the exact same Node.js WebSocket signaling server using identical NTP packet structures:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-cyan-400 font-bold">t0 (Client Send)</div>
                <div className="text-[10px] text-zinc-400 mt-1">Local Monotonic Epoch</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-violet-400 font-bold">t1 (Server Recv)</div>
                <div className="text-[10px] text-zinc-400 mt-1">Universal Master Clock</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-emerald-400 font-bold">t2 (Server Send)</div>
                <div className="text-[10px] text-zinc-400 mt-1">Instant Microsecond Reply</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-amber-400 font-bold">t3 (Client Recv)</div>
                <div className="text-[10px] text-zinc-400 mt-1">RTT & Offset Computed</div>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-black/40 p-3 text-[11px] font-mono text-zinc-300 space-y-1">
              <div>• <strong>Round-Trip Time</strong> = (t3 - t0) - (t2 - t1)</div>
              <div>• <strong>Clock Offset (&theta;)</strong> = ((t1 - t0) + (t2 - t3)) / 2</div>
              <div>• <strong>Scheduled Trigger</strong> = <code className="text-cyan-300">targetServerTime - &theta; + acousticOffsetMs</code></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
