import React, { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import AudioRoom from './AudioRoom';
import '@livekit/components-styles'; // LiveKit'in hazır şık tasarımı

export default function App() {
  const [roomName, setRoomName] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInvite, setIsInvite] = useState(false);

  // URL'den davet linkini kontrol et
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomName(roomParam);
      setIsInvite(true);
    }
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || !participantName.trim()) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Backend'deki güncel bilet alma adresimiz
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Token alınamadı.');
      
      setToken(data.token);
    } catch (err) {
      setError(err.message || 'Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setToken('');
    window.history.replaceState({}, document.title, window.location.pathname); // URL'yi temizle
    setIsInvite(false);
    setRoomName('');
  };

  // Bilet varsa Odayı Yükle
  if (token) {
    return (
      <LiveKitRoom
        video={false}
        audio={true}
        token={token}
        serverUrl={import.meta.env.VITE_LIVEKIT_URL || 'wss://your-livekit-url-here'} // .env'den gelir
        onDisconnected={handleDisconnect}
        data-lk-theme="default" // Discord benzeri hazır tema
        options={{
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true // Klavye sesi engelleme
          }
        }}
      >
        <AudioRoom roomName={roomName} onLeave={handleDisconnect} />
      </LiveKitRoom>
    );
  }

  // Bilet yoksa Giriş Ekranını Yükle
  return (
    <div className="join-container">
      <div className="join-card">
        <h2>{isInvite ? `🔊 ${roomName} Odasına Davetlisin` : '🔊 Sesli Odaya Katıl'}</h2>
        {error && <div className="error-msg">{error}</div>}
        
        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label>Adın (örn: Emir)</label>
            <input
              type="text"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Oda Adı</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              readOnly={isInvite}
              style={{ opacity: isInvite ? 0.6 : 1 }}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="join-btn">
            {loading ? 'Bağlanılıyor...' : 'Odaya Katıl'}
          </button>
        </form>
      </div>
    </div>
  );
}