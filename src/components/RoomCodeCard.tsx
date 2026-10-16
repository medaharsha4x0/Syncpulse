import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode, Share2, Sparkles } from 'lucide-react';

interface RoomCodeCardProps {
  roomCode: string;
}

export const RoomCodeCard: React.FC<RoomCodeCardProps> = ({ roomCode }) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?join=${roomCode}`
    : `https://syncpulse.party/?join=${roomCode}`;

  useEffect(() => {
    if (!roomCode) return;
    QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 280,
      color: {
        dark: '#08080C',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [joinUrl, roomCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0E0E17]/80 p-5 backdrop-blur-2xl shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Sync Mesh Room Code</div>
              <div className="text-xs text-zinc-500">Share with guests or scan QR to link phones</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition-all active:scale-95"
              title="Show QR Code"
              aria-label="Show QR Code"
            >
              <QrCode className="h-3.5 w-3.5 text-cyan-400" />
              <span>QR Code</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition-all active:scale-95"
              title="Copy Join Link"
              aria-label="Copy Join Link"
            >
              <Share2 className="h-3.5 w-3.5 text-violet-400" />
              <span>Link</span>
            </button>
          </div>
        </div>

        {/* 6-Digit Code Display */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#08080C]/80 px-4 py-3">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            {roomCode.split('').map((char, index) => (
              <span
                key={index}
                className="flex h-11 w-8 sm:w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/30 text-lg sm:text-xl font-mono font-black text-cyan-300 shadow-inner"
              >
                {char}
              </span>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all active:scale-95 ${
              copied
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-600/20 hover:opacity-90'
            }`}
            aria-label="Copy Room Code"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#12121E] p-6 shadow-2xl text-center">
            <h3 id="qr-modal-title" className="text-lg font-bold text-white">Scan to Join Mesh</h3>
            <p className="mt-1 text-xs text-zinc-400">Point guest smartphone camera to lock into synchronized surround audio</p>

            {qrDataUrl && (
              <div className="mx-auto my-5 flex w-fit items-center justify-center rounded-2xl bg-white p-3 shadow-2xl">
                <img src={qrDataUrl} alt={`QR Code for room ${roomCode}`} className="h-56 w-56 rounded-lg" />
              </div>
            )}

            <div className="text-center font-mono text-sm tracking-widest text-cyan-400 font-bold mb-4">
              ROOM: {roomCode}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 rounded-xl bg-white/10 py-2.5 text-xs font-semibold text-white hover:bg-white/15 transition-all"
              >
                Copy URL
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-semibold text-white hover:bg-violet-700 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
