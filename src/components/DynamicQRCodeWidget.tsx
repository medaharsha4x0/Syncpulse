import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Copy,
  Check,
  Download,
  Share2,
  Sparkles,
  Smartphone,
  ExternalLink,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface DynamicQRCodeWidgetProps {
  roomCode: string;
  className?: string;
  deviceCount?: number;
}

export const DynamicQRCodeWidget: React.FC<DynamicQRCodeWidgetProps> = ({
  roomCode,
  className = '',
  deviceCount = 0,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Dynamic join URL resolving the actual browser host or fallback
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?join=${roomCode}`
    : `https://syncpulse.party/?join=${roomCode}`;

  useEffect(() => {
    if (!roomCode) return;

    QRCode.toDataURL(joinUrl, {
      margin: 1.5,
      width: 320,
      color: {
        dark: '#08080C',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate dynamic QR code:', err));
  }, [joinUrl, roomCode]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    setDownloading(true);
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `SyncPulse-Room-${roomCode}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 1500);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-[#0E0E18]/85 p-5 backdrop-blur-2xl shadow-2xl transition-all duration-300 ${
        isExpanded ? 'ring-2 ring-cyan-500/50' : ''
      } ${className}`}
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-cyan-500/10 blur-2xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-sm">Instant Mesh Scanner</h4>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.2 text-[10px] font-mono font-bold text-cyan-400 border border-cyan-500/20">
                LIVE QR
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Aim phone camera to link speaker instantly</p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
          title={isExpanded ? 'Collapse QR' : 'Enlarge QR'}
          aria-label={isExpanded ? 'Collapse QR' : 'Enlarge QR'}
        >
          {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* QR Code Presentation Box */}
      <div className="relative mx-auto flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#08080C] p-4 text-center">
        {/* Animated Scanning Beam Effect */}
        <div className="relative group">
          {qrDataUrl ? (
            <div className="relative rounded-2xl bg-white p-2.5 shadow-xl transition-transform group-hover:scale-[1.02]">
              <img
                src={qrDataUrl}
                alt={`Scan QR Code to join room ${roomCode}`}
                className={`transition-all duration-300 rounded-lg ${
                  isExpanded ? 'h-64 w-64' : 'h-44 w-44'
                }`}
                data-testid="dynamic-qr-image"
              />

              {/* Glowing Holographic Scanning Laser line */}
              <div
                className="pointer-events-none absolute left-2.5 right-2.5 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#06B6D4] animate-pulse"
                style={{
                  top: '50%',
                  animationDuration: '2.5s',
                }}
              />
            </div>
          ) : (
            <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-white/5 animate-pulse text-xs text-zinc-500">
              Generating Live QR...
            </div>
          )}
        </div>

        {/* Dynamic URL & Room Code Pill */}
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/5 px-2.5 py-1 text-[11px] font-mono text-zinc-300 border border-white/5">
            <Smartphone className="h-3 w-3 text-cyan-400" />
            <span>ROOM: <strong className="text-cyan-400">{roomCode}</strong></span>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-emerald-500/10 px-2 py-1 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{deviceCount} Nodes Connected</span>
          </div>
        </div>

        {/* Live Join URL preview */}
        <div className="mt-2 text-[10px] font-mono text-zinc-500 truncate max-w-full px-2">
          {joinUrl}
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={handleCopyLink}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-semibold transition-all active:scale-95 ${
            copied
              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
          }`}
          aria-label="Copy Room URL"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Link Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-cyan-400" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        <button
          onClick={handleDownloadQr}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 py-2 px-3 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 hover:opacity-95 active:scale-95 transition-all"
          title="Save QR Code image for party flyers or projector screen"
          aria-label="Download QR Code PNG"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{downloading ? 'Downloaded!' : 'Save Image'}</span>
        </button>
      </div>
    </div>
  );
};
