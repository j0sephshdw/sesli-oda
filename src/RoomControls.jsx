import React from 'react';

export default function RoomControls({
  isIdle,
  isMicrophoneEnabled,
  isCameraEnabled,
  isScreenShareEnabled,
  isDeafened,
  isNoiseCancellingActive,
  noiseStatus,
  isHandRaised,
  isAfk,
  onToggleMic,
  onToggleDeafen,
  onToggleNoiseCancellation,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
  onSendEmojiReaction,
  onBroadcastSoundboard,
  onToggleHandRaise,
  onToggleAfk,
  onShowSettings
}) {
  return (
    <footer className={`room-controls-wrapper ${isIdle ? 'idle' : ''}`}>
      <div className="interactive-actions">
        <button onClick={() => onSendEmojiReaction('🔥')} className="action-btn">🔥</button>
        <button onClick={() => onSendEmojiReaction('👍')} className="action-btn">👍</button>
        <button onClick={() => onSendEmojiReaction('😂')} className="action-btn">😂</button>
        <div className="soundboard-separator"></div>
        <button onClick={() => onBroadcastSoundboard('ding')} className="action-btn soundboard-btn" title="Zil Çal">🔔</button>
        <button onClick={() => onBroadcastSoundboard('buzzer')} className="action-btn soundboard-btn" title="Yanlış Cevap">❌</button>
        <div className="soundboard-separator"></div>

        <button onClick={onToggleHandRaise} className={`action-btn ${isHandRaised ? 'active-hand' : ''}`} title="El Kaldır">✋</button>
        <button onClick={onToggleAfk} className={`action-btn ${isAfk ? 'active-hand' : ''}`} title="AFK Modu">☕</button>
        <button onClick={onShowSettings} className="action-btn" title="Ayarlar">⚙️</button>
      </div>
      
      <div className="main-controls">
        <button className={`ctrl-btn ${!isMicrophoneEnabled ? 'muted' : 'active'}`} onClick={onToggleMic}>
          {isMicrophoneEnabled ? '🎙️ Açık' : '🔇 Kapalı'}
        </button>
        <button className={`ctrl-btn ${isDeafened ? 'muted' : ''}`} onClick={onToggleDeafen}>
          {isDeafened ? '🎧 Sesi Aç' : '🎧 Sağır Et'}
        </button>
        <button className={`ctrl-btn ${isNoiseCancellingActive ? 'noise-active' : 'noise-inactive'}`} onClick={onToggleNoiseCancellation} disabled={!isMicrophoneEnabled}>
          {noiseStatus}
        </button>
        
        <button className={`ctrl-btn ${isCameraEnabled ? 'active' : ''}`} onClick={onToggleCamera}>
          {isCameraEnabled ? '📹 Kamerayı Kapat' : '📹 Kamera Aç'}
        </button>

        <button className={`ctrl-btn ${isScreenShareEnabled ? 'active' : ''}`} onClick={onToggleScreenShare}>
          📺 {isScreenShareEnabled ? 'Yayını Kapat' : 'Ekran Paylaş'}
        </button>
        <button className="leave-btn" onClick={onLeave}>🚪 Ayrıl</button>
      </div>
    </footer>
  );
}