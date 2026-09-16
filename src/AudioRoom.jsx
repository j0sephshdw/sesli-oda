import React, { useState, useRef, useEffect } from 'react';
import {
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useChat,
  useTracks,
  TrackLoop,
  ParticipantTile,
  ConnectionQualityIndicator
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import { KrispNoiseFilter, isKrispNoiseFilterSupported } from '@livekit/krisp-noise-filter';

export default function AudioRoom({ roomName, onLeave }) {
  const room = useRoomContext();
  const participants = useParticipants(); 
  const { localParticipant, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  
  const { send, chatMessages } = useChat();
  const [msg, setMsg] = useState('');
  const chatEndRef = useRef(null);

  const [krispProcessor, setKrispProcessor] = useState(null);
  const [isKrispActive, setIsKrispActive] = useState(false);
  const [krispLoading, setKrispLoading] = useState(false);

  // Otomatik Sohbet Kaydırma
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Krisp AI Hazırlığı
  useEffect(() => {
    if (isKrispNoiseFilterSupported()) setKrispProcessor(KrispNoiseFilter());
  }, []);

  // Giriş / Çıkış Ses Efektleri (SFX)
  useEffect(() => {
    const playTone = (type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine';
            if (type === 'join') {
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
            } else {
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
            }
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc.start(); osc.stop(ctx.currentTime + 0.15);
        } catch(e) {}
    };

    const handleJoin = () => playTone('join');
    const handleLeave = () => playTone('leave');

    room.on(RoomEvent.ParticipantConnected, handleJoin);
    room.on(RoomEvent.ParticipantDisconnected, handleLeave);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleJoin);
      room.off(RoomEvent.ParticipantDisconnected, handleLeave);
    }
  }, [room]);

  const handleSendMessage = () => {
    if (msg.trim()) { send(msg); setMsg(''); }
  };

  const copyInvite = () => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url);
    alert('✅ Davet linki kopyalandı! Arkadaşlarına gönderebilirsin.');
  };

  const sendEmoji = async (emoji) => {
    const data = new TextEncoder().encode(JSON.stringify({ type: 'emoji', emoji }));
    await localParticipant.publishData(data, { reliable: true });
  };

  const toggleKrisp = async () => {
    if (!isKrispNoiseFilterSupported()) return alert("Tarayıcınız Krisp AI desteklemiyor.");
    const trackPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
    const track = trackPub?.track;

    if (!track || !isMicrophoneEnabled) return alert("⚠️ Krisp AI'yi açabilmek için mikrofonunuz açık olmalı!");

    try {
      setKrispLoading(true);
      if (isKrispActive) {
        await track.stopProcessor();
        setIsKrispActive(false);
      } else {
        await track.setProcessor(krispProcessor);
        setIsKrispActive(true);
      }
    } catch (err) {
      alert("Gürültü engelleyici yüklenemedi: " + err.message);
    } finally {
      setKrispLoading(false);
    }
  };

  // Saat formatlayıcı
  const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="custom-room-layout">
      <div className="main-panel">
        <header className="room-header">
          <div className="header-info">
            <h3>🔊 Oda: {roomName}</h3>
            <span className="live-badge">🔴 Canlı</span>
            <span className="people-count">👥 {participants.length} Kişi</span>
          </div>
          <button onClick={copyInvite} className="invite-btn">🔗 Davet Linki Kopyala</button>
        </header>

        {/* ZEKİ DİNAMİK EKRAN */}
        <div className={`dynamic-view-area ${screenTracks.length > 0 ? 'has-screen' : ''}`}>
          {screenTracks.length > 0 && (
            <div className="screen-share-stage">
              <TrackLoop tracks={screenTracks}>
                <ParticipantTile />
              </TrackLoop>
            </div>
          )}
          
          <div className="voice-users-grid">
            {participants.map((p) => (
              <div key={p.identity} className={`voice-user-card ${p.isSpeaking ? 'speaking' : ''}`}>
                <div className="quality-indicator"><ConnectionQualityIndicator participant={p} /></div>
                <div className="avatar">👤</div>
                <div className="name">{p.identity.split('_')[0]}</div>
                {p.isSpeaking && <div className="speak-ring">🎙️ Konuşuyor</div>}
              </div>
            ))}
          </div>
        </div>

        <footer className="room-controls-wrapper">
          <div className="interactive-actions">
            <button onClick={() => sendEmoji('✋')} className="action-btn">✋</button>
            <button onClick={() => sendEmoji('🔥')} className="action-btn">🔥</button>
            <button onClick={() => sendEmoji('👍')} className="action-btn">👍</button>
            <button onClick={() => sendEmoji('😂')} className="action-btn">😂</button>
          </div>
          
          <div className="main-controls">
            <button className={`ctrl-btn ${!isMicrophoneEnabled ? 'muted' : 'active'}`} onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}>
              {isMicrophoneEnabled ? '🎙️ Mikrofon Açık' : '🔇 Mikrofon Kapalı'}
            </button>

            <button className={`ctrl-btn ${isKrispActive ? 'krisp-active' : ''}`} onClick={toggleKrisp} disabled={krispLoading}>
              🎧 {krispLoading ? 'Yükleniyor...' : isKrispActive ? 'Gürültü Engelleyici (AÇIK)' : 'Gürültü Engelleyici'}
            </button>
            
            <button className={`ctrl-btn ${isScreenShareEnabled ? 'active' : ''}`} onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}>
              📺 {isScreenShareEnabled ? 'Yayını Durdur' : 'Ekran Paylaş'}
            </button>

            <button className="leave-btn" onClick={onLeave}>🚪 Ayrıl</button>
          </div>
        </footer>
      </div>

      <div className="custom-chat-panel">
        <div className="chat-header">💬 Yazılı Sohbet</div>
        <div className="chat-messages">
          <div className="chat-sys-msg">Mesajlar uçtan uca şifrelidir.</div>
          {chatMessages.map(m => (
            <div key={m.id} className="chat-msg">
              <div className="chat-msg-header">
                <span className="chat-sender">{m.from?.identity.split('_')[0]}</span>
                <span className="chat-time">{formatTime(m.timestamp)}</span>
              </div>
              <div className="chat-text">{m.message}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-input-area">
          <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Mesaj yaz..." />
          <button onClick={handleSendMessage}>Gönder</button>
        </div>
      </div>
      <RoomAudioRenderer />
    </div>
  );
}