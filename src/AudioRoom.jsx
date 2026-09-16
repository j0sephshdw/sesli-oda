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
  const [krispStatus, setKrispStatus] = useState('⏳ Filtre Yükleniyor...');
  const [inviteText, setInviteText] = useState('🔗 Davet Linki Kopyala');

  // Otomatik Sohbet Kaydırma
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // 1. AŞAMA: Krisp AI Modelini Arka Planda Hazırla
  useEffect(() => {
    if (isKrispNoiseFilterSupported()) {
      const processor = KrispNoiseFilter();
      setKrispProcessor(processor);
      setKrispStatus('🎧 Gürültü Engelleyici (HAZIR)');
    } else {
      setKrispStatus('🚫 Tarayıcı Desteklemiyor');
    }
  }, []);

  // 2. AŞAMA: Mikrofon Açıldığında Yarım Saniye Bekle ve Filtreyi ZORLA Oturt
  useEffect(() => {
    let timeoutId;
    const autoEnableKrisp = async () => {
      if (!isMicrophoneEnabled) {
         setIsKrispActive(false);
         setKrispStatus('🎧 Mikrofon Kapalı');
         return;
      }

      // Track'in (ses kanalının) tam oluşması için 500ms zeki bekleme
      timeoutId = setTimeout(async () => {
         const track = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
         if (track && krispProcessor && !isKrispActive) {
           try {
             setKrispStatus('🎧 Başlatılıyor...');
             await track.setProcessor(krispProcessor);
             setIsKrispActive(true);
             setKrispStatus('🎧 Gürültü Engelleyici (AÇIK)');
           } catch(e) {
             console.error("Krisp hatası:", e);
             setKrispStatus('🎧 Gürültü Engelleyici (HATA)');
           }
         }
      }, 500); 
    };

    autoEnableKrisp();
    return () => clearTimeout(timeoutId);
  }, [isMicrophoneEnabled, localParticipant, krispProcessor]);

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

    room.on(RoomEvent.ParticipantConnected, () => playTone('join'));
    room.on(RoomEvent.ParticipantDisconnected, () => playTone('leave'));
    return () => {
      room.removeAllListeners(RoomEvent.ParticipantConnected);
      room.removeAllListeners(RoomEvent.ParticipantDisconnected);
    }
  }, [room]);

  const handleSendMessage = () => {
    if (msg.trim()) { send(msg); setMsg(''); }
  };

  // Modern Link Kopyalama (Alert yerine buton üstünde yazar)
  const copyInvite = () => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url);
    setInviteText('✅ Kopyalandı!');
    setTimeout(() => setInviteText('🔗 Davet Linki Kopyala'), 2000);
  };

  const sendEmoji = (emoji) => {
    send(`Tepki gönderdi: ${emoji}`);
  };

  // Manuel Krisp Aç/Kapat Kontrolü
  const toggleKrisp = async () => {
    if (!krispProcessor) return;
    const track = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
    if (!track || !isMicrophoneEnabled) return;

    try {
      if (isKrispActive) {
        await track.stopProcessor();
        setIsKrispActive(false);
        setKrispStatus('🎧 Gürültü Engelleyici (KAPALI)');
      } else {
        await track.setProcessor(krispProcessor);
        setIsKrispActive(true);
        setKrispStatus('🎧 Gürültü Engelleyici (AÇIK)');
      }
    } catch (err) {
      console.error(err);
    }
  };

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
                
                {/* DİSCORD TARZI MİKROFON DURUMU GÖSTERGESİ */}
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
            <button onClick={() => sendEmoji('✋')} className="action-btn">✋</button>
            <button onClick={() => sendEmoji('🔥')} className="action-btn">🔥</button>
            <button onClick={() => sendEmoji('👍')} className="action-btn">👍</button>
            <button onClick={() => sendEmoji('😂')} className="action-btn">😂</button>
          </div>
          
          <div className="main-controls">
            <button 
              className={`ctrl-btn ${!isMicrophoneEnabled ? 'muted' : 'active'}`} 
              onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            >
              {isMicrophoneEnabled ? '🎙️ Mikrofon Açık' : '🔇 Mikrofon Kapalı'}
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
      <RoomAudioRenderer />
    </div>
  );
}