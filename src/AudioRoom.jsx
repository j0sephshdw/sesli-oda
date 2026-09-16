import React, { useState, useRef, useEffect } from 'react';
import {
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useChat,
  useTracks,
  TrackLoop,
  ParticipantTile
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { KrispNoiseFilter, isKrispNoiseFilterSupported } from '@livekit/krisp-noise-filter';

export default function AudioRoom({ roomName, onLeave }) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();

  // Sadece ekran paylaşımlarını yakala
  const screenTracks = useTracks([Track.Source.ScreenShare]);

  // %100 Çalışan Custom Chat Sistemi
  const { send, chatMessages } = useChat();
  const [msg, setMsg] = useState('');
  const chatEndRef = useRef(null);

  // Krisp AI Gürültü Engelleyici Yönetimi
  const [krispProcessor, setKrispProcessor] = useState(null);
  const [isKrispActive, setIsKrispActive] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    // Tarayıcı destekliyorsa Krisp motorunu hazırla
    if (isKrispNoiseFilterSupported()) {
      setKrispProcessor(KrispNoiseFilter());
    }
  }, []);

  const handleSendMessage = () => {
    if (msg.trim()) {
      send(msg);
      setMsg('');
    }
  };

  const toggleKrisp = async () => {
    if (!krispProcessor) return alert("Tarayıcınız Krisp AI desteklemiyor.");
    const trackPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
    const track = trackPub?.audioTrack;

    if (!track) return alert("Önce mikrofonu açmalısınız!");

    if (isKrispActive) {
      await track.stopProcessor();
      setIsKrispActive(false);
    } else {
      await track.setProcessor(krispProcessor);
      setIsKrispActive(true);
    }
  };

  return (
    <div className="custom-room-layout">
      {/* SOL PANEL */}
      <div className="main-panel">
        <header className="room-header">
          <div className="header-info">
            <h3>🔊 Oda: {roomName}</h3>
            <span className="live-badge">🔴 Canlı</span>
            <span className="people-count">👥 {participants.length} Kişi</span>
          </div>
        </header>

        {/* DİNAMİK EKRAN: Ekran Paylaşımı varsa onu göster, yoksa İSİM+EMOJİ kartlarını göster */}
        <div className="dynamic-view-area">
          {screenTracks.length > 0 ? (
            <div className="screen-share-grid">
              <TrackLoop tracks={screenTracks}>
                <ParticipantTile />
              </TrackLoop>
            </div>
          ) : (
            <div className="voice-users-grid">
              {participants.map((p) => (
                <div key={p.identity} className={`voice-user-card ${p.isSpeaking ? 'speaking' : ''}`}>
                  <div className="avatar">👤</div>
                  <div className="name">{p.identity.split('_')[0]}</div>
                  {p.isSpeaking && <div className="speak-ring">🎙️</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ALT KONTROL BUTONLARI */}
        <footer className="room-controls-wrapper">
          <div className="main-controls">
            <button
              className={`ctrl-btn ${!isMicrophoneEnabled ? 'muted' : 'active'}`}
              onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            >
              {isMicrophoneEnabled ? '🎙️ Mikrofon Açık' : '🔇 Mikrofon Kapalı'}
            </button>

            {/* KRISP AI GÜRÜLTÜ ENGELLEME BUTONU */}
            <button
              className={`ctrl-btn ${isKrispActive ? 'krisp-active' : ''}`}
              onClick={toggleKrisp}
            >
              🎧 {isKrispActive ? 'Gürültü Engelleyici (AÇIK)' : 'Gürültü Engelleyici (KAPALI)'}
            </button>

            <button
              className={`ctrl-btn ${isScreenShareEnabled ? 'active' : ''}`}
              onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
            >
              📺 {isScreenShareEnabled ? 'Yayını Kapat' : 'Ekran Paylaş'}
            </button>

            <button className="leave-btn" onClick={onLeave}>🚪 Ayrıl</button>
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