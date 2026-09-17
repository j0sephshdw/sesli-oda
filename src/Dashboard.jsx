import React, { useState } from 'react';

export default function Dashboard({ username, myRooms, onLogout, onJoinRoom }) {
  const [targetRoom, setTargetRoom] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleJoin = async (e, directRoomName = null) => {
    if (e) e.preventDefault();
    const roomToJoin = directRoomName || targetRoom;
    
    if (!roomToJoin.trim()) return triggerError('Oda Adı zorunlu.');
    
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomName: roomToJoin, 
          participantName: username, 
          password: roomPassword,
          isGuest: false 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      onJoinRoom(roomToJoin, data.token, data.isAdmin);
    } catch (err) { 
      triggerError(err.message); 
      setLoading(false); 
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('⚠️ Hesabınızı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         throw new Error("Sunucuya ulaşılamadı. Sunucunun yeniden başladığından emin olun.");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert('Hesabınız başarıyla silindi.');
      onLogout();
    } catch (err) {
      triggerError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-sidebar">
        <div className="user-profile">
          <div className="avatar giant-avatar" style={{width:'60px', height:'60px', fontSize:'24px'}}>
             {username.charAt(0).toUpperCase()}
          </div>
          <h3>{username}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px', width: '100%' }}>
            <button onClick={onLogout} className="logout-btn">Çıkış Yap</button>
            <button onClick={handleDeleteAccount} disabled={loading} className="logout-btn" style={{ backgroundColor: '#dc3545', color: 'white', border: '1px solid #c82333' }}>
              {loading ? 'Siliniyor...' : 'Hesabımı Sil'}
            </button>
          </div>
        </div>
        
        <div className="my-rooms-section">
          <h4>Geçmiş Odalarım</h4>
          {myRooms.length === 0 ? <p className="no-rooms">Henüz bir odaya girmediniz.</p> : (
            <ul className="room-list">
              {myRooms.map(r => (
                <li key={r} onClick={() => handleJoin(null, r)}># {r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="dashboard-main">
        <div className="join-card premium-auth-card">
          <div className="auth-header">
            <h2>Yeni Oda Kur veya Katıl</h2>
            <p>Maceraya atılmaya hazır mısın?</p>
          </div>
          {error && <div className={`auth-error ${shake ? 'shake' : ''}`}>{error}</div>}
          <form onSubmit={handleJoin}>
            <div className="premium-form-group">
              <label>ODA ADI <span className="req">*</span></label>
              <input type="text" value={targetRoom} onChange={(e) => setTargetRoom(e.target.value)} required placeholder="Örn: Genel Sohbet" />
            </div>
            <div className="premium-form-group">
              <label>ODA ŞİFRESİ</label>
              <div className="password-wrapper">
                <input type={showPassword ? "text" : "password"} value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Gizli Şifre (İsteğe bağlı)" />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="premium-submit-btn">
              {loading ? 'Bağlanılıyor...' : 'Odaya Gir'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}