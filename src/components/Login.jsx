import React, { useState } from 'react';

export default function Login({ onJoin }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState(window.initialRoom || '');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!username || !room) return alert('Lütfen tüm alanları doldurun!');
    
    setLoading(true);
    try {
      const res = await fetch(`/get-token?username=${encodeURIComponent(username)}&room=${encodeURIComponent(room)}`);
      const data = await res.json();
      if (data.token) {
        onJoin({ token: data.token, url: data.url, roomName: room, username });
      } else {
        alert('Giriş başarısız oldu.');
      }
    } catch (err) {
      alert('Sunucu hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleJoin}>
        <h2>🔊 Sesli Oda</h2>
        <input 
          type="text" 
          placeholder="Kullanıcı Adı" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
        />
        <input 
          type="text" 
          placeholder="Oda Adı" 
          value={room} 
          onChange={(e) => setRoom(e.target.value)} 
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Bağlanıyor...' : 'Odaya Katıl'}
        </button>
      </form>
    </div>
  );
}