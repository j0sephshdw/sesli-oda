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

export default function AudioRoom({ roomName, isAdmin, onLeave }) {
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
  const [isAfk, setIsAfk] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [typing, setTyping] = useState({});

  const [showSettings, setShowSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);

  const processorRef = useRef(null);
  const stageRef = useRef(null);
  const prevChatCount = useRef(0);

  // Kendi ismimizi etiketlerde tanımak için alıyoruz
  const myDisplayName = (localParticipant?.name || localParticipant?.identity || '').split('_')[0];

  // YENİ: Admin Yetkisini Katılımcı Bilgilerine İşleme
  useEffect(() => {
    if (localParticipant && isAdmin) {
      localParticipant.setAttributes({ ...localParticipant.attributes, admin: 'true' });
    }
  }, [localParticipant, isAdmin]);

  // Cihazları Getir
  useEffect(() => {
    if (showSettings) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      });
    }
  }, [showSettings]);

  const handleDeviceChange = async (kind, deviceId) => {
    if (room) await room.switchActiveDevice(kind, deviceId);
  };

  const playMicTone = (isMuting) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      
      if (isMuting) {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
      }
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    } catch(e) {}
  };

  const playTone = (type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
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
      } else if (type === 'mention') {
        // YENİ: Etiketlenme (Mention) Sesi (Yüksek frekanslı ardışık ping)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      } else if (type === 'screen_share') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      }
      
      if(type !== 'message' && type !== 'screen_share' && type !== 'mention'){
         gain.gain.setValueAtTime(0.02, ctx.currentTime);
         gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      }

      osc.start();
      osc.stop(ctx.currentTime + (type === 'screen_share' ? 0.2 : type === 'mention' ? 0.25 : 0.15));
    } catch(e) {}
  };

  const handleSendMessage = () => {
    if (msg.trim()) {
      send(msg);
      setMsg('');
    }
  };

  const handleTyping = (e) => {
    setMsg(e.target.value);
    if (room?.localParticipant) {
      const data = JSON.stringify({ type: 'TYPING', name: myDisplayName });
      room.localParticipant.publishData(new TextEncoder().encode(data), { reliable: false });
    }
  };

  // Yeni mesaj geldiğinde Mention kontrolü
  useEffect(() => {
    if (chatMessages.length > prevChatCount.current) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.from?.identity !== localParticipant?.identity) {
        // İsmin geçiyorsa (Büyük/küçük harf duyarsız)
        if (lastMsg.message.toLowerCase().includes(`@${myDisplayName.toLowerCase()}`)) {
            playTone('mention');
        } else {
            playTone('message');
        }
      }
      prevChatCount.current = chatMessages.length;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, localParticipant, myDisplayName]);

  useEffect(() => {
    if(screenTracks.length > 0) playTone('screen_share');
  }, [screenTracks.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTyping(prev => {
        const next = { ...prev };
        let changed = false;
        for (let user in next) {
          if (now - next[user] > 3000) { delete next[user]; changed = true; }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
        if (data.type === 'TYPING') setTyping(prev => ({ ...prev, [data.name]: Date.now() }));
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

  const toggleAfk = () => {
    const nextState = !isAfk;
    setIsAfk(nextState);
    localParticipant?.setAttributes({ afk: nextState ? 'true' : 'false' });
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

  // YENİ: Gelişmiş Mesaj Renderer (Linkler, Kalın Yazı ve Mentionlar)
  const renderMessageText = (text) => {
    // URL, **Kalın** ve @Kullanıcı gibi kelimeleri parçalıyoruz
    const parts = text.split(/(https?:\/\/[^\s]+|\*\*.*?\*\*|@[^\s]+)/g);

    return parts.map((part, i) => {
      // 1. Link Kontrolü
      if (part.match(/https?:\/\/[^\s]+/)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link">{part}</a>;
      } 
      // 2. Kalın (Bold) Yazı Kontrolü
      else if (part.match(/\*\*(.*?)\*\*/)) {
        return <strong key={i}>{part.replace(/\*\*/g, '')}</strong>;
      } 
      // 3. Bizim Etiketlenmemiz Kontrolü (@isim)
      else if (part.toLowerCase() === `@${myDisplayName.toLowerCase()}`) {
        return <span key={i} className="mention-badge">{part}</span>;
      } 
      // 4. Başkalarının Etiketlenmesi Kontrolü
      else if (part.startsWith('@')) {
        return <span key={i} className="mention-other">{part}</span>;
      }
      return part;
    });
  };

  const activeTypers = Object.keys(typing).filter(name => name !== myDisplayName);

  return (
    <div className="custom-room-layout">
      {/* Ayarlar Modalı */}
      {showSettings && (
        <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-header">
              <h3>⚙️ Cihaz Ayarları</h3>
              <button onClick={() => setShowSettings(false)} className="close-btn">✖</button>
            </div>
            <div className="settings-content">
              <div className="form-group">
                <label>Mikrofon Seçimi</label>
                <select onChange={(e) => handleDeviceChange('audioinput', e.target.value)}>
                  <option value="">Sistem Varsayılanı</option>
                  {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${d.deviceId.slice(0,5)}`}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Kamera Seçimi</label>
                <select onChange={(e) => handleDeviceChange('videoinput', e.target.value)}>
                  <option value="">Sistem Varsayılanı</option>
                  {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${d.deviceId.slice(0,5)}`}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

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
              const isUserAfk = p.attributes?.afk === 'true';
              const isUserAdmin = p.attributes?.admin === 'true'; // YENİ: Admin Yetkisi
              
              const displayName = (p.name || p.identity || 'Misafir').split('_')[0];
              const isUserSharingScreen = p.isScreenShareEnabled;
              const isCamOn = p.isCameraEnabled; 
              const isMirror = isCamOn && p.identity === localParticipant?.identity;

              return (
                <div key={p.identity} className={`voice-user-card ${p.isSpeaking ? 'speaking' : ''} ${isUserAfk ? 'afk-mode' : ''}`} onDoubleClick={isCamOn ? toggleCardFullScreen : undefined}>
                  <div className="quality-indicator"><ConnectionQualityIndicator participant={p} /></div>
                  
                  {isUserHandRaised && <div className="hand-raised-badge">✋</div>}
                  {isUserSharingScreen && <div className="broadcaster-badge">🔴 Yayında</div>}
                  {isUserAfk && <div className="afk-badge">☕ AFK</div>}

                  {isCamOn ? (
                    <VideoTrack trackRef={{ participant: p, source: Track.Source.Camera }} className={`user-video ${isMirror ? 'mirror' : ''}`} />
                  ) : (
                    <div className="avatar" style={{ backgroundColor: getAvatarColor(displayName) }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="card-footer">
                    {/* YENİ: Oda kurucusu ise adının solunda Altın Taç çıkar */}
                    {isUserAdmin && <span className="admin-crown" title="Oda Kurucusu">👑</span>}
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
                  
                  {(p.identity !== localParticipant?.identity || isCamOn) && (
                    <div className="card-hover-overlay">
                      {isCamOn && (
                        <div className="cam-actions">
                          <button onClick={toggleCardPiP} title="Pencere İçinde Aç">🗗 PiP</button>
                          <button onClick={toggleCardFullScreen} title="Tam Ekran Yap">⛶ Tam Ekran</button>
                        </div>
                      )}
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
            <button onClick={toggleHandRaise} className={`action-btn ${isHandRaised ? 'active-hand' : ''}`} title="El Kaldır">✋</button>
            <button onClick={toggleAfk} className={`action-btn ${isAfk ? 'active-hand' : ''}`} title="AFK Modu">☕</button>
            <button onClick={() => setShowSettings(true)} className="action-btn" title="Ayarlar">⚙️</button>
          </div>
          
          <div className="main-controls">
            <button 
              className={`ctrl-btn ${!isMicrophoneEnabled ? 'muted' : 'active'}`} 
              onClick={() => {
                const nextState = !isMicrophoneEnabled;
                playMicTone(!nextState); 
                localParticipant?.setMicrophoneEnabled(nextState);
              }}
            >
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

            <button className={`ctrl-btn ${isScreenShareEnabled ? 'active' : ''}`} onClick={() => localParticipant?.setScreenShareEnabled(!isScreenShareEnabled, { audio: true })}>
              📺 {isScreenShareEnabled ? 'Yayını Kapat' : 'Ekran Paylaş'}
            </button>
            <button className="leave-btn" onClick={handleLeaveRoom}>🚪 Ayrıl</button>
          </div>
        </footer>
      </div>

      {isChatVisible && (
        <div className="custom-chat-panel">
          <div className="chat-header">💬 Sohbet</div>
          <div className="chat-messages">
            <div className="chat-sys-msg">Mesajlar uçtan uca şifrelidir.</div>
            {chatMessages.map(m => {
              // Mesajda etiketlenip etiketlenmediğimizi kontrol edip mesaj arka planını sarı yapıyoruz
              const isMentioned = m.message.toLowerCase().includes(`@${myDisplayName.toLowerCase()}`);
              return (
                <div key={m.id} className={`chat-msg ${isMentioned ? 'mentioned-msg' : ''}`}>
                  <div className="chat-msg-header">
                    <span className="chat-sender">{(m.from?.name || m.from?.identity || 'Anonim').split('_')[0]}</span>
                    <span className="chat-time">{formatTime(m.timestamp)}</span>
                  </div>
                  <div className="chat-text">{renderMessageText(m.message)}</div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          
          {activeTypers.length > 0 && (
            <div className="typing-indicator">
              <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
              {activeTypers.join(', ')} yazıyor
            </div>
          )}

          <div className="chat-input-area">
            <input 
              value={msg} 
              onChange={handleTyping} 
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
              placeholder="Mesaj... (@isim veya **kalın**)" 
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