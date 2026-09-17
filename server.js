import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

const translateFirebaseError = (errMessage) => {
  const msg = errMessage.toLowerCase();
  if (msg.includes('email-already-exists') || msg.includes('email_exists')) return 'Bu e-posta adresi ile zaten bir hesap mevcut.';
  if (msg.includes('invalid-email')) return 'Lütfen geçerli bir e-posta adresi girin.';
  if (msg.includes('weak-password')) return 'Şifreniz çok zayıf. Lütfen daha güçlü bir şifre belirleyin.';
  if (msg.includes('user-not-found') || msg.includes('email_not_found')) return 'Bu bilgilere ait bir hesap bulunamadı.';
  if (msg.includes('invalid-password') || msg.includes('wrong-password') || msg.includes('invalid_login_credentials')) return 'Şifreniz hatalı. Lütfen tekrar deneyin.';
  if (msg.includes('too-many-requests')) return 'Çok fazla başarısız deneme yaptınız. Lütfen biraz bekleyin.';
  return 'İşlem sırasında bir hata oluştu: ' + errMessage;
};

let firebaseApp;
try {
  const renderSecretPath = '/etc/secrets/serviceAccountKey.json';
  const localSecretPath = path.join(__dirname, 'serviceAccountKey.json');
  let serviceAccount;

  if (existsSync(renderSecretPath)) serviceAccount = JSON.parse(readFileSync(renderSecretPath, 'utf8'));
  else if (existsSync(localSecretPath)) serviceAccount = JSON.parse(readFileSync(localSecretPath, 'utf8'));
  else throw new Error("serviceAccountKey.json dosyası bulunamadı!");
  
  firebaseApp = initializeApp({ credential: cert(serviceAccount) });
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

// ==========================================
// KİMLİK DOĞRULAMA & PROFİL ROUTE'LARI
// ==========================================

app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) return res.status(400).json({ error: 'E-posta, kullanıcı adı ve şifre zorunludur.' });

  try {
    const usernameCheck = await db.collection('users').where('username', '==', username).get();
    if (!usernameCheck.empty) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda. Lütfen başka bir ad seçin.' });

    const userRecord = await auth.createUser({ email, password, displayName: username });

    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid, email, username, createdAt: FieldValue.serverTimestamp(), 
      lastActive: FieldValue.serverTimestamp(),
      rooms: [], friends: [], friendRequests: [], sentRequests: [], unreadDMs: {}, // 🟡 YENİ: Okunmamış mesaj haritası
      bio: 'Merhaba! Ben Sesli Oda kullanıyorum.', color: '#5865F2'
    });

    const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginData.error?.message || "Doğrulama token'ı alınamadı.");

    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken: loginData.idToken }),
    });

    res.json({ success: true, message: 'Kayıt başarılı! Lütfen gelen kutunuzdaki onay linkine tıklayın.' });
  } catch (err) { res.status(400).json({ error: translateFirebaseError(err.message) }); }
});

app.post('/api/login', async (req, res) => {
  const { username: identifier, password } = req.body;
  try {
    let email = identifier; let username = identifier; let userRef = null;

    if (!identifier.includes('@')) {
      const userSnap = await db.collection('users').where('username', '==', identifier).limit(1).get();
      if (userSnap.empty) return res.status(404).json({ error: 'Bu kullanıcı adıyla kayıtlı bir hesap bulunamadı.' });
      email = userSnap.docs[0].data().email; username = userSnap.docs[0].data().username; userRef = userSnap.docs[0].ref;
    } else {
      const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
      if (userSnap.empty) return res.status(404).json({ error: 'Bu e-posta ile kayıtlı bir hesap bulunamadı.' });
      username = userSnap.docs[0].data().username; userRef = userSnap.docs[0].ref;
    }

    const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) return res.status(401).json({ error: translateFirebaseError(loginData.error?.message || '') });

    const userInfoRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: loginData.idToken })
    });
    const userInfoData = await userInfoRes.json();

    if (!userInfoData.users[0].emailVerified) return res.status(403).json({ error: 'Hesabınız onaylanmamış. Lütfen linke tıklayın.', needsVerification: true, email: email });

    await userRef.update({ lastActive: FieldValue.serverTimestamp() });
    res.json({ success: true, username: username });
  } catch (err) { res.status(500).json({ error: translateFirebaseError(err.message) }); }
});

