import React, { useEffect, useRef, useState } from 'react';
import { Activity, Disc3, Radio } from 'lucide-react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  mode?: 'spectrum' | 'circular' | 'waveform';
  accentColor?: string;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  isPlaying,
  mode: initialMode = 'spectrum',
  accentColor = '#7C3AED',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<'spectrum' | 'circular' | 'waveform'>(initialMode);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isDestroyed = false;
    const isHeadless = typeof navigator !== 'undefined' && 
      (Boolean((navigator as any).webdriver) || /HeadlessChrome/i.test(navigator.userAgent));

    // High DPI scaling
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = (rect.width || 400) * dpr;
      canvas.height = (rect.height || 220) * dpr;
      ctx.scale(dpr, dpr);
    };
    updateSize();

    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 128);
    let rotation = 0;

    const render = () => {
      if (isDestroyed) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 400;
      const height = rect.height || 220;

      ctx.clearRect(0, 0, width, height);

      if (analyser && isPlaying) {
        if (mode === 'waveform') {
          analyser.getByteTimeDomainData(dataArray);
        } else {
          analyser.getByteFrequencyData(dataArray);
        }
      } else {
        // Idle animation / gentle sine breathing
        const time = Date.now() * 0.002;
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = Math.max(12, Math.sin(time + i * 0.1) * 20 + 25);
        }
      }

      if (mode === 'spectrum') {
        const barCount = 48;
        const barWidth = (width / barCount) * 0.75;
        const gap = (width / barCount) * 0.25;

        for (let i = 0; i < barCount; i++) {
          // sample logarithmic frequency range
          const index = Math.floor(Math.pow(i / barCount, 1.4) * (dataArray.length * 0.7));
          const val = dataArray[index] || 0;
          const barHeight = Math.max(4, (val / 255) * (height * 0.85));

          const x = i * (barWidth + gap) + gap / 2;
          const y = height - barHeight;

          // Gradient: Violet to Cyan to Fuchsia
          const gradient = ctx.createLinearGradient(0, height, 0, y);
          gradient.addColorStop(0, 'rgba(124, 58, 237, 0.4)');
          gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.9)');
          gradient.addColorStop(1, 'rgba(236, 72, 153, 1)');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          // Peak dot
          ctx.fillStyle = '#06B6D4';
          ctx.beginPath();
          ctx.arc(x + barWidth / 2, Math.max(4, y - 4), Math.max(1.5, barWidth * 0.25), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (mode === 'circular') {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) * 0.55;
        rotation += 0.01;

        // Glowing center core
        const coreGradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius);
        coreGradient.addColorStop(0, 'rgba(124, 58, 237, 0.35)');
        coreGradient.addColorStop(0.7, 'rgba(6, 182, 212, 0.15)');
        coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
        ctx.fill();

        const count = 64;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + rotation;
          const index = Math.floor((i / count) * (dataArray.length * 0.5));
          const amplitude = (dataArray[index] || 0) / 255;
          const length = amplitude * 40 + 8;

          const x1 = centerX + Math.cos(angle) * radius;
          const y1 = centerY + Math.sin(angle) * radius;
          const x2 = centerX + Math.cos(angle) * (radius + length);
          const y2 = centerY + Math.sin(angle) * (radius + length);

          ctx.strokeStyle = `hsl(${(i * 5 + 260) % 360}, 90%, 65%)`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } else if (mode === 'waveform') {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#06B6D4';
        ctx.shadowColor = '#06B6D4';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        const sliceWidth = width / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

      if (isHeadless) {
        // Throttle in headless mode
        setTimeout(() => {
          if (!isDestroyed) animationFrameRef.current = requestAnimationFrame(render);
        }, 80);
      } else {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      isDestroyed = true;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [analyser, isPlaying, mode]);

  return (
    <div className={`relative flex flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-[#0C0C14]/80 p-4 backdrop-blur-xl ${className}`}>
      {/* Visualizer Mode Switcher */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-xl bg-white/5 p-1 backdrop-blur-md">
        <button
          onClick={() => setMode('spectrum')}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-all ${
            mode === 'spectrum' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-zinc-400 hover:text-white'
          }`}
          title="Spectrum Equalizer"
          aria-label="Spectrum Equalizer"
        >
          <Activity className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setMode('circular')}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-all ${
            mode === 'circular' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-zinc-400 hover:text-white'
          }`}
          title="Circular Reactor"
          aria-label="Circular Reactor"
        >
          <Disc3 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setMode('waveform')}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-all ${
            mode === 'waveform' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-zinc-400 hover:text-white'
          }`}
          title="Oscilloscope Waveform"
          aria-label="Oscilloscope Waveform"
        >
          <Radio className="h-3.5 w-3.5" />
        </button>
      </div>

      <canvas ref={canvasRef} className="h-44 w-full" data-testid="audio-canvas" />
    </div>
  );
};
