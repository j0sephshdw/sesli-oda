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

// 1. KEEP-ALIVE (Render ücretsiz paket uyku gecikmesini aşmak için)
// cron-job.org üzerinden "https://senin-siten.onrender.com/ping" adresine 10 dakikada bir istek atabilirsin.
app.get('/ping', (req, res) => {
  res.status(200).send('Sunucu Ayakta!');
});

// GÜVENLİK: Basit hafıza tabanlı oda şifresi yönetimi
const roomPasswords = new Map();

// Token Üretme API'si
app.post('/api/token', async (req, res) => {
  try {
    const { roomName, participantName, password } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'Oda adı ve kullanıcı adı zorunludur.' });
    }

    // GÜVENLİK: Şifre Kontrolü ve Admin Yetkisi (Data Channels & Attributes için)
    let isAdmin = false;
    if (!roomPasswords.has(roomName)) {
      // Odayı ilk kuran şifreyi belirler ve oda yöneticisi olur
      roomPasswords.set(roomName, password || '');
      isAdmin = true;
    } else {
      // Oda zaten kuruluysa girilen şifreyi kontrol et
      const existingPassword = roomPasswords.get(roomName);
      if (existingPassword && existingPassword !== password) {
        return res.status(403).json({ error: 'Hatalı oda şifresi girdiniz!' });
      }
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'LiveKit API anahtarları eksik!' });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      ttl: '12h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: isAdmin, // Oda sahibi yetkisi enjekte edildi
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