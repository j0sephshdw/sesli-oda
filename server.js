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
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY; // YENİ: Şifre doğrulama için eklendi

// 2. KAYIT OL (Auth + Firestore)
app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'E-posta, kullanıcı adı ve şifre zorunludur.' });
  }

  // Güvenlik: Kullanıcı adı formatı ve uzunluğu
  if (username.length < 3 || username.length > 20) {
     return res.status(400).json({ error: 'Kullanıcı adı 3 ile 20 karakter arasında olmalıdır.' });
  }
  if (password.length < 6) {
     return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
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

// 3. GİRİŞ YAP (Şifre Açığı Kapatıldı)
app.post('/api/login', async (req, res) => {
  const { username: identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Bilgiler eksik.' });

  try {
    let email = identifier;
    let username = identifier;

    // Kullanıcı adı girildiyse e-postayı Firestore'dan bul
    if (!identifier.includes('@')) {
      const userSnap = await db.collection('users').where('username', '==', identifier).limit(1).get();
      if (userSnap.empty) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      email = userSnap.docs[0].data().email;
      username = userSnap.docs[0].data().username;
    } else {
       // Email girildiyse username'i bul (Dashboard'da göstermek için)
       const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
       if(!userSnap.empty) username = userSnap.docs[0].data().username;
    }

    // YENİ: Firebase REST API ile Şifre Doğrulaması
    if (!FIREBASE_WEB_API_KEY) {
       console.error("KRİTİK: FIREBASE_WEB_API_KEY eksik!");
       return res.status(500).json({ error: 'Sunucu yapılandırma hatası.' });
    }

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'Hatalı şifre veya e-posta!' });
    }

    res.json({ success: true, username: username });
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
        // En fazla 10 odayı sakla (Optimizasyon)
        let rooms = userSnap.docs[0].data().rooms || [];
        if (!rooms.includes(roomName)) {
           rooms.push(roomName);
           if (rooms.length > 10) rooms.shift(); // En eskisini sil
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

// 6. SOHBET GEÇMİŞİNİ GETİR (AudioRoom.jsx için)
app.get('/api/chat/:roomName', async (req, res) => {
  try {
    const snapshot = await db.collection('rooms').doc(req.params.roomName)
                             .collection('messages')
                             .orderBy('timestamp', 'desc') // YENİ: Performans için ters alıp limitliyoruz
                             .limit(50)
                             .get();
    
    // Gelenleri tekrar eskiden yeniye sırala
    const messages = snapshot.docs.map(doc => doc.data()).reverse();
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. YENİ MESAJI KAYDET (AudioRoom.jsx için)
app.post('/api/chat', async (req, res) => {
  let { roomName, sender, message, timestamp } = req.body;
  if (!message || message.trim() === '') return res.status(400).json({ error: 'Boş mesaj gönderilemez.' });
  
  // YENİ: Mesaj uzunluk sınırı
  if (message.length > 500) {
      message = message.substring(0, 500) + '...';
  }

  try {
    await db.collection('rooms').doc(roomName).collection('messages').add({ sender, message, timestamp });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda çalışıyor ve Firebase tam entegre.`));