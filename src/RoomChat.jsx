import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@livekit/components-react';

const renderMessageText = (text = '', myDisplayName = '') => {
  if (!text) return null;
  const safeName = (myDisplayName || '').toLowerCase();
  
  const codeBlockParts = text.split(/(```[\s\S]*?```)/g);
  
  return codeBlockParts.map((block, blockIndex) => {
    if (block.startsWith('```') && block.endsWith('```')) {
       const codeContent = block.substring(3, block.length - 3).trim();
       const firstLineBreak = codeContent.indexOf('\n');
       let lang = 'KOD'; let code = codeContent;
       if (firstLineBreak > -1 && firstLineBreak < 20) {
          lang = codeContent.substring(0, firstLineBreak).trim().toUpperCase();
          code = codeContent.substring(firstLineBreak + 1);
       }
       return (
         <div key={`code-${blockIndex}`} className="code-block-wrapper">
           <div className="code-header">
             <span className="code-lang">{lang || 'KOD'}</span>
             <button className="code-copy-btn" onClick={() => navigator.clipboard.writeText(code)}>Kopyala</button>
           </div>
           <pre className="code-pre"><code>{code}</code></pre>
         </div>
       );
    }

    const lines = block.split('\n');
    return lines.map((line, lineIndex) => {
      const isQuote = line.startsWith('> ');
      const content = isQuote ? line.substring(2) : line;

      const parts = content.split(/(https?:\/\/[^\s]+|\*\*.*?\*\*|__.*?__|~~.*?~~|\|\|.*?\|\||@[^\s]+)/g);
      
      const renderedLine = parts.map((part, i) => {
        if (!part) return null;
        
        // Zengin Medya ve Resimler
        if (part.match(/^https?:\/\/[^\s]+(\.(jpg|jpeg|png|gif|webp))(\?.*)?$/i)) return <img key={i} src={part} alt="görsel" className="chat-image-preview" onClick={() => window.open(part, '_blank')} title="Tam boyutta aç"/>;
        if (part.match(/^https?:\/\/[^\s]+$/)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link">{part}</a>;
        
        // Zengin Metin Formatları
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('__') && part.endsWith('__')) return <u key={i}>{part.slice(2, -2)}</u>;
        if (part.startsWith('~~') && part.endsWith('~~')) return <del key={i}>{part.slice(2, -2)}</del>;
        
        // YENİ: Spoiler Sistemi
        if (part.startsWith('||') && part.endsWith('||')) return <span key={i} className="spoiler-text" onClick={(e) => e.target.classList.add('revealed')} title="Görmek için tıkla">{part.slice(2, -2)}</span>;
        
        if (safeName && part.toLowerCase() === `@${safeName}`) return <span key={i} className="mention-badge">{part}</span>;
        if (part.startsWith('@')) return <span key={i} className="mention-other">{part}</span>;
        return part;
      });

      if (isQuote) return <blockquote key={`${blockIndex}-${lineIndex}`} className="chat-quote">{renderedLine}</blockquote>;
      return <React.Fragment key={`${blockIndex}-${lineIndex}`}>{renderedLine}{lineIndex !== lines.length - 1 && <br />}</React.Fragment>;
    });
  });
};

const formatSmartTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp); const now = new Date();
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
  const [replyTo, setReplyTo] = useState(null); 
  const [missedCount, setMissedCount] = useState(0);
  
  const chatEndRef = useRef(null);
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const lastTypingTimeRef = useRef(0);

  const scrollToBottom = (behavior = 'smooth') => { 
    chatEndRef.current?.scrollIntoView({ behavior }); 
    setMissedCount(0);
  };

  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      scrollToBottom('smooth');
    } else {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg && lastMsg.from?.identity !== room?.localParticipant?.identity) setMissedCount(p => p + 1);
    }
  }, [chatMessages, dbMessages]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 50) setMissedCount(0);
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    let trimmed = msg.trim(); if (!trimmed) return;

    // EĞLENCELİ KOMUTLAR (CHAT OYUNLARI)
    if (trimmed.startsWith('/')) {
      const command = trimmed.toLowerCase();
      if (command.startsWith('/roll')) { 
          const roll = Math.floor(Math.random() * 100) + 1; 
          trimmed = `🎲 Zarları yuvarladı ve **${roll}** attı!`; 
      }
      else if (command.startsWith('/flip')) { 
          const flip = Math.random() > 0.5 ? 'Yazı' : 'Tura'; 
          trimmed = `🪙 Yazı tura attı: **${flip}**!`; 
      }
      else if (command.startsWith('/shrug')) { trimmed = trimmed.replace('/shrug', '¯\\_(ツ)_/¯'); }
      else if (command.startsWith('/cat')) { trimmed = `🐈 Eğlence Saati!\n[https://cataas.com/cat?t=$](https://cataas.com/cat?t=$){Date.now()}.png`; }
      else if (command.startsWith('/dog')) { trimmed = `🐕 Hav!\n[https://dog.ceo/api/breeds/image/random](https://dog.ceo/api/breeds/image/random)`; }
    }

    let finalMessage = trimmed;
    if (replyTo) {
      const snippet = replyTo.message.replace(/\n/g, ' ').substring(0, 50);
      finalMessage = `> **@${replyTo.sender}**: ${snippet}${replyTo.message.length > 50 ? '...' : ''}\n${trimmed}`;
    }

    send(finalMessage);
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, sender: myDisplayName, message: finalMessage, timestamp: Date.now() })
    }).catch(err => console.error("Mesaj kaydedilemedi:", err));

    setMsg(''); setReplyTo(null);
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

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };
  const handleCopyMessage = (text, id) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); };

  return (
    <div className="custom-chat-panel" style={{ position: 'relative' }}>
      <div className="chat-header">💬 Oda Sohbeti</div>
      
      <div className="chat-messages" ref={containerRef} onScroll={handleScroll}>
        <div className="chat-sys-msg" style={{marginBottom: '15px'}}>Mesaj geçmişi yüklendi. Sürprizler için /roll veya /cat yazın!</div>

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

      {missedCount > 0 && (
        <div className="new-messages-pill" onClick={() => scrollToBottom('smooth')}>
          ⬇️ {missedCount} Yeni Mesaj
        </div>
      )}

      {activeTypers.length > 0 && (
        <div className="typing-indicator-rich">
          {activeTypers.map(t => (
            <div key={t} className="typing-avatar" title={t}>
              {t.charAt(0).toUpperCase()}
            </div>
          ))}
          <div className="typing-dots"><span>.</span><span>.</span><span>.</span></div>
        </div>
      )}

      <div className="chat-input-wrapper">
        {replyTo && (
          <div className="reply-banner">
            <span className="reply-text"><span>Yanıtlanıyor:</span> @{replyTo.sender}</span>
            <button className="cancel-reply" onClick={() => setReplyTo(null)}>✖</button>
          </div>
        )}
        
        <form className="chat-input-area" onSubmit={handleSendMessage} style={{ alignItems: 'flex-end', borderTop: replyTo ? 'none' : '1px solid #1e1f22' }}>
          <textarea ref={textareaRef} value={msg} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Mesaj... ( ||gizli|| veya /roll )" rows={1}
            style={{ flex: 1, padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#1e1f22', color: 'white', outline: 'none', resize: 'none', overflowY: 'auto', fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.4', minHeight: '44px', maxHeight: '120px', transition: 'border 0.2s' }}
          />
          <button type="submit" disabled={!msg.trim()} style={{ height: '44px' }}>Gönder</button>
        </form>
      </div>
    </div>
  );
}