app.post('/api/resend-code', async (req, res) => {
  const { email, password } = req.body;
  try {
    const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) return res.status(401).json({ error: translateFirebaseError(loginData.error?.message || '') });

    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken: loginData.idToken }),
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reset-password', async (req, res) => {
  const { email } = req.body;
  try {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/delete-account', async (req, res) => {
  const { username } = req.body;
  try {
    const userSnap = await db.collection('users').where('username', '==', username).limit(1).get();
    if (userSnap.empty) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    const userData = userSnap.docs[0].data();

    if (userData.uid) { try { await auth.deleteUser(userData.uid); } catch (e) {} }
    await userSnap.docs[0].ref.delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:username/profile', async (req, res) => {
  try {
    const snap = await db.collection('users').where('username', '==', req.params.username).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    
    const userRef = snap.docs[0].ref;
    const data = snap.docs[0].data();

    await userRef.update({ lastActive: FieldValue.serverTimestamp() });

    let friendsDetail = [];
    const friendUsernames = data.friends || [];

    if (friendUsernames.length > 0) {
       const friendPromises = friendUsernames.map(f => db.collection('users').where('username', '==', f).limit(1).get());
       const friendSnaps = await Promise.all(friendPromises);
       
       friendsDetail = friendSnaps.map(fSnap => {
          if (fSnap.empty) return null;
          const fd = fSnap.docs[0].data();
          let isOnline = false;
          if (fd.lastActive && typeof fd.lastActive.toDate === 'function') {
             isOnline = (Date.now() - fd.lastActive.toDate().getTime()) < 120000;
          }
          return { username: fd.username, bio: fd.bio || '', color: fd.color || '#5865F2', isOnline };
       }).filter(Boolean);
    }

    res.json({
      rooms: data.rooms || [],
      friendsList: friendUsernames,
      friendsDetail: friendsDetail,
      friendRequests: data.friendRequests || [],
      sentRequests: data.sentRequests || [],
      unreadDMs: data.unreadDMs || {}, // 🟡 YENİ: Okunmamış mesaj verisi Frontend'e gidiyor
      bio: data.bio || '',
      color: data.color || '#5865F2'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:username/profile', async (req, res) => {
  const { bio, color } = req.body;
  try {
    const snap = await db.collection('users').where('username', '==', req.params.username).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    await snap.docs[0].ref.update({ bio: bio.substring(0, 100), color: color || '#5865F2' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/search', async (req, res) => {
  const { q, currentUsername } = req.query;
  if (!q) return res.json({ users: [] });
  try {
    const snapshot = await db.collection('users').where('username', '>=', q).where('username', '<=', q + '\uf8ff').limit(10).get();
    res.json({ users: snapshot.docs.map(d => d.data().username).filter(n => n !== currentUsername) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/friends/add', async (req, res) => {
  const { sender, target } = req.body;
  try {
    const sSnap = await db.collection('users').where('username', '==', sender).limit(1).get();
    const tSnap = await db.collection('users').where('username', '==', target).limit(1).get();
    if (sSnap.empty || tSnap.empty) return res.status(404).json({ error: 'Bulunamadı.' });
    
    await db.runTransaction(async (t) => {
      const sDoc = await t.get(sSnap.docs[0].ref);
      if ((sDoc.data().friends || []).includes(target)) throw new Error('Zaten arkadaşsınız.');
      t.update(sSnap.docs[0].ref, { sentRequests: FieldValue.arrayUnion(target) });
      t.update(tSnap.docs[0].ref, { friendRequests: FieldValue.arrayUnion(sender) });
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/friends/respond', async (req, res) => {
  const { user, target, action } = req.body;
  try {
    const uSnap = await db.collection('users').where('username', '==', user).limit(1).get();
    const tSnap = await db.collection('users').where('username', '==', target).limit(1).get();
    
    await db.runTransaction(async (t) => {
      if (action === 'accept') {
        t.update(uSnap.docs[0].ref, { friends: FieldValue.arrayUnion(target), friendRequests: FieldValue.arrayRemove(target) });
        t.update(tSnap.docs[0].ref, { friends: FieldValue.arrayUnion(user), sentRequests: FieldValue.arrayRemove(user) });
      } else {
        t.update(uSnap.docs[0].ref, { friendRequests: FieldValue.arrayRemove(target) });
        t.update(tSnap.docs[0].ref, { sentRequests: FieldValue.arrayRemove(user) });
      }
    });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ==========================================
// LIVEKIT VE ODA ROUTE'LARI
// ==========================================

app.post('/api/token', async (req, res) => {
  const { roomName, participantName, password, isGuest } = req.body;
  if (!roomName || !participantName) return res.status(400).json({ error: 'Oda ve kullanıcı adı zorunlu.' });

  try {
    const roomRef = db.collection('rooms').doc(roomName); const roomSnap = await roomRef.get(); let isAdmin = false;

    if (!roomSnap.exists) {
      await roomRef.set({ name: roomName, creator: participantName, password: password || '', createdAt: FieldValue.serverTimestamp() });
      isAdmin = true;
    } else {
      const roomData = roomSnap.data();
      if (roomData.password && roomData.password !== password) return res.status(403).json({ error: 'Yanlış oda şifresi!' });
      if (roomData.creator === participantName) isAdmin = true;
    }

    if (!isGuest && !roomName.startsWith('DM_')) {
      const userSnap = await db.collection('users').where('username', '==', participantName).limit(1).get();
      if (!userSnap.empty) {
        let rooms = userSnap.docs[0].data().rooms || [];
        if (!rooms.includes(roomName)) { rooms.push(roomName); if (rooms.length > 10) rooms.shift(); await userSnap.docs[0].ref.update({ rooms }); }
      }
    }

    // 🟡 YENİ: DM Odasına girildiğinde okunmamış mesajları sıfırla (Okundu İşareti)
    if (roomName.startsWith('DM_')) {
      const friendName = roomName.replace('DM_', '').split('-').find(u => u !== participantName);
      const userSnap = await db.collection('users').where('username', '==', participantName).limit(1).get();
      if (!userSnap.empty && friendName) {
         await userSnap.docs[0].ref.set({ unreadDMs: { [friendName]: 0 } }, { merge: true });
      }
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: `${participantName}_${Date.now()}`, name: participantName });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    res.json({ token: await at.toJwt(), isAdmin });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chat', async (req, res) => {
  let { roomName, sender, message, timestamp } = req.body;
  if (!message || message.trim() === '') return res.status(400).json({ error: 'Boş mesaj gönderilemez.' });
  if (message.length > 500) message = message.substring(0, 500) + '...';
  try {
    await db.collection('rooms').doc(roomName).collection('messages').add({ sender, message, timestamp });

    // 🟡 YENİ: DM odasına atılan mesaj, hedef kişinin "Okunmamış" sayacını artırır
    if (roomName.startsWith('DM_')) {
      const targetUser = roomName.replace('DM_', '').split('-').find(u => u !== sender);
      if (targetUser) {
        const targetSnap = await db.collection('users').where('username', '==', targetUser).limit(1).get();
        if (!targetSnap.empty) {
           await targetSnap.docs[0].ref.set({ unreadDMs: { [sender]: FieldValue.increment(1) } }, { merge: true });
        }
      }
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/chat/:roomName', async (req, res) => {
  try {
    const snapshot = await db.collection('rooms').doc(req.params.roomName).collection('messages').orderBy('timestamp', 'desc').limit(50).get();
    res.json({ messages: snapshot.docs.map(doc => doc.data()).reverse() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'dist', 'index.html')); });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda çalışıyor.`));