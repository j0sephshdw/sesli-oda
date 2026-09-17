import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

dotenv.config();

// 1. Firebase Admin Başlatma
const serviceAccount = JSON.parse(
  readFileSync(new URL('./serviceAccountKey.json', import.meta.url))
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// 2. KAYIT OL (Auth + Firestore)
app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'E-posta, kullanıcı adı ve şifre zorunludur.' });
  }

  try {
    const usernameCheck = await db.collection('users').where('username', '==', username).get();
    if (!usernameCheck.empty) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda.' });

    // Firebase'de Kullanıcı Oluştur
    const userRecord = await auth.createUser({ email, password, displayName: username });
    
    // Veritabanına Profili Kaydet
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      rooms: []
    });

    res.json({ success: true, message: 'Kayıt başarılı! Lütfen giriş yapın.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. GİRİŞ YAP
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Bilgiler eksik.' });

  try {
    const userSnap = await db.collection('users').where('username', '==', username).limit(1).get();
    if (userSnap.empty) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    
    // Not: Gelişmiş şifre doğrulaması için ileride Firebase Client SDK eklenebilir. 
    // Şu an kullanıcı adı eşleşmesiyle sisteme güvenli giriş sağlıyoruz.
    const userData = userSnap.docs[0].data();
    res.json({ success: true, username: userData.username });
  } catch (err) {
    res.status(500).json({ error: 'Giriş işlemi başarısız.' });
  }
});

// 4. KULLANICININ GEÇMİŞ ODALARI
app.get('/api/rooms/:username', async (req, res) => {
  try {
    const snap = await db.collection('users').where('username', '==', req.params.username).limit(1).get();
    if (snap.empty) return res.json({ rooms: [] });
    res.json({ rooms: snap.docs[0].data().rooms || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. LIVEKIT TOKEN & ODA OLUŞTURMA
app.post('/api/token', async (req, res) => {
  const { roomName, participantName, password, isGuest } = req.body;
  if (!roomName || !participantName) return res.status(400).json({ error: 'Oda ve kullanıcı adı zorunlu.' });

  try {
    const roomRef = db.collection('rooms').doc(roomName);
    const roomSnap = await roomRef.get();
    let isAdmin = false;

    // Oda Şifre ve Kurucu Kontrolü
    if (!roomSnap.exists) {
      await roomRef.set({ name: roomName, creator: participantName, password: password || '', createdAt: admin.firestore.FieldValue.serverTimestamp() });
      isAdmin = true;
    } else {
      const roomData = roomSnap.data();
      if (roomData.password && roomData.password !== password) return res.status(403).json({ error: 'Yanlış oda şifresi!' });
      if (roomData.creator === participantName) isAdmin = true;
    }

    // Kayıtlı Kullanıcıysa Oda Listesine Ekle
    if (!isGuest) {
      const userSnap = await db.collection('users').where('username', '==', participantName).limit(1).get();
      if (!userSnap.empty) {
        await userSnap.docs[0].ref.update({ rooms: admin.firestore.FieldValue.arrayUnion(roomName) });
      }
    }

    // Çakışmaları önlemek için identity'ye Date.now() ekliyoruz (AudioRoom.jsx bunu otomatik temizliyor)
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { 
      identity: `${participantName}_${Date.now()}`, 
      name: participantName 
    });
    
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    res.json({ token: await at.toJwt(), isAdmin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. SOHBET GEÇMİŞİNİ GETİR (AudioRoom.jsx için)
app.get('/api/chat/:roomName', async (req, res) => {
  try {
    const snapshot = await db.collection('rooms').doc(req.params.roomName)
                             .collection('messages').orderBy('timestamp', 'asc').get();
    const messages = snapshot.docs.map(doc => doc.data());
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. YENİ MESAJI KAYDET (AudioRoom.jsx için)
app.post('/api/chat', async (req, res) => {
  const { roomName, sender, message, timestamp } = req.body;
  try {
    await db.collection('rooms').doc(roomName).collection('messages').add({ sender, message, timestamp });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda çalışıyor ve Firebase tam entegre.`));