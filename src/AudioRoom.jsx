import React from 'react';
import {
  RoomAudioRenderer,
  ControlBar,
  GridLayout,
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
  
  // withPlaceholder: true sayesinde mikrofonu kapalı olanlar da ekranda görünür!
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

  const sendEmoji = async (emoji) => {
    const strData = JSON.stringify({ type: 'emoji', emoji: emoji });
    const data = new TextEncoder().encode(strData);
    await localParticipant.publishData(data, { reliable: true });
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

        {/* ÇÖKEN KISIM BURASIYDI: GridLayout ile değiştirdik, artık sorunsuz! */}
        <div className="participants-grid">
          <GridLayout tracks={tracks} style={{ height: '100%', width: '100%' }}>
            <ParticipantTile />
          </GridLayout>
        </div>

        {/* ALT BUTONLAR */}
        <footer className="room-controls-wrapper">
          <div className="interactive-actions">
            <button onClick={() => sendEmoji('✋')} className="action-btn">✋</button>
            <button onClick={() => sendEmoji('🔥')} className="action-btn">🔥</button>
            <button onClick={() => sendEmoji('👍')} className="action-btn">👍</button>
            <button onClick={() => sendEmoji('😂')} className="action-btn">😂</button>
          </div>
          
          <div className="main-controls">
            {/* LiveKit'in varsayılan profesyonel butonları */}
            <ControlBar controls={{ microphone: true, screenShare: true, camera: false, chat: false, leave: false }} />
            <button className="leave-btn" onClick={onLeave}>
              🚪 Odadan Ayrıl
            </button>
          </div>
        </footer>
      </div>

      {/* SAĞ PANEL (Garantili Yazılı Sohbet) */}
      <div className="chat-panel">
        <Chat />
      </div>

      <RoomAudioRenderer />
    </div>
  );
}