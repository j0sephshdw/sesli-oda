import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@livekit/components-react';

const renderMessageText = (text = '', myDisplayName = '') => {
  if (!text) return null;
  const safeName = (myDisplayName || '').toLowerCase();
  const parts = text.split(/(https?:\/\/[^\s]+|\*\*.*?\*\*|__.*?__|~~.*?~~|@[^\s]+)/g);

  return parts.map((part, i) => {
    if (!part) return null;
    if (part.match(/^https?:\/\/[^\s]+$/)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link">{part}</a>;
    } else if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    } else if (part.startsWith('__') && part.endsWith('__')) {
      return <u key={i}>{part.slice(2, -2)}</u>;
    } else if (part.startsWith('~~') && part.endsWith('~~')) {
      return <del key={i}>{part.slice(2, -2)}</del>;
    } else if (safeName && part.toLowerCase() === `@${safeName}`) {
      return <span key={i} className="mention-badge">{part}</span>;
    } else if (part.startsWith('@')) {
      return <span key={i} className="mention-other">{part}</span>;
    }
    return part;
  });
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

export default function RoomChat({ roomName, myDisplayName = '', dbMessages = [], activeTypers = [], room }) {
  const { send, chatMessages } = useChat();
  const [msg, setMsg] = useState('');
  const chatEndRef = useRef(null);
  const containerRef = useRef(null);
  const lastTypingTimeRef = useRef(0);

  const scrollToBottom = (behavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      scrollToBottom('smooth');
    }
  }, [chatMessages, dbMessages]);

  const handleSendMessage = (e) => {
    e?.preventDefault();
    const trimmed = msg.trim();
    if (!trimmed) return;

    send(trimmed);
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, sender: myDisplayName, message: trimmed, timestamp: Date.now() })
    }).catch(err => console.error("Mesaj kaydedilemedi:", err));

    setMsg('');
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  const handleInputChange = (e) => {
    setMsg(e.target.value);
    const now = Date.now();
    if (room?.localParticipant && now - lastTypingTimeRef.current > 2000) {
      lastTypingTimeRef.current = now;
      const data = JSON.stringify({ type: 'TYPING', name: myDisplayName });
      room.localParticipant.publishData(new TextEncoder().encode(data), { reliable: false });
    }
  };

  return (
    <div className="custom-chat-panel">
      <div className="chat-header">💬 Sohbet</div>
      <div className="chat-messages" ref={containerRef}>
        <div className="chat-sys-msg">Oda geçmişi ve canlı mesajlar.</div>

        {dbMessages.map((m, idx) => {
          const safeName = (myDisplayName || '').toLowerCase();
          const isMentioned = safeName && m.message?.toLowerCase().includes(`@${safeName}`);
          return (
            <div key={m.id || `db-${m.timestamp}-${idx}`} className={`chat-msg ${isMentioned ? 'mentioned-msg' : ''}`}>
              <div className="chat-msg-header">
                <span className="chat-sender">{m.sender || 'Anonim'}</span>
                <span className="chat-time">{formatTime(m.timestamp)}</span>
              </div>
              <div className="chat-text">{renderMessageText(m.message, myDisplayName)}</div>
            </div>
          );
        })}

        {chatMessages.map((m) => {
          const safeName = (myDisplayName || '').toLowerCase();
          const isMentioned = safeName && m.message?.toLowerCase().includes(`@${safeName}`);
          return (
            <div key={m.id || `live-${m.timestamp}`} className={`chat-msg ${isMentioned ? 'mentioned-msg' : ''}`}>
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

      <form className="chat-input-area" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={msg}
          onChange={handleInputChange}
          placeholder="Mesaj... (@isim, **kalın**, __alt__)"
        />
        <button type="submit" disabled={!msg.trim()}>Gönder</button>
      </form>
    </div>
  );
}