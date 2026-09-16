import React from 'react';
import {
  RoomAudioRenderer,
  ControlBar,
  TrackLoop, // HATA BURADAYDI: ParticipantLoop yerine TrackLoop kullanmalıyız
  ParticipantTile,
  Chat,
  useTracks,
  useRoomContext
} from '@livekit/components-react';
import { Track } from 'livekit-client';

export default function AudioRoom({ roomName, onLeave }) {
  const room = useRoomContext();
  
  // Sadece mikrofon ve ekran paylaşımı parçalarını alıyoruz.
  // withPlaceholder: true sayesinde kamerası kapalı olanların profil kutusu görünür!
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
      {/* Sol Panel: Kullanıcılar, Ekran Paylaşımı ve Kontroller */}
      <div className="main-panel">
        <header className="room-header">
          <h3>🔊 Oda: {roomName}</h3>
          <button onClick={copyInvite} className="invite-btn">🔗 Davet Linki Kopyala</button>
        </header>

        {/* Katılımcıların ve Ekran Paylaşımlarının Listelendiği Alan */}
        <div className="participants-grid">
          <TrackLoop tracks={tracks}>
            <ParticipantTile />
          </TrackLoop>
        </div>

        {/* Mikrofon, Yayın Açma ve Ayrılma Butonları */}
        <footer className="room-controls">
          <ControlBar 
            controls={{ microphone: true, screenShare: true, camera: false, chat: false }} 
          />
          <button className="leave-btn" onClick={() => room.disconnect()}>
            🚪 Odadan Ayrıl
          </button>
        </footer>
      </div>

      {/* Sağ Panel: Yazılı Sohbet */}
      <div className="chat-panel">
        <Chat />
      </div>

      {/* Arka planda seslerin çalmasını sağlayan zorunlu bileşen */}
      <RoomAudioRenderer />
    </div>
  );
}