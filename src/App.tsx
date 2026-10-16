import React, { useState, useEffect, useCallback } from 'react';
import { LobbyView } from './components/LobbyView';
import { HostDashboard } from './components/HostDashboard';
import { GuestView } from './components/GuestView';
import { useAudioSync } from './hooks/useAudioSync';
import { TrackMetadata } from './utils/audioPresets';

export default function App() {
  const [view, setView] = useState<'lobby' | 'host' | 'guest'>('lobby');
  const [roomCode, setRoomCode] = useState<string>('');
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const [deviceName, setDeviceName] = useState('Studio Console');
  const [notification, setNotification] = useState<string | null>(null);

  // Check URL parameters for autostart, join codes, etc.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    const autostart = params.get('autostart');
    const hostMode = params.get('host');

    if (joinCode) {
      setRoomCode(joinCode.toUpperCase());
      setRole('guest');
      setDeviceName('Mobile Node ' + Math.floor(Math.random() * 100));
      setView('guest');
    } else if (autostart === '1' || hostMode === '1') {
      // Create instant demo room for immediate testability
      handleCreateRoom('Master Host Console');
    }
  }, []);

  // Show temporary toast notification
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCreateRoom = async (hostDeviceName: string) => {
    try {
      const resp = await fetch('https://syncpulse-0gq1.onrender.com/api/rooms', { method: 'POST' });
      const data = await resp.json();
      if (data.success && data.roomCode) {
        setRoomCode(data.roomCode);
        setRole('host');
        setDeviceName(hostDeviceName);
        setView('host');
      } else {
        // Fallback local code if offline
        const localCode = 'PULSE9';
        setRoomCode(localCode);
        setRole('host');
        setDeviceName(hostDeviceName);
        setView('host');
      }
    } catch (err) {
      const localCode = 'PULSE9';
      setRoomCode(localCode);
      setRole('host');
      setDeviceName(hostDeviceName);
      setView('host');
    }
  };

  const handleJoinRoom = (code: string, guestDeviceName: string) => {
    setRoomCode(code.toUpperCase());
    setRole('guest');
    setDeviceName(guestDeviceName);
    setView('guest');
  };

  const handleLeaveRoom = () => {
    setView('lobby');
    setRoomCode('');
    // Remove query params
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  // Audio Sync Engine
  const {
    deviceId,
    isConnected,
    isArmed,
    armSpeaker,
    syncState,
    roundTripTime,
    clockOffset,
    jitter,
    driftMs,
    isPlaying,
    playbackPosition,
    duration,
    currentTrack,
    lookaheadMs,
    setLookaheadMs,
    activeChannel,
    setActiveChannel,
    isMuted,
    setIsMuted,
    acousticOffsetMs,
    adjustAcousticOffset,
    physicalDistanceMeters,
    setPhysicalDistance,
    connectedDevices,
    partyQueue,
    addToPartyQueue,
    removeFromPartyQueue,
    reorderPartyQueue,
    voteInPartyQueue,
    playQueuedTrack,
    playNextInQueue,
    hasCustomAudio,
    customAudioName,
    batterySaver,
    setBatterySaver,
    wakeLockActive,
    analyserNode,
    hostPlay,
    hostPause,
    hostSeek,
    hostChangeTrack,
    hostResyncAll,
    hostMuteDevice,
    hostKickDevice,
    hostSetDeviceChannel,
    startNTPHandshake,
  } = useAudioSync({
    roomCode: view !== 'lobby' ? roomCode : '',
    role,
    deviceName,
    onKicked: () => {
      showToast('You were disconnected from the speaker mesh by the host.');
      handleLeaveRoom();
    },
    onHostDisconnected: () => {
      showToast('The Host has ended this audio party session.');
      handleLeaveRoom();
    },
  });

  const handleUploadAudio = async (file: File) => {
    if (!roomCode) return;
    try {
      const resp = await fetch(`/api/rooms/${roomCode}/audio`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'audio/mpeg',
          'x-filename': file.name,
        },
        body: file,
      });
      const data = await resp.json();
      if (data.success) {
        showToast(`Track "${file.name}" uploaded & buffered across mesh!`);
      }
    } catch (err) {
      console.error(err);
      showToast('Upload failed. Please check file format.');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#08080C] text-white font-sans antialiased selection:bg-cyan-500 selection:text-black">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-cyan-500/30 bg-[#12121E]/95 px-5 py-2.5 text-xs font-semibold text-cyan-300 shadow-2xl backdrop-blur-xl animate-fadeIn">
          {notification}
        </div>
      )}

      {view === 'lobby' && (
        <LobbyView
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          initialRoomCode={roomCode}
        />
      )}

      {view === 'host' && (
        <HostDashboard
          roomCode={roomCode}
          deviceId={deviceId}
          isPlaying={isPlaying}
          playbackPosition={playbackPosition}
          duration={duration}
          currentTrack={currentTrack}
          lookaheadMs={lookaheadMs}
          setLookaheadMs={setLookaheadMs}
          connectedDevices={connectedDevices}
          partyQueue={partyQueue}
          analyserNode={analyserNode}
          roundTripTime={roundTripTime}
          clockOffset={clockOffset}
          jitter={jitter}
          driftMs={driftMs}
          syncState={syncState}
          hasCustomAudio={hasCustomAudio}
          customAudioName={customAudioName}
          onPlay={hostPlay}
          onPause={hostPause}
          onSeek={hostSeek}
          onChangeTrack={hostChangeTrack}
          onResyncAll={hostResyncAll}
          onMuteDevice={hostMuteDevice}
          onKickDevice={hostKickDevice}
          onSetChannel={hostSetDeviceChannel}
          onUploadAudio={handleUploadAudio}
          onAddToQueue={addToPartyQueue}
          onRemoveFromQueue={removeFromPartyQueue}
          onReorderQueue={reorderPartyQueue}
          onVoteTrack={voteInPartyQueue}
          onPlayQueuedTrack={playQueuedTrack}
          onPlayNext={playNextInQueue}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {view === 'guest' && (
        <GuestView
          roomCode={roomCode}
          deviceName={deviceName}
          deviceId={deviceId}
          isArmed={isArmed}
          armSpeaker={armSpeaker}
          syncState={syncState}
          isPlaying={isPlaying}
          currentTrack={currentTrack}
          roundTripTime={roundTripTime}
          clockOffset={clockOffset}
          jitter={jitter}
          driftMs={driftMs}
          acousticOffsetMs={acousticOffsetMs}
          adjustAcousticOffset={adjustAcousticOffset}
          physicalDistanceMeters={physicalDistanceMeters}
          setPhysicalDistance={setPhysicalDistance}
          activeChannel={activeChannel}
          setActiveChannel={setActiveChannel}
          isMuted={isMuted}
          batterySaver={batterySaver}
          setBatterySaver={setBatterySaver}
          wakeLockActive={wakeLockActive}
          analyserNode={analyserNode}
          onResync={startNTPHandshake}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </div>
  );
}
