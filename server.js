import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => res.status(200).send('Sunucu Ayakta!'));

// --- BELLEK TABANLI VERİTABANI (Memory DB) ---
const usersDB = new Map(); // username -> password
const userRoomsDB = new Map(); // username -> [room1, room2]
const roomPasswords = new Map(); // roomName -> password
const chatHistoryDB = new Map(); // roomName -> [ { sender, message, timestamp } ]

// 1. KAYIT OL API
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const safeUser = username.trim().toLowerCase();
  
  if (usersDB.has(safeUser)) {
    return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış!' });
  }
  
  usersDB.set(safeUser, password);
  userRoomsDB.set(safeUser, new Set());
  res.json({ success: true, message: 'Kayıt başarılı! Giriş yapabilirsiniz.' });
});

// 2. GİRİŞ YAP API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const safeUser = username.trim().toLowerCase();

  if (!usersDB.has(safeUser) || usersDB.get(safeUser) !== password) {
    return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre!' });
  }
  
  res.json({ success: true, username: safeUser });
});

// 3. KULLANICININ ESKİ ODALARINI GETİR
app.get('/api/rooms/:username', (req, res) => {
  const { username } = req.params;
  const rooms = userRoomsDB.has(username) ? Array.from(userRoomsDB.get(username)) : [];
  res.json({ rooms });
});

// 4. SOHBET GEÇMİŞİNİ KAYDET VE GETİR
app.post('/api/chat', (req, res) => {
  const { roomName, sender, message, timestamp } = req.body;
  const safeRoom = roomName.trim().toLowerCase();
  
  if (!chatHistoryDB.has(safeRoom)) chatHistoryDB.set(safeRoom, []);
  chatHistoryDB.get(safeRoom).push({ sender, message, timestamp });
  
  res.json({ success: true });
});

app.get('/api/chat/:roomName', (req, res) => {
  const safeRoom = req.params.roomName.trim().toLowerCase();
  const messages = chatHistoryDB.get(safeRoom) || [];
  res.json({ messages });
});

// 5. LIVEKIT TOKEN VE ODAYA GİRİŞ (Güvenlik + Odayı Kaydetme)
app.post('/api/token', async (req, res) => {
  try {
    const { roomName, participantName, password, isGuest } = req.body;

    if (!roomName || !participantName) return res.status(400).json({ error: 'Eksik bilgi!' });

    const safeRoomName = roomName.trim().toLowerCase();
    const safeParticipantName = participantName.trim();
    const safePassword = password ? password.trim() : '';

    let isAdmin = false;
    
    // Oda Şifre Kontrolü
    if (!roomPasswords.has(safeRoomName)) {
      roomPasswords.set(safeRoomName, safePassword);
      isAdmin = true;
    } else {
      const existingPassword = roomPasswords.get(safeRoomName);
      if (existingPassword !== '' && existingPassword !== safePassword) {
        return res.status(403).json({ error: 'Bu oda şifreli! Yanlış şifre.' });
      }
    }

    // Kullanıcı giriş yapmışsa odayı geçmişine kaydet
    if (!isGuest) {
      const safeUser = safeParticipantName.toLowerCase();
      if (!userRoomsDB.has(safeUser)) userRoomsDB.set(safeUser, new Set());
      userRoomsDB.get(safeUser).add(safeRoomName);
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: safeParticipantName + '_' + Date.now(), 
      name: safeParticipantName,
      ttl: '12h',
    });

    at.addGrant({ roomJoin: true, room: safeRoomName, canPublish: true, canSubscribe: true, roomAdmin: isAdmin });

    const token = await at.toJwt();
    return res.json({ token, isAdmin });
  } catch (error) {
    return res.status(500).json({ error: 'Bilet oluşturulamadı.' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT}`));