import React, { useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

export default function App() {
  const [token, setToken] = useState('');
  const [room, setRoom] = useState('general');
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!username.trim()) return alert('Lütfen bir kullanıcı adı girin!');

    try {
      const res = await fetch(`https://sesli-oda.onrender.com/get-token?room=${encodeURIComponent(room)}&username=${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error('Token alınamadı');
      
      const data = await res.json();
      setToken(data.token);
      setJoined(true);
    } catch (err) {
      console.error(err);
      alert('Odaya bağlanırken bir hata oluştu.');
    }
  };

  if (!joined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '15px', fontFamily: 'sans-serif' }}>
        <h1>Sesli & Görüntülü Oda</h1>
        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
          <input
            type="text"
            placeholder="Kullanıcı Adı"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input
            type="text"
            placeholder="Oda Adı"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '10px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}>
            Odaya Katıl
          </button>
        </form>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL || 'wss://bizim-dc-x3m53dz5.livekit.cloud'}
      data-lk-theme="default"
      style={{ height: '100vh' }}
      onDisconnected={() => setJoined(false)}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}