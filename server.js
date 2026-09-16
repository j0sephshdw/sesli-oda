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

// Keep-Alive Ping
app.get('/ping', (req, res) => {
  res.status(200).send('Sunucu Ayakta!');
});

const roomPasswords = new Map();

app.post('/api/token', async (req, res) => {
  try {
    const { roomName, participantName, password } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'Oda adı ve kullanıcı adı zorunludur.' });
    }

    // GÜVENLİK FİXİ: Oda isimlerini küçük harfe çevirip boşlukları siliyoruz (Ghost Room engeli)
    const safeRoomName = roomName.trim().toLowerCase();
    const safePassword = password ? password.trim() : '';

    let isAdmin = false;
    
    // Oda hafızada yoksa, ilk gelen kişi odayı kurar ve Admin (Taç) olur
    if (!roomPasswords.has(safeRoomName)) {
      roomPasswords.set(safeRoomName, safePassword);
      isAdmin = true;
    } else {
      // Oda varsa şifreyi ÇOK KATI bir şekilde kontrol ediyoruz
      const existingPassword = roomPasswords.get(safeRoomName);
      if (existingPassword !== '' && existingPassword !== safePassword) {
        return res.status(403).json({ error: 'Bu oda şifreli! Yanlış şifre girdiniz veya şifresiz girmeye çalıştınız.' });
      }
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'LiveKit API anahtarları eksik!' });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName.trim() + '_' + Date.now(), // Aynı isimli kişilerin çakışmasını engeller
      name: participantName.trim(), // Gerçek ismi "name" özelliğinde taşıyoruz
      ttl: '12h',
    });

    at.addGrant({
      roomJoin: true,
      room: safeRoomName,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: isAdmin, 
    });

    const token = await at.toJwt();
    return res.json({ token, isAdmin });
  } catch (error) {
    console.error('Token üretme hatası:', error);
    return res.status(500).json({ error: 'Bilet oluşturulamadı.' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} üzerinde çalışıyor.`);
});