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
  ConnectionQualityIndicator,
  VideoTrack
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import { KrispNoiseFilter, isKrispNoiseFilterSupported } from '@livekit/krisp-noise-filter';

const getAvatarColor = (name) => {
  const colors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#00a8fc'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function AudioRoom({ roomName, onLeave }) {
  const room = useRoomContext();
  const participants = useParticipants(); 
  const { localParticipant, isMicrophoneEnabled, isScreenShareEnabled, isCameraEnabled } = useLocalParticipant();
  const screenTracks = useTracks([Track.Source.ScreenShare]);

  const { send, chatMessages } = useChat();
  const [msg, setMsg] = useState('');
  const chatEndRef = useRef(null);

  const [isNoiseCancellingActive, setIsNoiseCancellingActive] = useState(false);
  const [noiseStatus, setNoiseStatus] = useState('🛡️ Gürültü Engelleme (KAPALI)');
  const [inviteText, setInviteText] = useState('🔗 Davet Linki');
  
  const [isDeafened, setIsDeafened] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  
  // YENİ: Tiyatro Modu (Sohbeti Gizle/Aç)
  const [isChatVisible, setIsChatVisible] = useState(true);

  const processorRef = useRef(null);
  const stageRef = useRef(null);
  const prevChatCount = useRef(0);

  const playTone = (type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      
      if (type === 'join') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
      } else if (type === 'leave') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
      } else if (type === 'message') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      } else if (type === 'screen_share') {
        // Ekran paylaşımı için özel dijital bildirim
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      }
      
      if(type !== 'message' && type !== 'screen_share'){
         gain.gain.setValueAtTime(0.02, ctx.currentTime);
         gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      }

      osc.start();
      osc.stop(ctx.currentTime + (type === 'screen_share' ? 0.2 : 0.15));
    } catch(e) {}
  };

  const handleSendMessage = () => {
    if (msg.trim()) {
      send(msg);
      setMsg('');
    }
  };

  useEffect(() => {
    if (chatMessages.length > prevChatCount.current) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.from?.identity !== localParticipant?.identity) playTone('message');
      prevChatCount.current = chatMessages.length;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, localParticipant]);

  // Yeni Ekran Paylaşımı Bildirimi
  useEffect(() => {
    if(screenTracks.length > 0) playTone('screen_share');
  }, [screenTracks.length]);

  useEffect(() => {
    const setupNoiseCancellation = async () => {
      if (!isMicrophoneEnabled) {
        setIsNoiseCancellingActive(false);
        setNoiseStatus('🛡️ Mik Kapalı');
        return;
      }
      if (!isKrispNoiseFilterSupported()) return setNoiseStatus('🚫 Desteklenmiyor');

      const track = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
      if (!track) return;

      try {
        setNoiseStatus('🛡️ Başlatılıyor...');
        const currentProcessor = KrispNoiseFilter({ assetsLocation: '/krisp' });
        processorRef.current = currentProcessor;
        await track.setProcessor(currentProcessor);
        setIsNoiseCancellingActive(true);
        setNoiseStatus('🛡️ Gürültü Engelleme (AÇIK)');
      } catch (err) {
        setNoiseStatus('🛡️ Hata');
        setIsNoiseCancellingActive(false);
      }
    };
    setupNoiseCancellation();
    return () => {
      const track = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
      if (track && processorRef.current) {
        track.stopProcessor().catch(() => {});
        processorRef.current = null;
      }
    };
  }, [isMicrophoneEnabled, localParticipant]);

  useEffect(() => {
    const handleDataReceived = (payload) => {
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);
        if (data.type === 'EMOJI_REACTION') spawnFloatingEmoji(data.emoji);
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

  const spawnFloatingEmoji = (emoji) => {
    const id = Date.now() + Math.random();
    const leftPos = Math.floor(Math.random() * 60) + 20;
    setFloatingEmojis((prev) => [...prev, { id, emoji, left: leftPos }]);
    setTimeout(() => setFloatingEmojis((prev) => prev.filter((item) => item.id !== id)), 2000);
  };

  const sendEmojiReaction = (emoji) => {
    spawnFloatingEmoji(emoji);
    if (room?.localParticipant) {
      const data = JSON.stringify({ type: 'EMOJI_REACTION', emoji });
      room.localParticipant.publishData(new TextEncoder().encode(data), { reliable: true });
    }
  };

  const toggleDeafen = () => {
    const nextState = !isDeafened;
    setIsDeafened(nextState);
    localParticipant?.setAttributes({ deafened: nextState ? 'true' : 'false' });
  };

  const toggleHandRaise = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    localParticipant?.setAttributes({ handRaised: nextState ? 'true' : 'false' });
    if (nextState) sendEmojiReaction('✋');
  };

  const copyInvite = () => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url);
    setInviteText('✅ Kopyalandı!');
    setTimeout(() => setInviteText('🔗 Davet Linki'), 2000);
  };

  const toggleNoiseCancellation = async () => {
    const track = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
    if (!track || !isMicrophoneEnabled) return;
    try {
      if (isNoiseCancellingActive && processorRef.current) {
        await track.stopProcessor();
        processorRef.current = null;
        setIsNoiseCancellingActive(false);
        setNoiseStatus('🛡️ Gürültü Engelleme (KAPALI)');
      } else {
        const newProcessor = KrispNoiseFilter({ assetsLocation: '/krisp' });
        processorRef.current = newProcessor;
        await track.setProcessor(newProcessor);
        setIsNoiseCancellingActive(true);
        setNoiseStatus('🛡️ Gürültü Engelleme (AÇIK)');
      }
    } catch (err) {}
  };

  const handleLeaveRoom = () => {
    room?.disconnect();
    onLeave();
  };

  const toggleCardFullScreen = (e) => {
    const card = e.currentTarget.closest('.voice-user-card, .screen-share-stage');
    if (!document.fullscreenElement) {
      card.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const toggleCardPiP = async (e) => {
    const card = e.currentTarget.closest('.voice-user-card, .screen-share-stage');
    const videoEl = card.querySelector('video');
    if (videoEl && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoEl.requestPictureInPicture();
        }
      } catch (err) {
        console.error("PiP Hatası:", err);
      }
    } else {
      alert("Tarayıcınız Pencere İçi (PiP) modunu desteklemiyor.");
    }
  };

  const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="custom-room-layout">
      <div className="floating-emoji-container">
        {floatingEmojis.map((item) => (
          <span key={item.id} className="floating-emoji" style={{ left: `${item.left}%` }}>{item.emoji}</span>
        ))}
      </div>

      <div className="main-panel">
        <header className="room-header">
          <div className="header-info">
            <h3>🔊 {roomName}</h3>
            <span className="live-badge">🔴 Canlı</span>
            <span className="people-count">👥 {participants.length} Kişi</span>
          </div>
          <div className="header-actions">
            <button onClick={() => setIsChatVisible(!isChatVisible)} className="action-btn" title="Sohbeti Gizle/Aç">
              {isChatVisible ? '💬 Sohbeti Gizle' : '💬 Sohbeti Aç'}
            </button>
            <button onClick={copyInvite} className="invite-btn" style={{marginLeft: '10px'}}>{inviteText}</button>
          </div>
        </header>

        <div className={`dynamic-view-area ${screenTracks.length > 0 ? 'has-screen' : ''}`}>
          
          {screenTracks.length > 0 && (
            <div className="screen-share-stage" ref={stageRef} onDoubleClick={toggleCardFullScreen}>
              <div className="screen-overlay-actions">
                <button onClick={toggleCardPiP} title="Pencere İçinde Aç">🗗 PiP</button>
                <button onClick={toggleCardFullScreen} title="Tam Ekran Yap">⛶ Tam Ekran</button>
              </div>
              <TrackLoop tracks={screenTracks}><ParticipantTile /></TrackLoop>
            </div>
          )}
          
          <div className="voice-users-grid">
            {participants.map((p) => {
              const isUserDeafened = p.attributes?.deafened === 'true';
              const isUserHandRaised = p.attributes?.handRaised === 'true';
              const displayName = (p.name || p.identity || 'Misafir').split('_')[0];
              const isUserSharingScreen = p.isScreenShareEnabled;
              // Kamera Açık mı Kontrolü (Hata düzeltildi)
              const isCamOn = p.isCameraEnabled; 
              // Ayna efekti sadece bize özel olsun
              const isMirror = isCamOn && p.identity === localParticipant?.identity;

              return (
                <div key={p.identity} className={`voice-user-card ${p.isSpeaking ? 'speaking' : ''}`} onDoubleClick={isCamOn ? toggleCardFullScreen : undefined}>
                  <div className="quality-indicator"><ConnectionQualityIndicator participant={p} /></div>
                  
                  {isUserHandRaised && <div className="hand-raised-badge">✋</div>}
                  {isUserSharingScreen && <div className="broadcaster-badge">🔴 Yayında</div>}

                  {/* DİNAMİK AVATAR VEYA KAMERA */}
                  {isCamOn ? (
                    <VideoTrack trackRef={{ participant: p, source: Track.Source.Camera }} className={`user-video ${isMirror ? 'mirror' : ''}`} />
                  ) : (
                    <div className="avatar" style={{ backgroundColor: getAvatarColor(displayName) }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="card-footer">
                    <span className="name">{displayName}</span>
                    <span className="status-icons">
                      {isUserDeafened ? '🎧' : !p.isMicrophoneEnabled ? '🔇' : ''}
                    </span>
                  </div>
                  
                  {p.isSpeaking && (
                     <div className="waveform">
                       <span className="bar"></span><span className="bar"></span><span className="bar"></span>
                     </div>
                  )}
                  
                  {/* YENİ: KUSURSUZ HOVER MENÜSÜ */}
                  {(p.identity !== localParticipant?.identity || isCamOn) && (
                    <div className="card-hover-overlay">
                      {isCamOn && (
                        <div className="cam-actions">
                          <button onClick={toggleCardPiP} title="Pencere İçinde Aç">🗗 PiP</button>
                          <button onClick={toggleCardFullScreen} title="Tam Ekran Yap">⛶ Tam Ekran</button>
                        </div>
                      )}

                      {/* Başkasının sesini kısmak için Hover */}
                      {p.identity !== localParticipant?.identity && (
                        <div className="vol-slider-wrapper">
                          <span>Kullanıcı Sesi</span>
                          <input 
                            type="range" min="0" max="1" step="0.01" defaultValue="1" 
                            className="vol-slider" title="Sesi ayarla"
                            onChange={(e) => {
                              const audioTrack = p.getTrackPublication(Track.Source.Microphone)?.track;
                              if (audioTrack && audioTrack.setVolume) audioTrack.setVolume(parseFloat(e.target.value));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <footer className="room-controls-wrapper">
          <div className="interactive-actions">
            <button onClick={() => sendEmojiReaction('🔥')} className="action-btn">🔥</button>
            <button onClick={() => sendEmojiReaction('👍')} className="action-btn">👍</button>
            <button onClick={() => sendEmojiReaction('😂')} className="action-btn">😂</button>
            <button onClick={() => sendEmojiReaction('🎉')} className="action-btn">🎉</button>
            <button onClick={toggleHandRaise} className={`action-btn ${isHandRaised ? 'active-hand' : ''}`}>✋</button>
          </div>
          
          <div className="main-controls">
            <button className={`ctrl-btn ${!isMicrophoneEnabled ? 'muted' : 'active'}`} onClick={() => localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled)}>
              {isMicrophoneEnabled ? '🎙️ Açık' : '🔇 Kapalı'}
            </button>
            <button className={`ctrl-btn ${isDeafened ? 'muted' : ''}`} onClick={toggleDeafen}>
              {isDeafened ? '🎧 Sesi Aç' : '🎧 Sağır Et'}
            </button>
            <button className={`ctrl-btn ${isNoiseCancellingActive ? 'noise-active' : 'noise-inactive'}`} onClick={toggleNoiseCancellation} disabled={!isMicrophoneEnabled}>
              {noiseStatus}
            </button>
            
            <button className={`ctrl-btn ${isCameraEnabled ? 'active' : ''}`} onClick={() => localParticipant?.setCameraEnabled(!isCameraEnabled)}>
              {isCameraEnabled ? '📹 Kamerayı Kapat' : '📹 Kamera Aç'}
            </button>

            <button className={`ctrl-btn ${isScreenShareEnabled ? 'active' : ''}`} onClick={() => localParticipant?.setScreenShareEnabled(!isScreenShareEnabled)}>
              📺 {isScreenShareEnabled ? 'Yayını Kapat' : 'Ekran Paylaş'}
            </button>
            <button className="leave-btn" onClick={handleLeaveRoom}>🚪 Ayrıl</button>
          </div>
        </footer>
      </div>

      {/* TİYATRO MODU (Sohbet Gizlenmişse Bu Kısım Ekranda Gözükmez) */}
      {isChatVisible && (
        <div className="custom-chat-panel">
          <div className="chat-header">💬 Sohbet</div>
          <div className="chat-messages">
            <div className="chat-sys-msg">Mesajlar uçtan uca şifrelidir.</div>
            {chatMessages.map(m => (
              <div key={m.id} className="chat-msg">
                <div className="chat-msg-header">
                  <span className="chat-sender">{(m.from?.name || m.from?.identity || 'Anonim').split('_')[0]}</span>
                  <span className="chat-time">{formatTime(m.timestamp)}</span>
                </div>
                <div className="chat-text">{m.message}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-area">
            <input 
              value={msg} 
              onChange={e => setMsg(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
              placeholder="Mesaj..." 
            />
            <button onClick={handleSendMessage}>Gönder</button>
          </div>
        </div>
      )}

      <div className="watermark-badge-left">
        ⚡ Made by <span>Hacıkopter</span>
      </div>

      <RoomAudioRenderer volume={isDeafened ? 0 : 1} />
    </div>
  );
}