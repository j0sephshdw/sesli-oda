import React, { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import AudioRoom from './AudioRoom';
import Auth from './Auth';           // YOL DÜZELTİLDİ: Doğrudan src klasöründen çekiliyor
import Dashboard from './Dashboard'; // YOL DÜZELTİLDİ: Doğrudan src klasöründen çekiliyor
import '@livekit/components-styles';
import './index.css';

const LIVEKIT_URL = 'wss://bizim-dc-x3m53dz5.livekit.cloud';

export default function App() {
  const [authMode, setAuthMode] = useState('login'); 
  const [username, setUsername] = useState(localStorage.getItem('savedUsername') || '');
  const [myRooms, setMyRooms] = useState([]);
  
  const [roomName, setRoomName] = useState('');
  const [token, setToken] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Kullanıcı adı değiştikçe geçmiş odalarını getir
  useEffect(() => {
    if (username && authMode === 'dashboard') {
      fetch(`/api/rooms/${username}`)
        .then(res => res.json())
        .then(data => { if (data.rooms) setMyRooms(data.rooms); })
        .catch(err => console.error("Geçmiş odalar çekilemedi:", err));
    }
  }, [username, authMode]);

  // Başlangıçta giriş yapmış kullanıcı varsa Dashboard'a at
  useEffect(() => {
    if (localStorage.getItem('savedUsername')) {
      setAuthMode('dashboard');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('savedUsername');
    setUsername(''); 
    setMyRooms([]);
    setToken('');
    setAuthMode('login');
  };

  const handleRoomLeave = () => {
    setToken('');
    setAuthMode(localStorage.getItem('savedUsername') ? 'dashboard' : 'login');
  };

  // ODA İÇİ GÖRÜNÜM
  if (authMode === 'room' && token) {
    return (
      <LiveKitRoom
        serverUrl={LIVEKIT_URL}
        token={token}
        audio={true}
        video={false}
        onDisconnected={handleRoomLeave}
        data-lk-theme="default"
      >
        <AudioRoom
          roomName={roomName}
          isAdmin={isAdmin}
          onLeave={handleRoomLeave}
        />
      </LiveKitRoom>
    );
  }

  // DASHBOARD GÖRÜNÜMÜ
  if (authMode === 'dashboard') {
    return (
      <Dashboard 
        username={username}
        myRooms={myRooms}
        onLogout={handleLogout}
        onJoinRoom={(rName, rToken, rAdmin) => {
          setRoomName(rName);
          setToken(rToken);
          setIsAdmin(rAdmin);
          setAuthMode('room');
        }}
      />
    );
  }

  // GİRİŞ & KAYIT GÖRÜNÜMÜ
  return (
    <Auth 
      initialMode={authMode}
      onAuthSuccess={(uName) => {
        localStorage.setItem('savedUsername', uName);
        setUsername(uName);
        setAuthMode('dashboard');
      }}
      onGuestSuccess={(rName, rToken, rAdmin, guestName) => {
        setUsername(guestName); // Misafir ismi sadece bu oturum için
        setRoomName(rName);
        setToken(rToken);
        setIsAdmin(rAdmin);
        setAuthMode('room');
      }}
    />
  );
}