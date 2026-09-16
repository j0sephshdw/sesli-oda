import React, { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import AudioRoom from './AudioRoom';
import '@livekit/components-styles';

// DİKKAT: Render'daki Environment Variables kısmında VITE_LIVEKIT_URL tanımlı olmalı.
// Veya 'wss://...' yazan yere kendi LiveKit linkini doğrudan yapıştırabilirsin.
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://bizim-dc-x3m53dz5.livekit.cloud';

export default function App() {
  const [roomName, setRoomName] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInvite, setIsInvite] = useState(false);

  // Sayfa açıldığında linkte "room=oda_adi" var mı diye bakar
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
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Bilet alınamadı.');
      
      setToken(data.token);
    } catch (err) {
      setError(err.message || 'Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setToken('');
    window.history.replaceState({}, document.title, window.location.pathname);
    setIsInvite(false);
    setRoomName('');
  };

  // URL hatasını ekrana bas (Senin aldığın hatanın çözümü)
  if (token && (!LIVEKIT_URL || LIVEKIT_URL.includes('kendi-livekit-url'))) {
    return (
      <div style={{color:'white', padding:'20px', textAlign:'center', marginTop:'50px'}}>
        <h2>🛑 Kritik Hata: LiveKit URL Bulunamadı</h2>
        <p>Lütfen Render panelinden <b>VITE_LIVEKIT_URL</b> ayarını ekleyin veya App.jsx içindeki URL'yi kendi <i>wss://</i> linkinizle değiştirin.</p>
      </div>
    );
  }

  // Odayı Yükle
  if (token) {
    return (
      <LiveKitRoom
        video={false}
        audio={true}
        token={token}
        serverUrl={LIVEKIT_URL}
        onDisconnected={handleDisconnect}
        data-lk-theme="default"
        options={{
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true // Klavye ve dip sesleri engeller
          }
        }}
      >
        <AudioRoom roomName={roomName} onLeave={handleDisconnect} />
      </LiveKitRoom>
    );
  }

  // Giriş Ekranını Yükle
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
              maxLength={15}
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
              maxLength={20}
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