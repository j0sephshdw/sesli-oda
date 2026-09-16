import React, { useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import AudioRoom from './components/AudioRoom';

const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-livekit-instance.livekit.cloud';

export default function App() {
  const [roomName, setRoomName] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || !participantName.trim()) {
      setError('Lütfen oda adını ve kullanıcı adınızı girin.');
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

      if (!response.ok) {
        throw new Error(data.error || 'Token alınamadı.');
      }

      setToken(data.token);
    } catch (err) {
      setError(err.message || 'Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setToken('');
  };

  if (token) {
    return (
      <LiveKitRoom
        video={false}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        onDisconnected={handleDisconnect}
        data-lk-theme="default"
        style={{ height: '100vh' }}
      >
        <AudioRoom roomName={roomName} onLeave={handleDisconnect} />
      </LiveKitRoom>
    );
  }

  return (
    <div className="join-container">
      <div className="join-card">
        <h2>Sesli Odaya Katıl</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label>Kullanıcı Adı</label>
            <input
              type="text"
              placeholder="Adınızı girin"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Oda Adı</label>
            <input
              type="text"
              placeholder="Oda adını girin"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
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