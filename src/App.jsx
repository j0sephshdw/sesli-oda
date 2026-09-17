import React, { useState, useEffect } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import AudioRoom from './AudioRoom';
import Auth from './Auth';
import Dashboard from './Dashboard';
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

  useEffect(() => {
    if (username && authMode === 'dashboard') {
      fetch(`/api/rooms/${username}`)
        .then(res => res.json())
        .then(data => { if (data.rooms) setMyRooms(data.rooms); })
        .catch(err => console.error("Geçmiş odalar çekilemedi:", err));
    }
  }, [username, authMode]);

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

  return (
    <Auth 
      initialMode={authMode}
      onAuthSuccess={(uName) => {
        localStorage.setItem('savedUsername', uName);
        setUsername(uName);
        setAuthMode('dashboard');
      }}
      onGuestSuccess={(rName, rToken, rAdmin, guestName) => {
        setUsername(guestName);
        setRoomName(rName);
        setToken(rToken);
        setIsAdmin(rAdmin);
        setAuthMode('room');
      }}
    />
  );
}