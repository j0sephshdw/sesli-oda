import React, { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import AudioRoom from './AudioRoom';
import '@livekit/components-styles';

const LIVEKIT_URL = 'wss://bizim-dc-x3m53dz5.livekit.cloud';

export default function App() {
  // LocalStorage'dan son bilgileri al
  const [roomName, setRoomName] = useState(localStorage.getItem('lastRoom') || '');
  const [participantName, setParticipantName] = useState(localStorage.getItem('lastName') || '');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || !participantName.trim()) {
      setError('İsim ve Oda Adı zorunludur.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Bağlantı reddedildi.');
      
      // Başarılı girişte bilgileri kaydet
      localStorage.setItem('lastRoom', roomName);
      localStorage.setItem('lastName', participantName);
      
      setToken(data.token);
    } catch (err) {
      setError(err.message || 'Sunucuya ulaşılamadı.');
    } finally {
      setLoading(false);
    }
  };

  if (token) {
    return (
      <LiveKitRoom
        video={false}
        audio={{
          echoCancellation: true,
          noiseSuppression: false, // Krisp AI için tarayıcı filtresini kapatın
          autoGainControl: false // Orijinal sesin bozulmasını engeller
        }}
        token={token}
        serverUrl={LIVEKIT_URL}
        onDisconnected={() => setToken('')}
        data-lk-theme="default"
      >
        <AudioRoom roomName={roomName} onLeave={() => setToken('')} />
      </LiveKitRoom>
    );
  }

  return (
    <div className="join-container">
      <div className="join-card">
        <h2>🔊 Sesli Odaya Katıl</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label>Adın</label>
            <input type="text" value={participantName} onChange={(e) => setParticipantName(e.target.value)} maxLength={15} required />
          </div>
          <div className="form-group">
            <label>Oda Adı</label>
            <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={20} required />
          </div>
          <div className="form-group">
            <label>Oda Şifresi (Varsa)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Gizli Şifre" />
          </div>
          <button type="submit" disabled={loading} className="join-btn">
            {loading ? 'Bağlanılıyor...' : 'Odaya Katıl'}
          </button>
        </form>
      </div>
    </div>
  );
}