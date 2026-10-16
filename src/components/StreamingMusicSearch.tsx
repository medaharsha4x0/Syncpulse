import React, { useState, useEffect } from 'react';
import {
  Search,
  Music,
  Plus,
  Play,
  ThumbsUp,
  Trash2,
  MoveUp,
  MoveDown,
  Sparkles,
  ExternalLink,
  Info,
  Radio,
  Layers,
  Check,
  Disc,
  Clock,
} from 'lucide-react';
import { StreamingTrack, QueuedTrack, StreamingProvider } from '../utils/streamingQueue';

interface StreamingMusicSearchProps {
  queue: QueuedTrack[];
  currentTrackId?: string;
  onAddToQueue: (track: StreamingTrack) => void;
  onRemoveFromQueue: (queueId: string) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onVoteTrack: (queueId: string) => void;
  onPlayQueuedTrack: (queueId: string, track?: StreamingTrack) => void;
  onPlayNext: () => void;
  deviceId: string;
}

export const StreamingMusicSearch: React.FC<StreamingMusicSearchProps> = ({
  queue,
  currentTrackId,
  onAddToQueue,
  onRemoveFromQueue,
  onReorderQueue,
  onVoteTrack,
  onPlayQueuedTrack,
  onPlayNext,
  deviceId,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'queue'>('search');
  const [provider, setProvider] = useState<StreamingProvider>('spotify');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StreamingTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedTrackIds, setAddedTrackIds] = useState<Record<string, boolean>>({});
  const [showDrmModal, setShowDrmModal] = useState(false);

  // Debounced live search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await fetch(
          `/api/music/search?q=${encodeURIComponent(query)}&provider=${provider}`
        );
        const data = await resp.json();
        if (data.success && data.tracks) {
          setResults(data.tracks);
        }
      } catch (err) {
        console.error('Failed to search tracks:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, provider]);

  const handleAdd = (track: StreamingTrack) => {
    onAddToQueue(track);
    setAddedTrackIds((prev) => ({ ...prev, [track.id]: true }));
    setTimeout(() => {
      setAddedTrackIds((prev) => ({ ...prev, [track.id]: false }));
    }, 1500);
  };

  const formatDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0E0E18]/80 p-6 backdrop-blur-2xl shadow-2xl space-y-5">
      {/* Header and View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-400 p-[2px]">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#08080C]">
              <Music className="h-4 w-4 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              Streaming Music Hub
              <button
                onClick={() => setShowDrmModal(true)}
                className="text-zinc-500 hover:text-cyan-400 transition-colors"
                title="API & DRM Capabilities"
                aria-label="API and DRM Information"
              >
                <Info className="h-4 w-4" />
              </button>
            </h3>
            <p className="text-xs text-zinc-400">Spotify & Apple Music catalog search & party queue</p>
          </div>
        </div>

        {/* Search vs Queue Tabs */}
        <div className="flex rounded-2xl bg-[#08080E] p-1 border border-white/5">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'search'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search Catalog</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'queue'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Party Queue</span>
            {queue.length > 0 && (
              <span className="rounded-full bg-cyan-400/20 px-1.5 py-0.2 text-[10px] font-mono text-cyan-300">
                {queue.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'search' ? (
        <div className="space-y-4">
          {/* Provider Selector & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Service Toggle */}
            <div className="flex rounded-2xl bg-[#08080E] p-1 border border-white/5">
              <button
                onClick={() => setProvider('spotify')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                  provider === 'spotify'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-600/10'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Spotify</span>
              </button>
              <button
                onClick={() => setProvider('apple-music')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                  provider === 'apple-music'
                    ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 shadow-lg shadow-rose-600/10'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span>Apple Music</span>
              </button>
            </div>

            {/* Input Field */}
            <div className="relative flex-1 flex items-center rounded-2xl border border-white/10 bg-[#08080E] px-4 py-2 focus-within:border-cyan-500">
              <Search className="h-4 w-4 text-zinc-400 mr-2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${provider === 'spotify' ? 'Spotify' : 'Apple Music'} songs, artists, albums...`}
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
              {isSearching && (
                <div className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin ml-2" />
              )}
            </div>
          </div>

          {/* Quick Search Chips */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            <span className="text-zinc-500 font-mono">Popular:</span>
            {['Daft Punk', 'The Weeknd', 'Synthwave', 'Midnight City', 'Dua Lipa', 'Hans Zimmer'].map((term) => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                className="rounded-lg bg-white/5 hover:bg-white/10 px-2 py-1 text-zinc-300 hover:text-white transition-all active:scale-95"
              >
                {term}
              </button>
            ))}
          </div>

          {/* Search Results List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {results.map((track) => {
              const isAdded = addedTrackIds[track.id];
              return (
                <div
                  key={track.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] p-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={track.albumArt}
                      alt={track.title}
                      className="h-12 w-12 rounded-xl object-cover shadow-md shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-xs sm:text-sm truncate">
                        {track.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {track.artist} • {track.album}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase ${
                            track.provider === 'spotify'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {track.provider}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {formatDuration(track.durationMs)}
                        </span>
                        {track.previewUrl && (
                          <span className="rounded bg-cyan-500/10 px-1 py-0.2 text-[9px] font-mono text-cyan-400 border border-cyan-500/20">
                            HQ PREVIEW SYNC
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Add to Queue Button */}
                    <button
                      onClick={() => handleAdd(track)}
                      className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                        isAdded
                          ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {isAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{isAdded ? 'Added' : 'Queue'}</span>
                    </button>

                    {/* Instant Mesh Sync Play Button */}
                    {track.previewUrl && (
                      <button
                        onClick={() => onPlayQueuedTrack(track.id, track)}
                        className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-600/20 hover:scale-105 active:scale-95 transition-all"
                        title="Broadcast Play across Mesh"
                      >
                        <Play className="h-3.5 w-3.5 fill-white" />
                        <span className="hidden sm:inline">Play Now</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {results.length === 0 && query.trim() && !isSearching && (
              <div className="py-8 text-center text-xs text-zinc-500">
                No matching tracks found on {provider === 'spotify' ? 'Spotify' : 'Apple Music'}. Try another query.
              </div>
            )}

            {results.length === 0 && !query.trim() && (
              <div className="py-8 text-center text-xs text-zinc-500">
                Type an artist, track, or album above to search millions of songs.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Party Queue View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-400">
              {queue.length} track{queue.length === 1 ? '' : 's'} scheduled for synchronized playback
            </div>

            {queue.length > 0 && (
              <button
                onClick={onPlayNext}
                className="flex items-center gap-1 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-all"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Play Next Song</span>
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {queue.map((track, index) => {
              const hasVoted = track.votedDeviceIds.includes(deviceId);
              return (
                <div
                  key={track.queueId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] p-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono font-bold text-zinc-500 w-5 text-center">
                      #{index + 1}
                    </span>
                    <img
                      src={track.albumArt}
                      alt={track.title}
                      className="h-11 w-11 rounded-xl object-cover shadow-md shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-xs sm:text-sm truncate">
                        {track.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {track.artist}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-500">
                          Added by {track.addedBy}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold uppercase ${
                            track.provider === 'spotify'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {track.provider}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Upvote Button */}
                    <button
                      onClick={() => onVoteTrack(track.queueId)}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-mono font-semibold transition-all ${
                        hasVoted
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                      }`}
                      title="Vote for this song to play sooner"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>{track.votes}</span>
                    </button>

                    {/* Reorder Up / Down */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => onReorderQueue(index, index - 1)}
                        disabled={index === 0}
                        className="text-zinc-500 hover:text-white disabled:opacity-20 p-0.5"
                        title="Move Up"
                      >
                        <MoveUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onReorderQueue(index, index + 1)}
                        disabled={index === queue.length - 1}
                        className="text-zinc-500 hover:text-white disabled:opacity-20 p-0.5"
                        title="Move Down"
                      >
                        <MoveDown className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Play Queued Track Directly */}
                    <button
                      onClick={() => onPlayQueuedTrack(track.queueId, track)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/30 hover:bg-violet-600 text-violet-300 hover:text-white transition-all"
                      title="Play Immediately"
                    >
                      <Play className="h-3.5 w-3.5 ml-0.5" />
                    </button>

                    {/* Remove Track */}
                    <button
                      onClick={() => onRemoveFromQueue(track.queueId)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                      title="Remove from queue"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {queue.length === 0 && (
              <div className="py-10 text-center text-xs text-zinc-500 space-y-2">
                <Music className="h-8 w-8 mx-auto text-zinc-600" />
                <p>The party queue is currently empty.</p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 px-3 py-1.5 text-xs text-violet-300 font-semibold"
                >
                  Search & Add Songs
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streaming & DRM Architecture Modal */}
      {showDrmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="streaming-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#141424] p-6 shadow-2xl space-y-4">
            <h3 id="streaming-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-400" />
              Streaming API & DRM Architecture
            </h3>

            <div className="text-xs text-zinc-300 space-y-3 leading-relaxed">
              <p>
                <strong className="text-white">Why Spotify & Apple Music DRM matters:</strong> Commercial
                streaming providers encrypt full-length songs with FairPlay (Apple) and Widevine (Spotify/Google)
                Digital Rights Management. Browsers and native apps receive protected encrypted byte streams that are
                decoded inside closed OS hardware sandboxes.
              </p>

              <div className="rounded-2xl border border-white/5 bg-[#0A0A12] p-3 space-y-2 font-mono text-[11px]">
                <div className="text-cyan-400 font-bold">SyncPulse Dual-Tier Architecture:</div>
                <div className="text-zinc-300">
                  1. <strong>Synchronized Mesh Array</strong>: High-fidelity (256/320kbps) audio streams & custom
                  MP3/WAV/FLAC masters are decoded directly into Web Audio <code className="text-violet-300">AudioBuffer</code> instances across all guest smartphones for zero-drift scheduled playback.
                </div>
                <div className="text-zinc-300">
                  2. <strong>Native Companion Apps</strong>: Native iOS (<code className="text-cyan-300">AVAudioEngine</code>) and Android (<code className="text-emerald-300">AAudio / Oboe</code>) companions leverage native MusicKit & Spotify App Remote tokens with sample-accurate hardware clock scheduling.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowDrmModal(false)}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
