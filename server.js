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

// Token (Bilet) Üretme API'si
app.post('/api/token', async (req, res) => {
  try {
    const { roomName, participantName } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'Oda adı ve kullanıcı adı zorunludur.' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'LiveKit API anahtarları eksik! (.env dosyasını kontrol edin)' });
    }

    // Kullanıcıya bilet oluştur
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      ttl: '12h', // Bilet 12 saat geçerli
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
    return res.status(500).json({ error: 'Sunucu bileti oluşturamadı.' });
  }
});

// React dosyalarını (dist) sunucuda yayınla
app.use(express.static(path.join(__dirname, 'dist')));

// Kullanıcı hangi linke girerse girsin React'e yönlendir (Davet linkleri için şart)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} üzerinde çalışıyor.`);
});