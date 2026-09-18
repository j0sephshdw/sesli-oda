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
  const [successMsg, setSuccessMsg] = useState(''); 
  const [shake, setShake] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const triggerError = (msg) => {
    setSuccessMsg(''); setError(msg); setShake(true); setTimeout(() => setShake(false), 500);
  };

  const triggerSuccess = (msg) => {
    setError(''); setSuccessMsg(msg);
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setError(''); setSuccessMsg(''); setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      triggerSuccess('Kayıt Başarılı! Lütfen e-postanıza gelen 6 haneli kodu girin.');
      setAuthMode('verify');
    } catch (err) { triggerError(err.message); } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault(); setError(''); setSuccessMsg(''); setLoading(true);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Kod doğruysa doğrudan içeri al
      onAuthSuccess(data.username);
    } catch (err) { triggerError(err.message); } finally { setLoading(false); }
  };

  const handleResendCode = async () => {
    setError(''); setSuccessMsg(''); setLoading(true);
    try {
      const res = await fetch('/api/resend-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      triggerSuccess('Yeni doğrulama kodu başarıyla gönderildi! (Spam klasörünü kontrol edin)');
    } catch (err) { triggerError(err.message); } finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setSuccessMsg(''); setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        // Eğer kullanıcı adı/şifre doğru ama hesap onaysızsa doğrulama ekranına at
        if (data.needsVerification) {
          setEmail(data.email); 
          setAuthMode('verify');
          throw new Error('Hesabınız henüz onaylanmamış. Mailinize gelen kodu girin.');
        }
        throw new Error(data.error);
      }
      onAuthSuccess(data.username);
    } catch (err) { triggerError(err.message); } finally { setLoading(false); }
  };

  const handleGuestJoin = async (e) => {
    e.preventDefault(); const guestName = username || 'Misafir';
    if (!roomName.trim() || !guestName.trim()) return triggerError('İsim ve Oda Adı zorunlu.');
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName: guestName, password: roomPassword, isGuest: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onGuestSuccess(roomName, data.token, data.isAdmin, guestName);
    } catch (err) { triggerError(err.message); } finally { setLoading(false); }
  };

  if (authMode === 'verify') {
    return (
      <div className="premium-auth-wrapper">
        <div className={`premium-auth-card ${shake ? 'shake' : ''}`}>
          <div className="auth-header">
            <h2>Kodu Girin</h2>
            <p style={{marginTop: '10px'}}><b>{email}</b> adresinize 6 haneli bir doğrulama kodu yolladık.</p>
          </div>
          {error && <div className="auth-error">{error}</div>}
          {successMsg && <div className="auth-success">{successMsg}</div>}
          
          <form onSubmit={handleVerify}>
            <div className="premium-form-group">
              <label>DOĞRULAMA KODU <span className="req">*</span></label>
              <input 
                type="text" 
                maxLength={6} 
                value={verificationCode} 
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))} // Sadece sayı girmesine izin ver
                required 
                placeholder="123456" 
                style={{textAlign: 'center', letterSpacing: '12px', fontSize: '28px', fontWeight: 'bold'}} 
              />
            </div>
            <button type="submit" disabled={loading || verificationCode.length < 6} className="premium-submit-btn" style={{backgroundColor: '#23a55a'}}>
              {loading ? 'Kontrol Ediliyor...' : 'Doğrula ve Giriş Yap'}
            </button>
          </form>
          <div className="auth-footer-links" style={{marginTop: '20px'}}>
             <a onClick={handleResendCode} className="link-action" style={{marginBottom: '10px', color: '#57F287'}}>Kodu Tekrar Gönder</a>
             <a onClick={() => {setAuthMode('login'); setError(''); setSuccessMsg('');}} className="link-action">İptal ve Girişe Dön</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-auth-wrapper">
      <div className={`premium-auth-card ${shake ? 'shake' : ''}`}>
        <div className="auth-header">
          <h2>{authMode === 'login' ? 'Tekrar Hoş Geldin!' : authMode === 'register' ? 'Hesap Oluştur' : 'Misafir Girişi'}</h2>
          <p>{authMode === 'login' ? 'Seni tekrar görmek ne güzel!' : authMode === 'register' ? 'Hemen bize katıl ve odalarını kaydet.' : 'Kayıt olmadan hızlıca odalara sız.'}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {successMsg && <div className="auth-success">{successMsg}</div>}
        
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
              <a onClick={() => {setAuthMode('register'); setError(''); setSuccessMsg('');}} className="link-action">Kayıt Ol</a>
              <div className="divider">veya</div>
              <a onClick={() => {setAuthMode('guest'); setError(''); setSuccessMsg('');}} className="link-action guest-link">Kayıt olmadan misafir olarak gir</a>
            </>
          ) : authMode === 'register' ? (
            <>
              <a onClick={() => {setAuthMode('login'); setError(''); setSuccessMsg('');}} className="link-action">Zaten bir hesabın var mı?</a>
              <div className="divider">veya</div>
              <a onClick={() => {setAuthMode('guest'); setError(''); setSuccessMsg('');}} className="link-action guest-link">Kayıt olmadan misafir olarak gir</a>
            </>
          ) : (
            <a onClick={() => {setAuthMode('login'); setError(''); setSuccessMsg('');}} className="link-action">Geri Dön ve Giriş Yap</a>
          )}
        </div>
      </div>
    </div>
  );
}