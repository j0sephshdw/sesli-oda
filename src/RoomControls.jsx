import React from 'react';

export default function RoomControls({
  isIdle = false,
  isMicrophoneEnabled = false,
  isCameraEnabled = false,
  isScreenShareEnabled = false,
  isDeafened = false,
  isNoiseCancellingActive = false,
  noiseStatus = 'Gürültü Engelleme',
  isHandRaised = false,
  onToggleMic,
  onToggleDeafen,
  onToggleNoiseCancellation,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
  onSendEmojiReaction,
  onToggleHandRaise,
  onShowSettings
}) {
  return (
    <footer className={`room-controls-wrapper ${isIdle ? 'idle' : ''}`} role="toolbar" aria-label="Oda Kontrolleri">
      <div className="interactive-actions">
        {/* YENİ ZENGİN EMOJİ REAKSİYONLARI */}
        <button onClick={() => onSendEmojiReaction?.('🔥')} className="action-btn" title="Alev">🔥</button>
        <button onClick={() => onSendEmojiReaction?.('❤️')} className="action-btn" title="Kalp">❤️</button>
        <button onClick={() => onSendEmojiReaction?.('🎉')} className="action-btn" title="Parti">🎉</button>
        <button onClick={() => onSendEmojiReaction?.('❓')} className="action-btn" title="Kafam Karıştı">❓</button>
        
        <div className="soundboard-separator" role="separator" />

        <button 
          onClick={onToggleHandRaise} 
          className={`action-btn ${isHandRaised ? 'active-hand' : ''}`} 
          title="El Kaldır / Söz İste"
          aria-pressed={isHandRaised}
        >
          ✋
        </button>
        <button onClick={onShowSettings} className="action-btn" title="Ayarlar" aria-label="Ayarları aç">⚙️</button>
      </div>
      
      <div className="main-controls">
        <button 
          className={`ctrl-btn ${!isMicrophoneEnabled ? 'muted' : 'active'}`} 
          onClick={onToggleMic}
          aria-label={isMicrophoneEnabled ? 'Mikrofonu Kapat' : 'Mikrofonu Aç'}
        >
          {isMicrophoneEnabled ? '🎙️ Açık' : '🔇 Kapalı'}
        </button>

        <button 
          className={`ctrl-btn ${isDeafened ? 'muted' : ''}`} 
          onClick={onToggleDeafen}
          aria-label={isDeafened ? 'Sağırlaştırmayı Kaldır' : 'Sesi Sağırlaştır'}
        >
          {isDeafened ? '🎧 Sesi Aç' : '🎧 Sağır Et'}
        </button>

        <button 
          className={`ctrl-btn ${isNoiseCancellingActive ? 'noise-active' : 'noise-inactive'}`} 
          onClick={onToggleNoiseCancellation} 
          disabled={!isMicrophoneEnabled}
          title={!isMicrophoneEnabled ? 'Mikrofon kapalıyken kullanılamaz' : ''}
        >
          {noiseStatus}
        </button>
        
        <button 
          className={`ctrl-btn ${isCameraEnabled ? 'active' : ''}`} 
          onClick={onToggleCamera}
          aria-label={isCameraEnabled ? 'Kamerayı Kapat' : 'Kamerayı Aç'}
        >
          {isCameraEnabled ? '📹 Kamerayı Kapat' : '📹 Kamera Aç'}
        </button>

        <button 
          className={`ctrl-btn ${isScreenShareEnabled ? 'active' : ''}`} 
          onClick={onToggleScreenShare}
          aria-label={isScreenShareEnabled ? 'Ekran Paylaşımını Durdur' : 'Ekran Paylaş'}
        >
          📺 {isScreenShareEnabled ? 'Yayını Kapat' : 'Ekran Paylaş'}
        </button>

        <button className="leave-btn" onClick={onLeave} aria-label="Odadan Ayrıl">🚪 Ayrıl</button>
      </div>
    </footer>
  );
}