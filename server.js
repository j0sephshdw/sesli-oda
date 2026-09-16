import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
import path from 'path'; // EKLENDİ
import { fileURLToPath } from 'url'; // EKLENDİ

dotenv.config();

// EKLENDİ: ES Module ("type": "module") yapısında klasör yolunu bulmak için
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/token', async (req, res) => {
  try {
    const { roomName, participantName } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName ve participantName gereklidir.' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'LiveKit API anahtarları eksik.' });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      ttl: '1h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return res.json({ token });
  } catch (error) {
    console.error('Token üretme hatası:', error);
    return res.status(500).json({ error: 'Token oluşturulamadı.' });
  }
});

// EKLENDİ: Vite'ın derlediği (build) statik dosyaları sun
app.use(express.static(path.join(__dirname, 'dist')));

// EKLENDİ: Bilinmeyen tüm URL'leri React'e (index.html) yönlendir
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} üzerinde aktif.`);
});