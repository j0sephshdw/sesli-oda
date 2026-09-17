import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { AccessToken } from 'livekit-server-sdk';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 1. Firebase Admin Başlatma
let firebaseApp;
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
  
  firebaseApp = initializeApp({
    credential: cert(serviceAccount)
  });
  console.log("Firebase Admin başarıyla başlatıldı.");
} catch (error) {
  console.error("KRİTİK HATA: Firebase bağlantısı kurulamadı!", error.message);
  process.exit(1);
}

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const app = express();

app.use(cors());
app.use(express.json());

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

// 2. E-Posta Gönderici (Nodemailer Transporter)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ==========================================
// API ROUTE'LARI
// ==========================================

// 🟢 KAYIT (REGISTER)
app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) return res.status(400).json({ error: 'E-posta, kullanıcı adı ve şifre zorunludur.' });

  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Kullanıcı adı 3 ile 20 karakter arasında olmalıdır.' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });

  try {
    const usernameCheck = await db.collection('users').where('username', '==', username).get();
    if (!usernameCheck.empty) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda.' });

    // Firebase'de Kullanıcı Oluşturma
    const userRecord = await auth.createUser({ email, password, displayName: username });
    
    // 6 Haneli Rastgele Doğrulama Kodu Üretme
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Veritabanına isVerified: false olarak kaydetme
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      username,
      isVerified: false,
      verificationCode: verificationCode,
      createdAt: FieldValue.serverTimestamp(),
      rooms: []
    });

    // 🔴 KRİTİK GÜNCELLEME: Profesyonel HTML Şablonu ve SMTP Hata Yakalama (Rollback)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail({
          from: `"Sesli Oda Ekibi" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Sesli Oda - E-posta Doğrulama Kodu',
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; background-color: #1e1f22; color: #f2f3f5; border-radius: 12px; border: 1px solid #313338;">
              <h2 style="color: #5865F2; text-align: center; margin-bottom: 20px;">Aramıza Hoş Geldin, ${username}!</h2>
              <p style="font-size: 15px; line-height: 1.6;">Sesli Oda hesabını doğrulamak ve kesintisiz sohbete başlamak için aşağıdaki 6 haneli güvenlik kodunu kullanabilirsin:</p>
              
              <div style="background-color: #2b2d31; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; border-radius: 8px; margin: 30px 0; color: #ffffff; border: 1px solid #3f4147;">
                ${verificationCode}
              </div>
              
              <p style="font-size: 13px; color: #949ba4; text-align: center; border-top: 1px solid #313338; padding-top: 20px; margin-top: 30px;">
                Eğer bu kayıt işlemini sen başlatmadıysan, bu e-postayı güvenle görmezden gelebilirsin.
              </p>
            </div>
          `
        });
        console.log(`[BAŞARILI] ${email} adresine doğrulama maili gönderildi.`);
      } catch (mailError) {
        console.error("[NODEMAILER HATASI]: E-posta gönderilemedi -", mailError.message);
        
        // İşlem İptali (Rollback): Eğer mail gitmezse hesabı ve veritabanı kaydını sil ki kullanıcı takılı kalmasın.
        await auth.deleteUser(userRecord.uid);
        await db.collection('users').doc(userRecord.uid).delete();
        
        return res.status(500).json({ error: 'Mail sunucusuna bağlanılamadı. Uygulama şifrenizi (App Password) kontrol edin.' });
      }
    } else {
      console.warn(`[UYARI] EMAIL_USER veya EMAIL_PASS eksik! Çevrimdışı Test modunda çalışıyor.`);
      console.log(`[TEST MODU] ${email} için doğrulama kodu: ${verificationCode}`);
    }

    res.json({ success: true, message: 'Kayıt başarılı! Lütfen e-postanıza gelen doğrulama kodunu girin.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🟠 E-POSTA DOĞRULAMA (VERIFY-EMAIL)
app.post('/api/verify-email', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'E-posta ve doğrulama kodu zorunludur.' });

  try {
    const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (userSnap.empty) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    if (userData.isVerified) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten doğrulanmış.' });
    }

    if (userData.verificationCode !== code) {
      return res.status(400).json({ error: 'Geçersiz doğrulama kodu!' });
    }

    await userDoc.ref.update({
      isVerified: true,
      verificationCode: FieldValue.delete()
    });

    res.json({ success: true, message: 'E-posta başarıyla doğrulandı! Şimdi giriş yapabilirsiniz.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔵 GİRİŞ YAPMA (LOGIN)
app.post('/api/login', async (req, res) => {
  const { username: identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Bilgiler eksik.' });

  try {
    let email = identifier;
    let username = identifier;
    let userDocData = null;

    if (!identifier.includes('@')) {
      const userSnap = await db.collection('users').where('username', '==', identifier).limit(1).get();
      if (userSnap.empty) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      userDocData = userSnap.docs[0].data();
      email = userDocData.email;
      username = userDocData.username;
    } else {
       const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
       if (!userSnap.empty) {
         userDocData = userSnap.docs[0].data();
         username = userDocData.username;
       }
    }

    if (userDocData && userDocData.isVerified === false) {
      return res.status(403).json({ error: 'Lütfen önce e-posta adresinizi doğrulayın.' });
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

// 🔴 HESAP SİLME (DELETE ACCOUNT)
app.delete('/api/delete-account', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Kullanıcı adı zorunludur.' });

  try {
    const userSnap = await db.collection('users').where('username', '==', username).limit(1).get();
    if (userSnap.empty) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    if (userData.uid) {
      try {
        await auth.deleteUser(userData.uid);
      } catch (authError) {
        console.error("Auth'dan kullanıcı silinirken hata:", authError.message);
      }
    }

    await userDoc.ref.delete();
    res.json({ success: true, message: 'Hesap başarıyla silindi.' });
  } catch (err) {
    console.error("Hesap silme işlemi başarısız:", err);
    res.status(500).json({ error: 'Hesap silinirken sunucu kaynaklı bir hata oluştu.' });
  }
});

// ==========================================
// LIVEKIT VE ODA ROUTE'LARI
// ==========================================

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
      await roomRef.set({ name: roomName, creator: participantName, password: password || '', createdAt: FieldValue.serverTimestamp() });
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

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint bulunamadı.' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda çalışıyor. (Full-Stack Mod)`));