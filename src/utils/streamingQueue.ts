/**
 * Streaming service integration models and Party Queue state machine.
 */

export type StreamingProvider = 'spotify' | 'apple-music' | 'local';

export interface StreamingTrack {
  id: string;
  providerId: string;
  provider: StreamingProvider;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  durationMs: number;
  previewUrl: string | null;
  externalUrl?: string;
  popularity?: number;
  bpm?: number;
}

export interface QueuedTrack extends StreamingTrack {
  queueId: string;
  addedBy: string;
  addedAt: number;
  votes: number;
  votedDeviceIds: string[];
}

export interface QueueState {
  currentTrack: QueuedTrack | null;
  upcoming: QueuedTrack[];
  history: QueuedTrack[];
}

/**
 * Creates a normalized streaming track object from raw API results
 */
export function normalizeTrack(
  raw: any,
  provider: StreamingProvider
): StreamingTrack {
  if (provider === 'apple-music') {
    return {
      id: `am_${raw.trackId || raw.id}`,
      providerId: String(raw.trackId || raw.id),
      provider: 'apple-music',
      title: raw.trackName || raw.attributes?.name || 'Unknown Track',
      artist: raw.artistName || raw.attributes?.artistName || 'Unknown Artist',
      album: raw.collectionName || raw.attributes?.albumName || '',
      albumArt:
        raw.artworkUrl100?.replace('100x100bb', '300x300bb') ||
        raw.attributes?.artwork?.url?.replace('{w}x{h}', '300x300') ||
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
      durationMs: raw.trackTimeMillis || raw.attributes?.durationInMillis || 30000,
      previewUrl: raw.previewUrl || raw.attributes?.previews?.[0]?.url || null,
      externalUrl: raw.trackViewUrl || raw.attributes?.url,
    };
  }

  // Spotify normalization
  return {
    id: `spot_${raw.id}`,
    providerId: raw.id,
    provider: 'spotify',
    title: raw.name || 'Unknown Track',
    artist: raw.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
    album: raw.album?.name || '',
    albumArt:
      raw.album?.images?.[0]?.url ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    durationMs: raw.duration_ms || 30000,
    previewUrl: raw.preview_url || null,
    externalUrl: raw.external_urls?.spotify,
    popularity: raw.popularity,
  };
}

/**
 * Pure functions for party queue transformations
 */
export function addToQueue(
  queue: QueuedTrack[],
  track: StreamingTrack,
  addedBy = 'Host'
): QueuedTrack[] {
  const queuedTrack: QueuedTrack = {
    ...track,
    queueId: 'q_' + Math.random().toString(36).substring(2, 9),
    addedBy,
    addedAt: Date.now(),
    votes: 0,
    votedDeviceIds: [],
  };
  return [...queue, queuedTrack];
}

export function removeFromQueue(queue: QueuedTrack[], queueId: string): QueuedTrack[] {
  return queue.filter((t) => t.queueId !== queueId);
}

export function reorderQueue(
  queue: QueuedTrack[],
  fromIndex: number,
  toIndex: number
): QueuedTrack[] {
  if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) {
    return queue;
  }
  const result = [...queue];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

export function voteTrackInQueue(
  queue: QueuedTrack[],
  queueId: string,
  deviceId: string
): QueuedTrack[] {
  return queue.map((track) => {
    if (track.queueId !== queueId) return track;
    const hasVoted = track.votedDeviceIds.includes(deviceId);
    const updatedDeviceIds = hasVoted
      ? track.votedDeviceIds.filter((id) => id !== deviceId)
      : [...track.votedDeviceIds, deviceId];

    return {
      ...track,
      votes: updatedDeviceIds.length,
      votedDeviceIds: updatedDeviceIds,
    };
  });
}

export function sortByVotes(queue: QueuedTrack[]): QueuedTrack[] {
  return [...queue].sort((a, b) => b.votes - a.votes);
}

export function advanceQueue(
  current: QueuedTrack | null,
  upcoming: QueuedTrack[],
  history: QueuedTrack[]
): { currentTrack: QueuedTrack | null; upcoming: QueuedTrack[]; history: QueuedTrack[] } {
  if (upcoming.length === 0) {
    return {
      currentTrack: null,
      upcoming: [],
      history: current ? [current, ...history].slice(0, 50) : history,
    };
  }

  const [next, ...remaining] = upcoming;
  const newHistory = current ? [current, ...history].slice(0, 50) : history;

  return {
    currentTrack: next,
    upcoming: remaining,
    history: newHistory,
  };
}
