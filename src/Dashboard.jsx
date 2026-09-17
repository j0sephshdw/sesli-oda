import React, { useState, useEffect } from 'react';

// Sık kullanılan profil renk paleti
const COLOR_PALETTE = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#00a8fc', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'];

export default function Dashboard({ username, myRooms, onLogout, onJoinRoom }) {
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms', 'friends', 'search', 'profile'
  
  // Oda Katılım State'leri
  const [targetRoom, setTargetRoom] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Sosyal ve Profil State'leri
  const [profile, setProfile] = useState({ 
    friendsDetail: [], friendsList: [], friendRequests: [], sentRequests: [], bio: '', color: '#5865F2' 
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Profil Düzenleme State'leri
  const [editBio, setEditBio] = useState('');
  const [editColor, setEditColor] = useState('');

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
          friendsDetail: data.friendsDetail || [],
          friendsList: data.friendsList || [],
          friendRequests: data.friendRequests || [],
          sentRequests: data.sentRequests || [],
          bio: data.bio || '',
          color: data.color || '#5865F2'
        });
      }
    } catch (err) { console.error("Profil çekilemedi:", err); }
  };

  // Profil verisi ilk yüklendiğinde düzenleme inputlarına at
  useEffect(() => {
    setEditBio(profile.bio);
    setEditColor(profile.color);
  }, [profile.bio, profile.color]);

  // Her 10 saniyede bir Heartbeat (Son Görülme) ve Arkadaş/İstek listesini güncelle
  useEffect(() => {
    fetchProfile();
    const interval = setInterval(fetchProfile, 10000); 
    return () => clearInterval(interval);
  }, [username]);

  const triggerNotify = (msg, isError = true) => {
    if (isError) { setError(msg); setSuccess(''); setShake(true); setTimeout(() => setShake(false), 500); }
    else { setSuccess(msg); setError(''); setTimeout(() => setSuccess(''), 3000); }
  };

  // --- ODA & DM FONKSİYONLARI ---
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

  const handleDirectMessage = (friendName) => {
    const dmRoomName = `DM_${[username, friendName].sort().join('-')}`;
    handleJoin(null, dmRoomName);
  };

  // --- SOSYAL & PROFİL FONKSİYONLARI ---
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/users/${username}/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: editBio, color: editColor })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      triggerNotify('Profil başarıyla güncellendi!', false);
      fetchProfile();
    } catch (err) { triggerNotify(err.message); }
    finally { setLoading(false); }
  };

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

  // Çevrimiçi (Online) olan arkadaşları listenin en üstüne çıkar
  const sortedFriends = [...profile.friendsDetail].sort((a, b) => (b.isOnline === a.isOnline ? 0 : b.isOnline ? 1 : -1));

  return (
    <div className="dashboard-container">
      {/* SOL MENÜ (NAVIGASYON) */}
      <div className="dashboard-sidebar">
        <div className="user-profile">
          <div className="avatar giant-avatar" style={{width:'60px', height:'60px', fontSize:'24px', backgroundColor: profile.color}}>
             {username.charAt(0).toUpperCase()}
          </div>
          <h3 style={{marginBottom: '5px'}}>{username}</h3>
          {profile.bio && <span style={{fontSize: '11px', color: '#949ba4', textAlign: 'center', padding: '0 10px'}}>{profile.bio}</span>}
        </div>
        
        <div className="nav-menu">
          <button className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            👤 Profilim
          </button>
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

        {/* 0. PROFİLİM SEKMESİ */}
        {activeTab === 'profile' && (
          <div className="dashboard-content-wrapper social-wrapper">
            <h2>👤 Profil Ayarları</h2>
            <div className="social-section">
              <form onSubmit={handleSaveProfile}>
                <div className="premium-form-group">
                  <label>HAKKIMDA (BİO)</label>
                  <textarea 
                    value={editBio} 
                    onChange={(e) => setEditBio(e.target.value)} 
                    maxLength={100}
                    placeholder="Kendinizden bahsedin..." 
                    style={{padding: '12px', borderRadius: '8px', background: '#1e1f22', border: '1px solid #3f4147', color: 'white', resize: 'none', height: '80px', fontFamily: 'inherit'}}
                  />
                  <small style={{color: '#949ba4', fontSize: '11px', marginTop: '5px', textAlign: 'right'}}>{editBio.length}/100</small>
                </div>
                
                <div className="premium-form-group">
                  <label>TEMA RENGİ (AVATAR)</label>
                  <div className="color-picker-group">
                    {COLOR_PALETTE.map(c => (
                      <div 
                        key={c} 
                        onClick={() => setEditColor(c)}
                        className={`color-circle ${editColor === c ? 'selected' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={loading} className="premium-submit-btn" style={{marginTop: '10px'}}>
                  {loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </form>
            </div>
          </div>
        )}

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

        {/* 2. ARKADAŞLARIM SEKMESİ (Zenginleştirildi) */}
        {activeTab === 'friends' && (
          <div className="dashboard-content-wrapper social-wrapper">
            <h2>👥 Arkadaşlarım</h2>
            
            {profile.friendRequests.length > 0 && (
              <div className="social-section">
                <h4>Gelen İstekler ({profile.friendRequests.length})</h4>
                <ul className="friend-list">
                  {profile.friendRequests.map(req => (
                    <li key={req} className="friend-item-rich">
                      <div className="friend-info">
                        <div className="avatar mini-avatar">{req.charAt(0).toUpperCase()}</div>
                        <span className="friend-name">{req}</span>
                      </div>
                      <div className="friend-actions">
                        <button onClick={() => handleRespondRequest(req, 'accept')} className="icon-btn success" title="Kabul Et">✅</button>
                        <button onClick={() => handleRespondRequest(req, 'reject')} className="icon-btn danger" title="Reddet">❌</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="social-section">
              <h4>Tüm Arkadaşlar ({sortedFriends.length})</h4>
              {sortedFriends.length === 0 ? (
                <p className="no-data">Henüz hiç arkadaşın yok. "Kişi Bul" sekmesinden yeni kişileri ekleyebilirsin.</p>
              ) : (
                <ul className="friend-list">
                  {sortedFriends.map(friend => (
                    <li key={friend.username} className="friend-item-rich">
                      <div className="friend-info" style={{alignItems: 'center'}}>
                        <div className="friend-avatar-wrapper">
                           <div className="avatar mini-avatar" style={{backgroundColor: friend.color}}>{friend.username.charAt(0).toUpperCase()}</div>
                           <div className={`online-dot ${friend.isOnline ? 'online' : 'offline'}`} title={friend.isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}></div>
                        </div>
                        <div className="friend-details">
                           <span className="friend-name">{friend.username}</span>
                           <span className="friend-bio" title={friend.bio}>{friend.bio}</span>
                        </div>
                      </div>
                      <button onClick={() => handleDirectMessage(friend.username)} className="premium-submit-btn dm-btn">
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
                  const isFriend = profile.friendsList.includes(user);
                  const isSent = profile.sentRequests.includes(user);
                  
                  return (
                    <li key={user} className="friend-item-rich">
                      <div className="friend-info">
                        <div className="avatar mini-avatar" style={{backgroundColor: '#5865F2'}}>{user.charAt(0).toUpperCase()}</div>
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