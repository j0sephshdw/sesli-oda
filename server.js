import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 1. Firebase Admin Başlatma (Render Secret Files & Lokal Uyumlu)
try {
  const renderSecretPath = '/etc/secrets/serviceAccountKey.json';
  const localSecretPath = path.join(__dirname, 'serviceAccountKey.json');
  let serviceAccount;

  if (existsSync(renderSecretPath)) {
    console.log("Render: Secret File dizininden okunuyor...");
    serviceAccount = JSON.parse(readFileSync(renderSecretPath, 'utf8'));
  } else if (existsSync(localSecretPath)) {
    console.log("Lokal: Çalışma dizininden okunuyor...");
    serviceAccount = JSON.parse(readFileSync(localSecretPath, 'utf8'));
  } else {
    throw new Error("serviceAccountKey.json dosyası hiçbir konumda bulunamadı!");
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase Admin başarıyla başlatıldı.");
} catch (error) {
  console.error("KRİTİK HATA: Firebase bağlantısı kurulamadı!", error.message);
  process.exit(1); // Sunucuyu anında durdurur, zincirleme çökmeleri engeller
}

const auth = admin.auth();
const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

// ==========================================
// API ROUTE'LARI
// ==========================================

app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) return res.status(400).json({ error: 'E-posta, kullanıcı adı ve şifre zorunludur.' });

  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Kullanıcı adı 3 ile 20 karakter arasında olmalıdır.' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });

  try {
    const usernameCheck = await db.collection('users').where('username', '==', username).get();
    if (!usernameCheck.empty) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda.' });

    const userRecord = await auth.createUser({ email, password, displayName: username });
    
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

app.post('/api/login', async (req, res) => {
  const { username: identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Bilgiler eksik.' });

  try {
    let email = identifier;
    let username = identifier;

    if (!identifier.includes('@')) {
      const userSnap = await db.collection('users').where('username', '==', identifier).limit(1).get();
      if (userSnap.empty) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      email = userSnap.docs[0].data().email;
      username = userSnap.docs[0].data().username;
    } else {
       const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
       if(!userSnap.empty) username = userSnap.docs[0].data().username;
    }

    if (!FIREBASE_WEB_API_KEY) return res.status(500).json({ error: 'Sunucu yapılandırma hatası (API Key Eksik).' });

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    if (!verifyRes.ok) return res.status(401).json({ error: 'Hatalı şifre veya e-posta!' });

    res.json({ success: true, username: username });
  } catch (err) {
    res.status(500).json({ error: 'Giriş işlemi başarısız.' });
  }
});

app.get('/api/rooms/:username', async (req, res) => {
  try {
    const snap = await db.collection('users').where('username', '==', req.params.username).limit(1).get();
    if (snap.empty) return res.json({ rooms: [] });
    res.json({ rooms: snap.docs[0].data().rooms || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/token', async (req, res) => {
  const { roomName, participantName, password, isGuest } = req.body;
  if (!roomName || !participantName) return res.status(400).json({ error: 'Oda ve kullanıcı adı zorunlu.' });

  try {
    const roomRef = db.collection('rooms').doc(roomName);
    const roomSnap = await roomRef.get();
    let isAdmin = false;

    if (!roomSnap.exists) {
      await roomRef.set({ name: roomName, creator: participantName, password: password || '', createdAt: admin.firestore.FieldValue.serverTimestamp() });
      isAdmin = true;
    } else {
      const roomData = roomSnap.data();
      if (roomData.password && roomData.password !== password) return res.status(403).json({ error: 'Yanlış oda şifresi!' });
      if (roomData.creator === participantName) isAdmin = true;
    }

    if (!isGuest) {
      const userSnap = await db.collection('users').where('username', '==', participantName).limit(1).get();
      if (!userSnap.empty) {
        let rooms = userSnap.docs[0].data().rooms || [];
        if (!rooms.includes(roomName)) {
           rooms.push(roomName);
           if (rooms.length > 10) rooms.shift();
           await userSnap.docs[0].ref.update({ rooms });
        }
      }
    }

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

app.get('/api/chat/:roomName', async (req, res) => {
  try {
    const snapshot = await db.collection('rooms').doc(req.params.roomName)
                             .collection('messages')
                             .orderBy('timestamp', 'desc')
                             .limit(50)
                             .get();
    const messages = snapshot.docs.map(doc => doc.data()).reverse();
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  let { roomName, sender, message, timestamp } = req.body;
  if (!message || message.trim() === '') return res.status(400).json({ error: 'Boş mesaj gönderilemez.' });
  
  if (message.length > 500) message = message.substring(0, 500) + '...';

  try {
    await db.collection('rooms').doc(roomName).collection('messages').add({ sender, message, timestamp });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// REACT FRONTEND SUNUCUSU
// ==========================================

// Vite tarafından derlenen 'dist' klasörünü statik olarak sunar
app.use(express.static(path.join(__dirname, 'dist')));

// Kalan tüm istekleri (React Router) index.html'e yönlendirir
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint bulunamadı.' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda çalışıyor. (Full-Stack Mod)`));