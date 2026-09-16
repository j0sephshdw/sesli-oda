import React, { useState, useRef, useEffect } from 'react';
import {
  RoomAudioRenderer,
  ParticipantTile,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useChat
} from '@livekit/components-react';

export default function AudioRoom({ roomName, onLeave }) {
  const room = useRoomContext();
  // Odadaki herkesi (mikrofonu kapalı olsa bile) listeler
  const participants = useParticipants(); 
  
  const { localParticipant, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();

  // Custom Chat Sistemi (Kayıp mesaj sorununu çözer)
  const { send, chatMessages } = useChat();
  const [msg, setMsg] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (msg.trim()) {
      send(msg);
      setMsg('');
    }
  };

  const copyInvite = () => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url);
    alert('✅ Davet linki kopyalandı! Arkadaşlarına gönderebilirsin.');
  };

  return (
    <div className="custom-room-layout">
      {/* SOL PANEL: KİŞİLER VE KONTROLLER */}
      <div className="main-panel">
        <header className="room-header">
          <div className="header-info">
            <h3>🔊 Oda: {roomName}</h3>
            <span className="live-badge">🔴 Canlı</span>
            <span className="people-count">👥 {participants.length} Kişi</span>
          </div>
          <button onClick={copyInvite} className="invite-btn">🔗 Davet Linki Kopyala</button>
        </header>

        {/* Odadaki Herkesin Listelendiği Alan */}
        <div className="participants-grid">
          {participants.map((p) => (
            <ParticipantTile 
              key={p.identity} 
              participant={p} 
              disableVideoFallback={false}
            />
          ))}
        </div>

        {/* Özel Kontrol Butonlarımız (Asla Kaybolmaz) */}
        <footer className="room-controls-wrapper">
          <div className="main-controls">
            <button 
              className={`ctrl-btn ${!isMicrophoneEnabled ? 'muted' : 'active'}`} 
              onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            >
              {isMicrophoneEnabled ? '🎙️ Mikrofonu Kapat' : '🔇 Mikrofonu Aç'}
            </button>
            
            <button 
              className={`ctrl-btn ${isScreenShareEnabled ? 'active' : ''}`} 
              onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
            >
              📺 {isScreenShareEnabled ? 'Yayını Durdur' : 'Ekran Paylaş'}
            </button>

            <button className="leave-btn" onClick={onLeave}>
              🚪 Odadan Ayrıl
            </button>
          </div>
        </footer>
      </div>

      {/* SAĞ PANEL: GARANTİLİ YAZILI SOHBET */}
      <div className="custom-chat-panel">
        <div className="chat-header">💬 Yazılı Sohbet</div>
        <div className="chat-messages">
          <div className="chat-sys-msg">Odaya giriş yapıldı. Mesajlar uçtan uca şifrelidir.</div>
          {chatMessages.map(m => (
            <div key={m.id} className="chat-msg">
              <span className="chat-sender">{m.from?.identity.split('_')[0]}:</span>
              <span className="chat-text">{m.message}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input-area">
          <input 
            value={msg} 
            onChange={e => setMsg(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
            placeholder="Mesaj yaz..." 
          />
          <button onClick={handleSendMessage}>Gönder</button>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}