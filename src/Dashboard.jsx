import React, { useState, useEffect } from 'react';

export default function Dashboard({ username, myRooms, onLogout, onJoinRoom }) {
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms', 'friends', 'search'
  
  // Oda Katılım State'leri
  const [targetRoom, setTargetRoom] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Sosyal State'ler
  const [profile, setProfile] = useState({ friends: [], friendRequests: [], sentRequests: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [shake, setShake] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/users/${username}/profile`);
      if (res.ok) {
        const data = await res.json();
        setProfile({
          friends: data.friends || [],
          friendRequests: data.friendRequests || [],
          sentRequests: data.sentRequests || []
        });
      }
    } catch (err) { console.error("Profil çekilemedi:", err); }
  };

  useEffect(() => {
    fetchProfile();
    const interval = setInterval(fetchProfile, 10000); // Her 10 saniyede bir arkadaşlık isteklerini kontrol et
    return () => clearInterval(interval);
  }, [username]);

  const triggerNotify = (msg, isError = true) => {
    if (isError) { setError(msg); setSuccess(''); setShake(true); setTimeout(() => setShake(false), 500); }
    else { setSuccess(msg); setError(''); setTimeout(() => setSuccess(''), 3000); }
  };

  // --- ODA FONKSİYONLARI ---
  const handleJoin = async (e, directRoomName = null) => {
    if (e) e.preventDefault();
    const roomToJoin = directRoomName || targetRoom;
    if (!roomToJoin.trim()) return triggerNotify('Oda Adı zorunlu.');
    
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomToJoin, participantName: username, password: roomPassword, isGuest: false })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onJoinRoom(roomToJoin, data.token, data.isAdmin);
    } catch (err) { triggerNotify(err.message); setLoading(false); }
  };

  // Özel Mesaja (DM) Geçiş
  const handleDirectMessage = (friendName) => {
    // İki ismi alfabetik sıralayıp araya tire koyarak benzersiz gizli bir oda ismi oluşturuyoruz
    const dmRoomName = `DM_${[username, friendName].sort().join('-')}`;
    handleJoin(null, dmRoomName);
  };

  // --- SOSYAL FONKSİYONLAR ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/users/search?q=${searchQuery}&currentUsername=${username}`);
      const data = await res.json();
      setSearchResults(data.users || []);
      if (data.users.length === 0) triggerNotify('Kullanıcı bulunamadı.');
    } catch (err) { triggerNotify('Arama başarısız.'); }
    finally { setLoading(false); }
  };

  const handleSendRequest = async (targetUser) => {
    setLoading(true);
    try {
      const res = await fetch('/api/friends/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: username, target: targetUser })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerNotify(`${targetUser} kişisine istek gönderildi!`, false);
      fetchProfile();
    } catch (err) { triggerNotify(err.message); }
    finally { setLoading(false); }
  };

  const handleRespondRequest = async (targetUser, action) => {
    setLoading(true);
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: username, target: targetUser, action })
      });
      if (!res.ok) throw new Error("İşlem başarısız.");
      triggerNotify(action === 'accept' ? 'Arkadaş eklendi!' : 'İstek reddedildi.', false);
      fetchProfile();
    } catch (err) { triggerNotify(err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('⚠️ Hesabınızı kalıcı olarak silmek istediğinize emin misiniz?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/delete-account', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (!res.ok) throw new Error("Silme başarısız.");
      alert('Hesabınız başarıyla silindi.'); onLogout();
    } catch (err) { triggerNotify(err.message); setLoading(false); }
  };

  return (
    <div className="dashboard-container">
      {/* SOL MENÜ (NAVIGASYON) */}
      <div className="dashboard-sidebar">
        <div className="user-profile">
          <div className="avatar giant-avatar" style={{width:'60px', height:'60px', fontSize:'24px'}}>
             {username.charAt(0).toUpperCase()}
          </div>
          <h3>{username}</h3>
        </div>
        
        <div className="nav-menu">
          <button className={`nav-btn ${activeTab === 'rooms' ? 'active' : ''}`} onClick={() => setActiveTab('rooms')}>
            🏠 Odalarım
          </button>
          <button className={`nav-btn ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => setActiveTab('friends')}>
            👥 Arkadaşlarım {profile.friendRequests.length > 0 && <span className="nav-badge">{profile.friendRequests.length}</span>}
          </button>
          <button className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
            🔍 Kişi Bul
          </button>
        </div>

        <div className="sidebar-footer">
          <button onClick={onLogout} className="logout-btn">Çıkış Yap</button>
          <button onClick={handleDeleteAccount} className="logout-btn delete-btn">Hesabımı Sil</button>
        </div>
      </div>

      {/* SAĞ PANEL (İÇERİK) */}
      <div className="dashboard-main">
        {error && <div className={`auth-error absolute-toast ${shake ? 'shake' : ''}`}>{error}</div>}
        {success && <div className="auth-success absolute-toast">{success}</div>}

        {/* 1. ODALARIM SEKMESİ */}
        {activeTab === 'rooms' && (
          <div className="dashboard-content-wrapper">
            <div className="join-card premium-auth-card" style={{margin: '0 auto', maxWidth: '500px'}}>
              <div className="auth-header">
                <h2>Oda Kur veya Katıl</h2>
                <p>Genel bir odaya girin veya yenisini oluşturun.</p>
              </div>
              <form onSubmit={handleJoin}>
                <div className="premium-form-group">
                  <label>ODA ADI <span className="req">*</span></label>
                  <input type="text" value={targetRoom} onChange={(e) => setTargetRoom(e.target.value)} required placeholder="Örn: Genel Sohbet" />
                </div>
                <div className="premium-form-group">
                  <label>ODA ŞİFRESİ</label>
                  <div className="password-wrapper">
                    <input type={showPassword ? "text" : "password"} value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Gizli Şifre (İsteğe bağlı)" />
                    <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>{showPassword ? '🙈' : '👁️'}</button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="premium-submit-btn">Odaya Gir</button>
              </form>
            </div>

            <div className="my-rooms-section" style={{marginTop: '40px', maxWidth: '500px', width: '100%', margin: '40px auto 0'}}>
              <h4 style={{color: '#949ba4', marginBottom: '10px'}}>Geçmiş Odalarım</h4>
              {myRooms.length === 0 ? <p className="no-rooms">Henüz bir odaya girmediniz.</p> : (
                <ul className="room-list">
                  {myRooms.map(r => (
                    <li key={r} onClick={() => handleJoin(null, r)}># {r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* 2. ARKADAŞLARIM SEKMESİ */}
        {activeTab === 'friends' && (
          <div className="dashboard-content-wrapper social-wrapper">
            <h2>👥 Arkadaşlarım</h2>
            
            {/* Gelen İstekler */}
            {profile.friendRequests.length > 0 && (
              <div className="social-section">
                <h4>Gelen İstekler ({profile.friendRequests.length})</h4>
                <ul className="friend-list">
                  {profile.friendRequests.map(req => (
                    <li key={req} className="friend-item">
                      <div className="friend-info">
                        <div className="avatar mini-avatar">{req.charAt(0).toUpperCase()}</div>
                        <span className="friend-name">{req}</span>
                      </div>
                      <div className="friend-actions">
                        <button onClick={() => handleRespondRequest(req, 'accept')} className="icon-btn success">✅</button>
                        <button onClick={() => handleRespondRequest(req, 'reject')} className="icon-btn danger">❌</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Arkadaş Listesi */}
            <div className="social-section">
              <h4>Tüm Arkadaşlar ({profile.friends.length})</h4>
              {profile.friends.length === 0 ? (
                <p className="no-data">Henüz hiç arkadaşın yok. "Kişi Bul" sekmesinden yeni kişileri ekleyebilirsin.</p>
              ) : (
                <ul className="friend-list">
                  {profile.friends.map(friend => (
                    <li key={friend} className="friend-item">
                      <div className="friend-info">
                        <div className="avatar mini-avatar">{friend.charAt(0).toUpperCase()}</div>
                        <span className="friend-name">{friend}</span>
                      </div>
                      <button onClick={() => handleDirectMessage(friend)} className="premium-submit-btn dm-btn">
                        💬 Mesajlaş
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* 3. KİŞİ BUL SEKMESİ */}
        {activeTab === 'search' && (
          <div className="dashboard-content-wrapper social-wrapper">
            <h2>🔍 Yeni Kişiler Bul</h2>
            <form onSubmit={handleSearch} className="search-form">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Kullanıcı adı ara..." className="search-input" />
              <button type="submit" disabled={loading} className="premium-submit-btn search-btn">Ara</button>
            </form>

            <div className="social-section" style={{marginTop: '20px'}}>
              <ul className="friend-list">
                {searchResults.map(user => {
                  const isFriend = profile.friends.includes(user);
                  const isSent = profile.sentRequests.includes(user);
                  
                  return (
                    <li key={user} className="friend-item">
                      <div className="friend-info">
                        <div className="avatar mini-avatar">{user.charAt(0).toUpperCase()}</div>
                        <span className="friend-name">{user}</span>
                      </div>
                      {isFriend ? (
                        <span className="status-badge">Arkadaşsınız</span>
                      ) : isSent ? (
                        <span className="status-badge pending">İstek Gönderildi</span>
                      ) : (
                        <button onClick={() => handleSendRequest(user)} disabled={loading} className="icon-btn add-btn">
                          ➕ Ekle
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}