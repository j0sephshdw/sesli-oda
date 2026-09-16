import React, { useState } from 'react';
import {
  RoomAudioRenderer,
  ControlBar,
  TrackLoop,
  ParticipantTile,
  Chat,
  useTracks,
  useRoomContext,
  useLocalParticipant
} from '@livekit/components-react';
import { Track } from 'livekit-client';

export default function AudioRoom({ roomName, onLeave }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [handRaised, setHandRaised] = useState(false);
  
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
    alert('✅ Davet linki kopyalandı!');
  };

  // Data Channels üzerinden interaktif özellikler
  const toggleHand = () => {
    setHandRaised(!handRaised);
    localParticipant.setAttributes({ handRaised: !handRaised ? 'true' : 'false' });
  };

  const sendEmoji = async (emoji) => {
    const strData = JSON.stringify({ type: 'emoji', emoji: emoji });
    const data = new TextEncoder().encode(strData);
    await localParticipant.publishData(data, { reliable: true });
    // Kendimiz için de ufak bir bildirim gösterebiliriz
  };

  return (
    <div className="custom-room-layout">
      <div className="main-panel">
        <header className="room-header">
          <div className="header-info">
            <h3>🔊 Oda: {roomName}</h3>
            <span className="live-badge">🔴 Canlı</span>
          </div>
          <button onClick={copyInvite} className="invite-btn">🔗 Davet Linki Kopyala</button>
        </header>

        {/* Aktif konuşanı belirginleştiren profil alanı */}
        <div className="participants-grid">
          <TrackLoop tracks={tracks}>
            <ParticipantTile />
          </TrackLoop>
        </div>

        {/* Özel Kontrol Çubuğu: Çift "Leave" butonu önlendi */}
        <footer className="room-controls-wrapper">
          <div className="interactive-actions">
            <button onClick={toggleHand} className={handRaised ? "action-btn active" : "action-btn"}>✋</button>
            <button onClick={() => sendEmoji('🔥')} className="action-btn">🔥</button>
            <button onClick={() => sendEmoji('👍')} className="action-btn">👍</button>
            <button onClick={() => sendEmoji('😂')} className="action-btn">😂</button>
          </div>
          
          <div className="main-controls">
             {/* leave: false yapılarak LiveKit'in orjinal kapatma butonu gizlendi */}
            <ControlBar controls={{ microphone: true, screenShare: true, camera: false, chat: false, leave: false }} />
            <button className="leave-btn" onClick={onLeave}>
              🚪 Odadan Ayrıl
            </button>
          </div>
        </footer>
      </div>

      <div className="chat-panel">
        <Chat />
      </div>

      <RoomAudioRenderer />
    </div>
  );
}