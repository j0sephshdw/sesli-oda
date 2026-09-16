import React, { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { KrispNoiseFilter, isKrispNoiseFilterSupported } from '@livekit/krisp-noise-filter';
import AudioRoom from './AudioRoom';
import '@livekit/components-styles';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;

export default function App() {
  const [roomName, setRoomName] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInvite, setIsInvite] = useState(false);

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
      
      setToken(data.token);
    } catch (err) {
      setError(err.message || 'Sunucuya ulaşılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setToken('');
    window.history.replaceState({}, document.title, window.location.pathname);
    setIsInvite(false);
    setRoomName('');
    setPassword('');
  };

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
            autoGainControl: false, // AGC kapalı (Oyun oynarken ses seviyesi aniden değişmez)
            echoCancellation: true,
            noiseSuppression: true,
          }
        }}
      >
        <AudioRoom roomName={roomName} onLeave={handleDisconnect} />
      </LiveKitRoom>
    );
  }

  return (
    <div className="join-container">
      <div className="join-card">
        <h2>{isInvite ? `🔊 ${roomName} Odasına Davetlisin` : '🔊 Sesli Odaya Katıl'}</h2>
        {error && <div className="error-msg">{error}</div>}
        
        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label>Adın</label>
            <input type="text" value={participantName} onChange={(e) => setParticipantName(e.target.value)} maxLength={15} required />
          </div>
          <div className="form-group">
            <label>Oda Adı</label>
            <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} readOnly={isInvite} style={{ opacity: isInvite ? 0.6 : 1 }} maxLength={20} required />
          </div>
          <div className="form-group">
            <label>Oda Şifresi {isInvite ? '(Varsa)' : '(Boş bırakırsan şifresiz olur)'}</label>
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