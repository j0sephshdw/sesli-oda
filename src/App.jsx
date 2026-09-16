import React, { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { VideoPresets, ScreenSharePresets } from 'livekit-client';
import AudioRoom from './AudioRoom';
import '@livekit/components-styles';

const LIVEKIT_URL = 'wss://bizim-dc-x3m53dz5.livekit.cloud';

export default function App() {
  const [roomName, setRoomName] = useState('');
  const [participantName, setParticipantName] = useState(localStorage.getItem('lastName') || '');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setRoomName(roomParam);
    } else {
      setRoomName(localStorage.getItem('lastRoom') || '');
    }
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    
    // GÜVENLİK: İsimleri ve oda adlarını backend ile aynı formata sokuyoruz
    const safeRoomName = roomName.trim().toLowerCase();
    const safeParticipantName = participantName.trim();

    if (!safeRoomName || !safeParticipantName) {
      setError('İsim ve Oda Adı zorunludur.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: safeRoomName, participantName: safeParticipantName, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Bağlantı reddedildi.');
      
      localStorage.setItem('lastRoom', safeRoomName);
      localStorage.setItem('lastName', safeParticipantName);
      
      setIsAdmin(data.isAdmin); 
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
          noiseSuppression: false, 
          autoGainControl: true, 
        }}
        options={{
          adaptiveStream: true, 
          dynacast: true, 
          publishDefaults: {
            videoEncoding: VideoPresets.h360.encoding,
            videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
            screenShareEncoding: ScreenSharePresets.h720fps30.encoding,
            audioBitrate: 32000, 
          }
        }}
        token={token}
        serverUrl={LIVEKIT_URL}
        onDisconnected={() => setToken('')}
        data-lk-theme="default"
      >
        <AudioRoom roomName={roomName.trim().toLowerCase()} isAdmin={isAdmin} onLeave={() => setToken('')} />
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
            <input 
              type="text" 
              value={participantName} 
              onChange={(e) => setParticipantName(e.target.value)} 
              maxLength={15} 
              placeholder="Örn: Hacıkopter"
              required 
            />
          </div>
          <div className="form-group">
            <label>Oda Adı</label>
            <input 
              type="text" 
              value={roomName} 
              onChange={(e) => setRoomName(e.target.value)} 
              maxLength={20} 
              placeholder="Örn: genel ses"
              required 
            />
          </div>
          <div className="form-group">
            <label>Oda Şifresi (Odayı Kuruyorsan Belirle)</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Gizli Şifre" 
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