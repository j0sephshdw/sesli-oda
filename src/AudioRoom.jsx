import React from 'react';
import {
  RoomAudioRenderer,
  ControlBar,
  TrackLoop,
  ParticipantTile,
  Chat,
  useTracks,
  useRoomContext
} from '@livekit/components-react';
import { Track } from 'livekit-client';

export default function AudioRoom({ roomName }) {
  const room = useRoomContext();
  
  // Mikrofonları ve Ekran Paylaşımlarını ekrana çiz
  const tracks = useTracks(
    [
      { source: Track.Source.Microphone, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false }
    ],
    { onlySubscribed: false }
  );

  const copyInvite = () => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url);
    alert('✅ Davet linki kopyalandı! Arkadaşlarına gönderebilirsin.');
  };

  return (
    <div className="custom-room-layout">
      {/* SOL PANEL (Kişiler ve Kontroller) */}
      <div className="main-panel">
        <header className="room-header">
          <div className="header-info">
            <h3>🔊 Oda: {roomName}</h3>
            <span className="live-badge">🔴 Canlı</span>
          </div>
          <button onClick={copyInvite} className="invite-btn">🔗 Davet Linki Kopyala</button>
        </header>

        {/* Kişilerin Kutucukları */}
        <div className="participants-grid">
          <TrackLoop tracks={tracks}>
            <ParticipantTile />
          </TrackLoop>
        </div>

        {/* Butonlar */}
        <footer className="room-controls">
          <ControlBar 
            controls={{ microphone: true, screenShare: true, camera: false, chat: false }} 
          />
          <button className="leave-btn" onClick={() => room.disconnect()}>
            🚪 Odadan Ayrıl
          </button>
        </footer>
      </div>

      {/* SAĞ PANEL (Sohbet) */}
      <div className="chat-panel">
        <Chat />
      </div>

      <RoomAudioRenderer />
    </div>
  );
}