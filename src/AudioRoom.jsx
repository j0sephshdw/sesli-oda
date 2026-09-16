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

  const [isKrispActive, setIsKrispActive] = useState(false);
  const [krispStatus, setKrispStatus] = useState('🎧 Gürültü Engelleyici (KAPALI)');
  const [inviteText, setInviteText] = useState('🔗 Davet Linki Kopyala');
  const [isDeafened, setIsDeafened] = useState(false); // Kulaklık Sustur
  const [floatingEmojis, setFloatingEmojis] = useState([]); // Ekranda yüzen emojiler

  const processorRef = useRef(null);

  // Otomatik Sohbet Kaydırma
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Krisp Kurulumu
  useEffect(() => {
    const setupKrisp = async () => {
      if (!isMicrophoneEnabled) {
        setIsKrispActive(false);
        setKrispStatus('🎧 Mikrofon Kapalı');
        return;
      }

      if (!isKrispNoiseFilterSupported()) {
        setKrispStatus('🚫 Tarayıcı Desteklemiyor');
        return;
      }

      const track = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
      if (!track) return;

      try {
        setKrispStatus('🎧 Filtre Başlatılıyor...');
        const currentProcessor = KrispNoiseFilter();
        processorRef.current = currentProcessor;

        await track.setProcessor(currentProcessor);
        setIsKrispActive(true);
        setKrispStatus('🎧 Gürültü Engelleyici (AÇIK)');
      } catch (err) {
        console.error('Krisp Aktifleştirme Hatası:', err);
        setKrispStatus('🎧 Gürültü Engelleyici (HATA)');
        setIsKrispActive(false);
      }
    };

    setupKrisp();

    return () => {
      const track = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
      if (track && processorRef.current) {
        track.stopProcessor().catch(() => {});
        processorRef.current = null;
      }
    };
  }, [isMicrophoneEnabled, localParticipant]);

  // Ses Efektleri & Veri Paket Dinleyicisi (Yüzen Emojiler İçin)
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

    // LiveKit Data Packet Alımı (Anlık Canlı Tepkiler)
    const handleDataReceived = (payload, participant) => {
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);
        if (data.type === 'EMOJI_REACTION') {
          spawnFloatingEmoji(data.emoji);
        }
      } catch(e) {}
    };

    room.on(RoomEvent.ParticipantConnected, () => playTone('join'));
    room.on(RoomEvent.ParticipantDisconnected, () => playTone('leave'));
    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.removeAllListeners(RoomEvent.ParticipantConnected);
      room.removeAllListeners(RoomEvent.ParticipantDisconnected);
      room.removeAllListeners(RoomEvent.DataReceived);
    };
  }, [room]);

  // Yüzen Emoji Oluşturucu
  const spawnFloatingEmoji = (emoji) => {
    const id = Date.now() + Math.random();
    const leftPos = Math.floor(Math.random() * 60) + 20; // %20 ile %80 arasında rastgele x pozisyonu
    setFloatingEmojis((prev) => [...prev, { id, emoji, left: leftPos }]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  // Emoji Gönderme Fonksiyonu (Data Packet ile)
  const sendEmojiReaction = (emoji) => {
    spawnFloatingEmoji(emoji);
    const data = JSON.stringify({ type: 'EMOJI_REACTION', emoji });
    const encoder = new TextEncoder();
    room.localParticipant.publishData(encoder.encode(data), { reliable: true });
  };

  const handleSendMessage = () => {
    if (msg.trim()) { send(msg); setMsg(''); }
  };

  const copyInvite = () => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url);
    setInviteText('✅ Kopyalandı!');
    setTimeout(() => setInviteText('🔗 Davet Linki Kopyala'), 2000);
  };

  const toggleKrisp = async () => {
    const track = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
    if (!track || !isMicrophoneEnabled) return;

    try {
      if (isKrispActive && processorRef.current) {
        await track.stopProcessor();
        processorRef.current = null;
        setIsKrispActive(false);
        setKrispStatus('🎧 Gürültü Engelleyici (KAPALI)');
      } else {
        const newProcessor = KrispNoiseFilter();
        processorRef.current = newProcessor;
        await track.setProcessor(newProcessor);
        setIsKrispActive(true);
        setKrispStatus('🎧 Gürültü Engelleyici (AÇIK)');
      }
    } catch (err) {
      console.error('Krisp Manuel Geçiş Hatası:', err);
    }
  };

  const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="custom-room-layout">
      {/* YÜZEN EMOJİ EKRANI (OVERLAY) */}
      <div className="floating-emoji-container">
        {floatingEmojis.map((item) => (
          <span key={item.id} className="floating-emoji" style={{ left: `${item.left}%` }}>
            {item.emoji}
          </span>
        ))}
      </div>

      <div className="main-panel">
        <header className="room-header">
          <div className="header-info">
            <h3>🔊 Oda: {roomName}</h3>
            <span className="live-badge">🔴 Canlı</span>
            <span className="people-count">👥 {participants.length} Kişi</span>
          </div>
          <button onClick={copyInvite} className="invite-btn">{inviteText}</button>
        </header>

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
                
                {!p.isMicrophoneEnabled ? (
                    <div className="muted-badge">🔇 Sustu</div>
                ) : p.isSpeaking ? (
                   <div className="waveform">
                     <span className="bar"></span><span className="bar"></span><span className="bar"></span>
                   </div>
                ) : null}
                
                {p.identity !== localParticipant.identity && (
                  <input 
                    type="range" min="0" max="1" step="0.01" defaultValue="1" 
                    className="vol-slider" title="Bu kişinin sesini ayarla"
                    onChange={(e) => {
                      const audioTrack = p.getTrackPublication(Track.Source.Microphone)?.track;
                      if (audioTrack && audioTrack.setVolume) audioTrack.setVolume(parseFloat(e.target.value));
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <footer className="room-controls-wrapper">
          <div className="interactive-actions">
            <button onClick={() => sendEmojiReaction('✋')} className="action-btn">✋</button>
            <button onClick={() => sendEmojiReaction('🔥')} className="action-btn">🔥</button>
            <button onClick={() => sendEmojiReaction('👍')} className="action-btn">👍</button>
            <button onClick={() => sendEmojiReaction('😂')} className="action-btn">😂</button>
            <button onClick={() => sendEmojiReaction('🎉')} className="action-btn">🎉</button>
          </div>
          
          <div className="main-controls">
            <button 
              className={`ctrl-btn ${!isMicrophoneEnabled ? 'muted' : 'active'}`} 
              onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            >
              {isMicrophoneEnabled ? '🎙️ Mikrofon Açık' : '🔇 Mikrofon Kapalı'}
            </button>

            {/* KULAKLIĞI / SESİ KAPAT (DEAFEN) */}
            <button 
              className={`ctrl-btn ${isDeafened ? 'muted' : ''}`} 
              onClick={() => setIsDeafened(!isDeafened)}
            >
              {isDeafened ? '🎧 Sesi Aç' : '🎧 Kulaklığı Kapat'}
            </button>

            <button 
              className={`ctrl-btn ${isKrispActive ? 'krisp-active' : 'krisp-inactive'}`} 
              onClick={toggleKrisp}
              disabled={!isMicrophoneEnabled}
            >
              {krispStatus}
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

      {/* Deafen aktifse tüm odanın sesini mute'la */}
      <RoomAudioRenderer volume={isDeafened ? 0 : 1} />
    </div>
  );
}