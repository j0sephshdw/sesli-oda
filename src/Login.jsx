import React, { useState } from 'react';

export default function Login({ onJoin }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState(window.initialRoom || '');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !room.trim()) return alert('⚠️ Lütfen tüm alanları doldurun!');
    
    setLoading(true);
    try {
      const res = await fetch(`/get-token?username=${encodeURIComponent(username)}&room=${encodeURIComponent(room)}`);
      const data = await res.json();
      if (data.token) {
        onJoin({ token: data.token, url: data.url, roomName: room, username });
      } else {
        alert('❌ Giriş başarısız oldu. Lütfen tekrar deneyin.');
      }
    } catch (err) {
      alert('🌐 Sunucu hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="premium-auth-wrapper">
      <div className="premium-auth-card">
        <div className="auth-header">
          <h2>🔊 Hızlı Katılım</h2>
          <p>Misafir olarak hemen sohbete dahil olun.</p>
        </div>
        <form onSubmit={handleJoin}>
          <div className="premium-form-group">
            <label>Kullanıcı Adı <span className="req">*</span></label>
            <input 
              type="text" 
              placeholder="Örn: Hacıkopter" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required
            />
          </div>
          <div className="premium-form-group">
            <label>Oda Adı <span className="req">*</span></label>
            <input 
              type="text" 
              placeholder="Örn: Genel Sohbet" 
              value={room} 
              onChange={(e) => setRoom(e.target.value)} 
              required
            />
          </div>
          <button type="submit" disabled={loading} className="premium-submit-btn">
            {loading ? 'Bağlanıyor...' : 'Odaya Katıl'}
          </button>
        </form>
      </div>
    </div>
  );
}