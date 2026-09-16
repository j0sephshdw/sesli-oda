import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/get-token', async (req, res) => {
  const roomName = req.query.room || 'general';
  const participantName = req.query.username || `user-${Math.floor(Math.random() * 1000)}`;

  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return res.status(500).json({ error: 'LiveKit API anahtarları .env dosyasında bulunamadı.' });
  }

  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: participantName,
  });

  at.addGrant({ roomJoin: true, room: roomName });

  const token = await at.toJwt();
  res.json({ token });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express sunucusu http://localhost:${PORT} adresinde çalışıyor.`);
});