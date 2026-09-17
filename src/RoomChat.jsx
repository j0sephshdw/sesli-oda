import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@livekit/components-react';

// Linkleri, Markdown'ı ve GÖRSELLERİ Render Et
const renderMessageText = (text = '', myDisplayName = '') => {
  if (!text) return null;
  const safeName = (myDisplayName || '').toLowerCase();
  const lines = text.split('\n');
  
  return lines.map((line, lineIndex) => {
    // Alıntı (Reply) kontrolü (Markdown tarzı blockquote)
    const isQuote = line.startsWith('> ');
    const content = isQuote ? line.substring(2) : line;

    const parts = content.split(/(https?:\/\/[^\s]+|\*\*.*?\*\*|__.*?__|~~.*?~~|@[^\s]+)/g);
    const renderedLine = parts.map((part, i) => {
      if (!part) return null;
      
      // 🟡 YENİ: Otomatik Görsel Önizleme (Image Rendering)
      if (part.match(/^https?:\/\/[^\s]+(\.(jpg|jpeg|png|gif|webp))(\?.*)?$/i)) {
         return (
           <img 
             key={i} src={part} alt="görsel" className="chat-image-preview" 
             onClick={() => window.open(part, '_blank')} title="Tam boyutta aç"
           />
         );
      }
      // Normal Linkler
      if (part.match(/^https?:\/\/[^\s]+$/)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link">{part}</a>;
      
      // Markdown
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('__') && part.endsWith('__')) return <u key={i}>{part.slice(2, -2)}</u>;
      if (part.startsWith('~~') && part.endsWith('~~')) return <del key={i}>{part.slice(2, -2)}</del>;
      
      // Etiketleme
      if (safeName && part.toLowerCase() === `@${safeName}`) return <span key={i} className="mention-badge">{part}</span>;
      if (part.startsWith('@')) return <span key={i} className="mention-other">{part}</span>;
      
      return part;
    });

    if (isQuote) {
       return <blockquote key={lineIndex} className="chat-quote">{renderedLine}</blockquote>;
    }

    return (
      <React.Fragment key={lineIndex}>
        {renderedLine}
        {lineIndex !== lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

const formatSmartTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

  const timeString = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  
  if (isToday) return `Bugün ${timeString}`;
  if (isYesterday) return `Dün ${timeString}`;
  return `${date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${timeString}`;
};

export default function RoomChat({ roomName, myDisplayName = '', dbMessages = [], activeTypers = [], room }) {
  const { send, chatMessages } = useChat();
  const [msg, setMsg] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false); 
  
  // 🟡 YENİ: Yanıt Ver (Reply) State'i
  const [replyTo, setReplyTo] = useState(null); 
  
  const chatEndRef = useRef(null);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const lastTypingTimeRef = useRef(0);

  const scrollToBottom = (behavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) scrollToBottom('smooth');
  }, [chatMessages, dbMessages]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight > 150) setShowScrollBtn(true);
    else setShowScrollBtn(false);
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    const trimmed = msg.trim();
    if (!trimmed) return;

    let finalMessage = trimmed;
    // Eğer bir mesaja yanıt veriliyorsa, onu alıntı formatında (>) mesaja ekle
    if (replyTo) {
      const snippet = replyTo.message.replace(/\n/g, ' ').substring(0, 50);
      finalMessage = `> **@${replyTo.sender}**: ${snippet}${replyTo.message.length > 50 ? '...' : ''}\n${trimmed}`;
    }

    send(finalMessage);
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, sender: myDisplayName, message: finalMessage, timestamp: Date.now() })
    }).catch(err => console.error("Mesaj kaydedilemedi:", err));

    setMsg('');
    setReplyTo(null); // Mesaj gidince yanıt barını kapat
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  const handleInputChange = (e) => {
    setMsg(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    const now = Date.now();
    if (room?.localParticipant && now - lastTypingTimeRef.current > 2000) {
      lastTypingTimeRef.current = now;
      const data = JSON.stringify({ type: 'TYPING', name: myDisplayName });
      room.localParticipant.publishData(new TextEncoder().encode(data), { reliable: false });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500); 
  };

  return (
    <div className="custom-chat-panel" style={{ position: 'relative' }}>
      <div className="chat-header">💬 Sohbet</div>
      
      <div className="chat-messages" ref={containerRef} onScroll={handleScroll}>
        <div className="chat-sys-msg" style={{marginBottom: '15px'}}>Oda geçmişi ve canlı mesajlar.<br/><small>Metni kopyalamak için mesaja çift tıklayın.</small></div>

        {dbMessages.map((m, idx) => {
          const safeName = (myDisplayName || '').toLowerCase();
          const isMentioned = safeName && m.message?.toLowerCase().includes(`@${safeName}`);
          const msgId = m.id || `db-${m.timestamp}-${idx}`;
          const isCopied = copiedId === msgId;

          return (
            <div key={msgId} className={`chat-msg ${isMentioned ? 'mentioned-msg' : ''}`} onDoubleClick={() => handleCopyMessage(m.message, msgId)}>
              <div className="chat-msg-actions">
                 <button onClick={() => setReplyTo({ sender: m.sender || 'Anonim', message: m.message })} title="Yanıtla">↩️</button>
              </div>
              <div className="chat-msg-header">
                <span className="chat-sender">{m.sender || 'Anonim'}</span>
                <span className="chat-time">{formatSmartTime(m.timestamp)}</span>
              </div>
              <div className="chat-text">{renderMessageText(m.message, myDisplayName)}</div>
              {isCopied && <div className="copied-toast">Kopyalandı! ✓</div>}
            </div>
          );
        })}

        {chatMessages.map((m) => {
          const safeName = (myDisplayName || '').toLowerCase();
          const isMentioned = safeName && m.message?.toLowerCase().includes(`@${safeName}`);
          const msgId = m.id || `live-${m.timestamp}`;
          const isCopied = copiedId === msgId;
          const senderName = (m.from?.name || m.from?.identity || 'Anonim').split('_')[0];

          return (
            <div key={msgId} className={`chat-msg ${isMentioned ? 'mentioned-msg' : ''}`} onDoubleClick={() => handleCopyMessage(m.message, msgId)}>
              <div className="chat-msg-actions">
                 <button onClick={() => setReplyTo({ sender: senderName, message: m.message })} title="Yanıtla">↩️</button>
              </div>
              <div className="chat-msg-header">
                <span className="chat-sender">{senderName}</span>
                <span className="chat-time">{formatSmartTime(m.timestamp)}</span>
              </div>
              <div className="chat-text">{renderMessageText(m.message, myDisplayName)}</div>
              {isCopied && <div className="copied-toast">Kopyalandı! ✓</div>}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {showScrollBtn && (
        <button className="scroll-bottom-btn" onClick={() => scrollToBottom('smooth')} title="En Alta İn">⬇️</button>
      )}

      {activeTypers.length > 0 && (
        <div className="typing-indicator">
          <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>
          {activeTypers.join(', ')} yazıyor
        </div>
      )}

      <div className="chat-input-wrapper">
        {/* 🟡 YENİ: Yanıt Barı */}
        {replyTo && (
          <div className="reply-banner">
            <span className="reply-text"><span>Yanıtlanıyor:</span> @{replyTo.sender}</span>
            <button className="cancel-reply" onClick={() => setReplyTo(null)}>✖</button>
          </div>
        )}
        
        <form className="chat-input-area" onSubmit={handleSendMessage} style={{ alignItems: 'flex-end', borderTop: replyTo ? 'none' : '1px solid #1e1f22' }}>
          <textarea
            ref={textareaRef}
            value={msg}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Mesaj... (Alt satır için Shift+Enter)"
            rows={1}
            style={{
              flex: 1, padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#1e1f22', color: 'white',
              outline: 'none', resize: 'none', overflowY: 'auto', fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.4',
              minHeight: '44px', maxHeight: '120px', transition: 'border 0.2s'
            }}
          />
          <button type="submit" disabled={!msg.trim()} style={{ height: '44px' }}>Gönder</button>
        </form>
      </div>
    </div>
  );
}