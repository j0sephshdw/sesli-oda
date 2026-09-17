import React, { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { VideoPresets, ScreenSharePresets } from 'livekit-client';
import AudioRoom from './AudioRoom';
import '@livekit/components-styles';

const LIVEKIT_URL = 'wss://bizim-dc-x3m53dz5.livekit.cloud';

export default function App() {
  const [authMode, setAuthMode] = useState('login'); 
  const [username, setUsername] = useState(localStorage.getItem('savedUsername') || '');
  const [password, setPassword] = useState('');
  
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [myRooms, setMyRooms] = useState([]);
  
  const [token, setToken] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // YENİ: Gelişmiş Hata ve UI State'leri
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);

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

  // YENİ: Hata durumunda ekranı titreten fonksiyon
  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
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
      setPassword('');
    } catch (err) { triggerError(err.message); }
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
      setPassword('');
    } catch (err) { triggerError(err.message); }
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
    
    if (!targetRoom.trim() || !joinName.trim()) return triggerError('İsim ve Oda Adı zorunlu.');
    
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
    } catch (err) { triggerError(err.message); }
    setLoading(false);
  };

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
          <div className="join-card premium-auth-card">
            <div className="auth-header">
              <h2>Yeni Oda Kur veya Katıl</h2>
              <p>Maceraya atılmaya hazır mısın?</p>
            </div>
            {error && <div className={`auth-error ${shake ? 'shake' : ''}`}>{error}</div>}
            <form onSubmit={handleJoinRoom}>
              <div className="premium-form-group">
                <label>ODA ADI <span className="req">*</span></label>
                <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} required placeholder="Örn: Genel Sohbet" />
              </div>
              <div className="premium-form-group">
                <label>ODA ŞİFRESİ</label>
                <input type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Gizli Şifre (İsteğe bağlı)" />
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

  // YENİ: DİSCORD BİREBİR GİRİŞ/KAYIT EKRANI
  return (
    <div className="premium-auth-wrapper">
      <div className={`premium-auth-card ${shake ? 'shake' : ''}`}>
        <div className="auth-header">
          <h2>{authMode === 'login' ? 'Tekrar Hoş Geldin!' : authMode === 'register' ? 'Hesap Oluştur' : 'Misafir Girişi'}</h2>
          <p>{authMode === 'login' ? 'Seni tekrar görmek ne güzel!' : authMode === 'register' ? 'Hemen bize katıl ve odalarını kaydet.' : 'Kayıt olmadan hızlıca odalara sız.'}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        
        <form onSubmit={authMode === 'login' ? handleLogin : authMode === 'register' ? handleRegister : handleJoinRoom}>
          <div className="premium-form-group">
            <label>KULLANICI ADI <span className="req">*</span></label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          
          {authMode !== 'guest' && (
            <div className="premium-form-group">
              <label>ŞİFRE <span className="req">*</span></label>
              <div className="password-wrapper">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {authMode === 'login' && <span className="forgot-password">Şifreni mi unuttun?</span>}
            </div>
          )}

          {authMode === 'guest' && (
            <>
              <div className="premium-form-group">
                <label>ODA ADI <span className="req">*</span></label>
                <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} required />
              </div>
              <div className="premium-form-group">
                <label>ODA ŞİFRESİ</label>
                <div className="password-wrapper">
                  <input type={showPassword ? "text" : "password"} value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} />
                  <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="premium-submit-btn">
            {loading ? 'İşleniyor...' : authMode === 'login' ? 'Giriş Yap' : authMode === 'register' ? 'Devam Et' : 'Odaya Gir'}
          </button>
        </form>

        <div className="auth-footer-links">
          {authMode === 'login' ? (
            <>
              <span className="text-muted">Hesabın yok mu? </span>
              <a onClick={() => {setAuthMode('register'); setError('');}} className="link-action">Kayıt Ol</a>
              <div className="divider">veya</div>
              <a onClick={() => {setAuthMode('guest'); setError('');}} className="link-action guest-link">Kayıt olmadan misafir olarak gir</a>
            </>
          ) : authMode === 'register' ? (
            <>
              <a onClick={() => {setAuthMode('login'); setError('');}} className="link-action">Zaten bir hesabın var mı?</a>
              <div className="divider">veya</div>
              <a onClick={() => {setAuthMode('guest'); setError('');}} className="link-action guest-link">Kayıt olmadan misafir olarak gir</a>
            </>
          ) : (
            <a onClick={() => {setAuthMode('login'); setError('');}} className="link-action">Geri Dön ve Giriş Yap</a>
          )}
        </div>
      </div>
    </div>
  );
}