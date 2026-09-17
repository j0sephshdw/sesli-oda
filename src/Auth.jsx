import React, { useState } from 'react';

export default function Auth({ initialMode = 'login', onAuthSuccess, onGuestSuccess }) {
  const [authMode, setAuthMode] = useState(initialMode);
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        body: JSON.stringify({ email, username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert('Kayıt Başarılı! Lütfen e-posta adresinize gelen 6 haneli kodu giriniz.');
      setAuthMode('verify');
    } catch (err) { triggerError(err.message); }
    finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert('E-posta başarıyla doğrulandı! Şimdi giriş yapabilirsiniz.');
      setAuthMode('login');
      setVerificationCode('');
    } catch (err) { triggerError(err.message); }
    finally { setLoading(false); }
  };

  // 🟡 YENİ EKLENEN FONKSİYON: Kodu Tekrar Gönder
  const handleResendCode = async () => {
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/resend-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert('Yeni doğrulama kodu e-postanıza başarıyla gönderildi!');
    } catch (err) { triggerError(err.message); }
    finally { setLoading(false); }
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
      
      if (!res.ok) {
        // 🔴 KRİTİK DÜZELTME: Hesap var ama doğrulanmamışsa, otomatik olarak kod ekranına at
        if (data.needsVerification) {
          setEmail(data.email);
          setAuthMode('verify');
          throw new Error('Hesabınız henüz doğrulanmamış. Lütfen e-postanıza gelen kodu girin.');
        }
        throw new Error(data.error);
      }
      
      onAuthSuccess(data.username);
    } catch (err) { triggerError(err.message); }
    finally { setLoading(false); }
  };

  const handleGuestJoin = async (e) => {
    e.preventDefault();
    const guestName = username || 'Misafir';
    if (!roomName.trim() || !guestName.trim()) return triggerError('İsim ve Oda Adı zorunlu.');
    
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomName, 
          participantName: guestName, 
          password: roomPassword,
          isGuest: true 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      onGuestSuccess(roomName, data.token, data.isAdmin, guestName);
    } catch (err) { triggerError(err.message); }
    finally { setLoading(false); }
  };

  // 🟠 DOĞRULAMA (VERIFY) EKRANI GÜNCELLEMESİ
  if (authMode === 'verify') {
    return (
      <div className="premium-auth-wrapper">
        <div className={`premium-auth-card ${shake ? 'shake' : ''}`}>
          <div className="auth-header">
            <h2>E-posta Doğrulama</h2>
            <p>Lütfen <b>{email}</b> adresinize gönderilen 6 haneli kodu girin.</p>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleVerify}>
            <div className="premium-form-group">
              <label>DOĞRULAMA KODU <span className="req">*</span></label>
              <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} required placeholder="Örn: 123456" maxLength={6} />
            </div>
            <button type="submit" disabled={loading} className="premium-submit-btn">
              {loading ? 'Doğrulanıyor...' : 'Doğrula'}
            </button>
          </form>
          
          <div className="auth-footer-links" style={{marginTop: '20px'}}>
             <a onClick={handleResendCode} className="link-action" style={{marginBottom: '10px', color: '#57F287'}}>Kodu Tekrar Gönder</a>
             <a onClick={() => {setAuthMode('login'); setError(''); setVerificationCode('');}} className="link-action">İptal ve Girişe Dön</a>
          </div>
        </div>
      </div>
    );
  }

  // 🔵 GİRİŞ / KAYIT / MİSAFİR EKRANI
  return (
    <div className="premium-auth-wrapper">
      <div className={`premium-auth-card ${shake ? 'shake' : ''}`}>
        <div className="auth-header">
          <h2>{authMode === 'login' ? 'Tekrar Hoş Geldin!' : authMode === 'register' ? 'Hesap Oluştur' : 'Misafir Girişi'}</h2>
          <p>{authMode === 'login' ? 'Seni tekrar görmek ne güzel!' : authMode === 'register' ? 'Hemen bize katıl ve odalarını kaydet.' : 'Kayıt olmadan hızlıca odalara sız.'}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        
        <form onSubmit={authMode === 'login' ? handleLogin : authMode === 'register' ? handleRegister : handleGuestJoin}>
          {authMode === 'register' && (
            <div className="premium-form-group">
              <label>E-POSTA <span className="req">*</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ornek@mail.com" />
            </div>
          )}

          <div className="premium-form-group">
            <label>KULLANICI ADI <span className="req">*</span></label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Kullanıcı Adı" />
          </div>
          
          {authMode !== 'guest' && (
            <div className="premium-form-group">
              <label>ŞİFRE <span className="req">*</span></label>
              <div className="password-wrapper">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Şifre" />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          {authMode === 'guest' && (
            <>
              <div className="premium-form-group">
                <label>ODA ADI <span className="req">*</span></label>
                <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} required placeholder="Oda Adı" />
              </div>
              <div className="premium-form-group">
                <label>ODA ŞİFRESİ</label>
                <div className="password-wrapper">
                  <input type={showPassword ? "text" : "password"} value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Şifre (Varsa)" />
                  <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="premium-submit-btn">
            {loading ? 'İşleniyor...' : authMode === 'login' ? 'Giriş Yap' : authMode === 'register' ? 'Kayıt Ol' : 'Odaya Gir'}
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