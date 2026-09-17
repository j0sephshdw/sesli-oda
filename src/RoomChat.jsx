import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@livekit/components-react';

const renderMessageText = (text, myDisplayName) => {
  const parts = text.split(/(https?:\/\/[^\s]+|\*\*.*?\*\*|__.*?__|~~.*?~~|@[^\s]+)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.match(/https?:\/\/[^\s]+/)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link">{part}</a>;
    } else if (part.match(/\*\*(.*?)\*\*/)) {
      return <strong key={i}>{part.replace(/\*\*/g, '')}</strong>;
    } else if (part.match(/__(.*?)__/)) {
      return <u key={i}>{part.replace(/__/g, '')}</u>;
    } else if (part.match(/~~(.*?)~~/)) {
      return <del key={i}>{part.replace(/~~/g, '')}</del>;
    } else if (part.toLowerCase() === `@${myDisplayName.toLowerCase()}`) {
      return <span key={i} className="mention-badge">{part}</span>;
    } else if (part.startsWith('@')) {
      return <span key={i} className="mention-other">{part}</span>;
    }
    return part;
  });
};

const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export default function RoomChat({ roomName, myDisplayName, dbMessages, activeTypers, room }) {
  const { send, chatMessages } = useChat();
  const [msg, setMsg] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, dbMessages]);

  const handleSendMessage = () => {
    if (msg.trim()) {
      send(msg);
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, sender: myDisplayName, message: msg, timestamp: Date.now() })
      }).catch(err => console.error("Mesaj kaydedilemedi:", err));
      setMsg('');
    }
  };

  const handleTyping = (e) => {
    setMsg(e.target.value);
    if (room?.localParticipant) {
      const data = JSON.stringify({ type: 'TYPING', name: myDisplayName });
      room.localParticipant.publishData(new TextEncoder().encode(data), { reliable: false });
    }
  };

  return (
    <div className="custom-chat-panel">
      <div className="chat-header">💬 Sohbet</div>
      <div className="chat-messages">
        <div className="chat-sys-msg">Oda geçmişi ve canlı mesajlar.</div>
        
        {dbMessages.map((m, idx) => {
           const isMentioned = m.message.toLowerCase().includes(`@${myDisplayName.toLowerCase()}`);
           return (
             <div key={`db-${idx}`} className={`chat-msg ${isMentioned ? 'mentioned-msg' : ''}`}>
               <div className="chat-msg-header">
                 <span className="chat-sender">{m.sender}</span>
                 <span className="chat-time">{formatTime(m.timestamp)}</span>
               </div>
               <div className="chat-text">{renderMessageText(m.message, myDisplayName)}</div>
             </div>
           )
        })}

        {chatMessages.map(m => {
          const isMentioned = m.message.toLowerCase().includes(`@${myDisplayName.toLowerCase()}`);
          return (
            <div key={m.id} className={`chat-msg ${isMentioned ? 'mentioned-msg' : ''}`}>
              <div className="chat-msg-header">
                <span className="chat-sender">{(m.from?.name || m.from?.identity || 'Anonim').split('_')[0]}</span>
                <span className="chat-time">{formatTime(m.timestamp)}</span>
              </div>
              <div className="chat-text">{renderMessageText(m.message, myDisplayName)}</div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      
      {activeTypers.length > 0 && (
        <div className="typing-indicator">
          <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
          {activeTypers.join(', ')} yazıyor
        </div>
      )}

      <div className="chat-input-area">
        <input 
          value={msg} 
          onChange={handleTyping} 
          onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
          placeholder="Mesaj... (@isim, **kalın**, __alt__)" 
        />
        <button onClick={handleSendMessage}>Gönder</button>
      </div>
    </div>
  );
}