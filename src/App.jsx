import React, { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { VideoPresets, ScreenSharePresets } from 'livekit-client';
import AudioRoom from './AudioRoom';
import '@livekit/components-styles';

const LIVEKIT_URL = 'wss://bizim-dc-x3m53dz5.livekit.cloud';

export default function App() {
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'guest', 'dashboard', 'room'
  const [username, setUsername] = useState(localStorage.getItem('savedUsername') || '');
  const [password, setPassword] = useState('');
  
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [myRooms, setMyRooms] = useState([]);
  
  const [token, setToken] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Uygulama açılışında kayıtlı kullanıcı varsa direkt Dashboard'a al
  useEffect(() => {
    const savedUser = localStorage.getItem('savedUsername');
    if (savedUser) {
      fetchMyRooms(savedUser);
      setAuthMode('dashboard');
    }
  }, []);

  const fetchMyRooms = async (user) => {
    try {
      const res = await fetch(`/api/rooms/${user}`);
      const data = await res.json();
      if (data.rooms) setMyRooms(data.rooms);
    } catch (err) {}
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('Kayıt Başarılı! Lütfen giriş yapın.');
      setAuthMode('login');
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      localStorage.setItem('savedUsername', data.username);
      fetchMyRooms(data.username);
      setAuthMode('dashboard');
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('savedUsername');
    setUsername(''); setPassword(''); setMyRooms([]);
    setAuthMode('login');
  };

  const handleJoinRoom = async (e, targetRoom = roomName) => {
    if (e) e.preventDefault();
    const joinName = authMode === 'guest' ? (username || 'Misafir') : localStorage.getItem('savedUsername');
    
    if (!targetRoom.trim() || !joinName.trim()) return setError('İsim ve Oda Adı zorunlu.');
    
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomName: targetRoom, 
          participantName: joinName, 
          password: roomPassword,
          isGuest: authMode === 'guest' 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setRoomName(targetRoom);
      setIsAdmin(data.isAdmin); 
      setToken(data.token);
      setAuthMode('room');
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  // 1. ODA EKRANI (LIVEKIT)
  if (authMode === 'room' && token) {
    return (
      <LiveKitRoom
        video={false}
        audio={{ echoCancellation: true, noiseSuppression: false, autoGainControl: true }}
        options={{ adaptiveStream: true, dynacast: true }}
        token={token}
        serverUrl={LIVEKIT_URL}
        onDisconnected={() => { setToken(''); setAuthMode(localStorage.getItem('savedUsername') ? 'dashboard' : 'login'); }}
        data-lk-theme="default"
      >
        <AudioRoom roomName={roomName} isAdmin={isAdmin} onLeave={() => { setToken(''); setAuthMode(localStorage.getItem('savedUsername') ? 'dashboard' : 'login'); }} />
      </LiveKitRoom>
    );
  }

  // 2. DASHBOARD EKRANI (Giriş Yapmış Kullanıcılar İçin)
  if (authMode === 'dashboard') {
    return (
      <div className="dashboard-container">
        <div className="dashboard-sidebar">
          <div className="user-profile">
            <div className="avatar giant-avatar" style={{width:'60px', height:'60px', fontSize:'24px'}}>
               {username.charAt(0).toUpperCase()}
            </div>
            <h3>{username}</h3>
            <button onClick={handleLogout} className="logout-btn">Çıkış Yap</button>
          </div>
          
          <div className="my-rooms-section">
            <h4>Geçmiş Odalarım</h4>
            {myRooms.length === 0 ? <p className="no-rooms">Henüz bir odaya girmediniz.</p> : (
              <ul className="room-list">
                {myRooms.map(r => (
                  <li key={r} onClick={() => handleJoinRoom(null, r)}># {r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="dashboard-main">
          <div className="join-card">
            <h2>Yeni Oda Kur / Katıl</h2>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleJoinRoom}>
              <div className="form-group">
                <label>Oda Adı</label>
                <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} required placeholder="Örn: Genel Sohbet" />
              </div>
              <div className="form-group">
                <label>Oda Şifresi (Kuruyorsan Belirle)</label>
                <input type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Gizli Şifre (İsteğe bağlı)" />
              </div>
              <button type="submit" disabled={loading} className="join-btn">
                {loading ? 'Bağlanılıyor...' : 'Odaya Gir'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 3. GİRİŞ / KAYIT / MİSAFİR EKRANLARI
  return (
    <div className="join-container">
      <div className="join-card auth-card">
        <div className="auth-tabs">
          <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Giriş</button>
          <button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Kayıt Ol</button>
          <button className={authMode === 'guest' ? 'active' : ''} onClick={() => setAuthMode('guest')}>Misafir</button>
        </div>

        <h2>{authMode === 'login' ? 'Tekrar Hoşgeldin!' : authMode === 'register' ? 'Hesap Oluştur' : 'Misafir Olarak Gir'}</h2>
        {error && <div className="error-msg">{error}</div>}
        
        <form onSubmit={authMode === 'login' ? handleLogin : authMode === 'register' ? handleRegister : handleJoinRoom}>
          <div className="form-group">
            <label>Kullanıcı Adı</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          
          {authMode !== 'guest' && (
            <div className="form-group">
              <label>Şifre</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          )}

          {authMode === 'guest' && (
            <>
              <div className="form-group">
                <label>Oda Adı</label>
                <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Oda Şifresi</label>
                <input type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} />
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="join-btn">
            {loading ? 'İşleniyor...' : authMode === 'login' ? 'Giriş Yap' : authMode === 'register' ? 'Kayıt Ol' : 'Odaya Gir'}
          </button>
        </form>
      </div>
    </div>
  );
}