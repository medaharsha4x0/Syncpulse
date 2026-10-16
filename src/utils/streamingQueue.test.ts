import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTrack,
  addToQueue,
  removeFromQueue,
  reorderQueue,
  voteTrackInQueue,
  sortByVotes,
  advanceQueue,
  type StreamingTrack,
} from './streamingQueue.ts';

const mockTrack: StreamingTrack = {
  id: 'spot_123',
  providerId: '123',
  provider: 'spotify',
  title: 'Blinding Lights',
  artist: 'The Weeknd',
  album: 'After Hours',
  albumArt: 'https://example.com/art.jpg',
  durationMs: 200000,
  previewUrl: 'https://example.com/preview.mp3',
};

test('normalizeTrack parses raw Apple Music / iTunes response', () => {
  const rawApple = {
    trackId: 1440857781,
    trackName: 'Starboy',
    artistName: 'The Weeknd',
    collectionName: 'Starboy',
    artworkUrl100: 'https://example.com/100x100bb.jpg',
    trackTimeMillis: 230453,
    previewUrl: 'https://example.com/starboy_preview.m4a',
  };

  const normalized = normalizeTrack(rawApple, 'apple-music');
  assert.equal(normalized.id, 'am_1440857781');
  assert.equal(normalized.title, 'Starboy');
  assert.equal(normalized.artist, 'The Weeknd');
  assert.equal(normalized.previewUrl, 'https://example.com/starboy_preview.m4a');
  assert.ok(normalized.albumArt.includes('300x300bb'));
});

test('party queue add, remove, and reorder operations', () => {
  let queue = addToQueue([], mockTrack, 'Host');
  assert.equal(queue.length, 1);
  assert.equal(queue[0].title, 'Blinding Lights');
  assert.equal(queue[0].addedBy, 'Host');

  const secondTrack: StreamingTrack = {
    ...mockTrack,
    id: 'spot_456',
    title: 'Levitating',
  };
  queue = addToQueue(queue, secondTrack, 'Guest 1');
  assert.equal(queue.length, 2);

  // Reorder index 1 to 0
  const reordered = reorderQueue(queue, 1, 0);
  assert.equal(reordered[0].title, 'Levitating');
  assert.equal(reordered[1].title, 'Blinding Lights');

  // Remove by queueId
  const remaining = removeFromQueue(reordered, queue[0].queueId);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].title, 'Levitating');
});

test('voting and popularity sorting in party queue', () => {
  let queue = addToQueue([], mockTrack, 'Host');
  const trackAId = queue[0].queueId;

  const trackB: StreamingTrack = { ...mockTrack, id: 'spot_789', title: 'As It Was' };
  queue = addToQueue(queue, trackB, 'Guest');
  const trackBId = queue[1].queueId;

  // Device 1 and 2 vote for track B
  queue = voteTrackInQueue(queue, trackBId, 'dev_phone_1');
  queue = voteTrackInQueue(queue, trackBId, 'dev_phone_2');

  assert.equal(queue.find((t) => t.queueId === trackBId)?.votes, 2);

  // Device 1 unvotes track B (toggle)
  queue = voteTrackInQueue(queue, trackBId, 'dev_phone_1');
  assert.equal(queue.find((t) => t.queueId === trackBId)?.votes, 1);

  // Device 3 votes for track B
  queue = voteTrackInQueue(queue, trackBId, 'dev_phone_3');
  assert.equal(queue.find((t) => t.queueId === trackBId)?.votes, 2);

  // Sort by votes
  const sorted = sortByVotes(queue);
  assert.equal(sorted[0].title, 'As It Was');
});

test('advanceQueue rotates next track into current and stores history', () => {
  let queue = addToQueue([], mockTrack, 'Host');
  const track2: StreamingTrack = { ...mockTrack, id: 'spot_999', title: 'Save Your Tears' };
  queue = addToQueue(queue, track2, 'Host');

  const { currentTrack, upcoming, history } = advanceQueue(null, queue, []);
  assert.equal(currentTrack?.title, 'Blinding Lights');
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].title, 'Save Your Tears');
  assert.equal(history.length, 0);

  // Advance to next song
  const secondAdvance = advanceQueue(currentTrack, upcoming, history);
  assert.equal(secondAdvance.currentTrack?.title, 'Save Your Tears');
  assert.equal(secondAdvance.upcoming.length, 0);
  assert.equal(secondAdvance.history.length, 1);
  assert.equal(secondAdvance.history[0].title, 'Blinding Lights');
});
