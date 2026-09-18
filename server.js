import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AccessToken } from 'livekit-server-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'cok_gizli_anahtar_degistirin';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// ==========================================
// MONGODB VERİ MODELLERİ (SCHEMAS)
// ==========================================
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, default: 'Merhaba! Ben Sesli Oda kullanıyorum.' },
  color: { type: String, default: '#5865F2' },
  customStatus: { type: String, default: '' },
  currentRoom: { type: String, default: null },
  lastActive: { type: Date, default: Date.now },
  rooms: { type: [String], default: [] },
  friends: { type: [String], default: [] },
  friendRequests: { type: [String], default: [] },
  sentRequests: { type: [String], default: [] },
  unreadDMs: { type: Map, of: Number, default: {} }
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  roomName: { type: String, required: true, index: true },
  sender: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Number, required: true }
});

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  creator: { type: String, required: true },
  password: { type: String, default: '' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Room = mongoose.model('Room', roomSchema);

// ==========================================
// VERİTABANI BAĞLANTISI
// ==========================================
if (!MONGO_URI) {
  console.error("KRİTİK HATA: MONGO_URI çevre değişkeni eksik!");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("🚀 MongoDB Atlas bağlantısı başarıyla kuruldu."))
  .catch(err => {
    console.error("MongoDB Bağlantı Hatası:", err.message);
    process.exit(1);
  });

// ==========================================
// KİMLİK DOĞRULAMA (AUTH) ROUTE'LARI
// ==========================================
app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'E-posta, kullanıcı adı ve şifre zorunludur.' });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.username === username) return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
      return res.status(400).json({ error: 'Bu e-posta adresiyle kayıtlı bir hesap var.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, username, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ username: newUser.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, username: newUser.username });
  } catch (err) {
    res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu: ' + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username: identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Bilgiler eksik.' });

  try {
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Hatalı şifre.' });

    user.lastActive = new Date();
    await user.save();

    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Giriş hatası: ' + err.message });
  }
});

// ==========================================
// SOSYAL & PROFİL ROUTE'LARI
// ==========================================
app.post('/api/users/:username/heartbeat', async (req, res) => {
  try {
    await User.updateOne({ username: req.params.username }, { $set: { lastActive: new Date() } });
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

app.post('/api/users/:username/status', async (req, res) => {
  const { currentRoom } = req.body;
  try {
    await User.updateOne({ username: req.params.username }, { $set: { currentRoom: currentRoom || null } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/:username/profile', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    user.lastActive = new Date();
    await user.save();

    let friendsDetail = [];
    if (user.friends && user.friends.length > 0) {
      const friendsDocs = await User.find({ username: { $in: user.friends } });
      const now = Date.now();
      friendsDetail = friendsDocs.map(fd => ({
        username: fd.username,
        bio: fd.bio || '',
        color: fd.color || '#5865F2',
        isOnline: fd.lastActive ? (now - new Date(fd.lastActive).getTime() < 120000) : false,
        customStatus: fd.customStatus || '',
        currentRoom: fd.currentRoom || null
      }));
    }

    res.json({
      rooms: user.rooms || [],
      friendsList: user.friends || [],
      friendsDetail,
      friendRequests: user.friendRequests || [],
      sentRequests: user.sentRequests || [],
      unreadDMs: Object.fromEntries(user.unreadDMs || new Map()),
      bio: user.bio || '',
      color: user.color || '#5865F2',
      customStatus: user.customStatus || ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Profil verisi çekilemedi: ' + err.message });
  }
});

app.put('/api/users/:username/profile', async (req, res) => {
  const { bio, color, customStatus } = req.body;
  try {
    const updateData = {};
    if (bio !== undefined) updateData.bio = String(bio).substring(0, 100);
    if (color !== undefined) updateData.color = color;
    if (customStatus !== undefined) updateData.customStatus = customStatus;

    await User.updateOne({ username: req.params.username }, { $set: updateData });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/search', async (req, res) => {
  const { q, currentUsername } = req.query;
  if (!q) return res.json({ users: [] });

  try {
    const users = await User.find({
      username: { $regex: `^${q}`, $options: 'i',$ne: currentUsername }
    }).limit(15).select('username');

    res.json({ users: users.map(u => u.username) });
  } catch (err) {
    res.status(500).json({ error: 'Arama sırasında hata oluştu.' });
  }
});

app.post('/api/friends/add', async (req, res) => {
  const { sender, target } = req.body;
  try {
    const senderUser = await User.findOne({ username: sender });
    const targetUser = await User.findOne({ username: target });
    if (!senderUser || !targetUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    if (senderUser.friends.includes(target)) {
      return res.status(400).json({ error: 'Zaten arkadaşsınız.' });
    }

    await User.updateOne({ username: sender }, { $addToSet: { sentRequests: target } });
    await User.updateOne({ username: target }, { $addToSet: { friendRequests: sender } });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/friends/respond', async (req, res) => {
  const { user, target, action } = req.body;
  try {
    if (action === 'accept') {
      await User.updateOne({ username: user }, {
        $addToSet: { friends: target },$pull: { friendRequests: target }
      });
      await User.updateOne({ username: target }, {
        $addToSet: { friends: user },$pull: { sentRequests: user }
      });
    } else {
      await User.updateOne({ username: user }, { $pull: { friendRequests: target } });
      await User.updateOne({ username: target }, { $pull: { sentRequests: user } });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/delete-account', async (req, res) => {
  const { username } = req.body;
  try {
    await User.deleteOne({ username });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Hesap silinemedi.' });
  }
});

// ==========================================
// ODALAR & LIVEKIT ROUTE'LARI
// ==========================================
app.get('/api/rooms/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('rooms');
    res.json({ rooms: user ? user.rooms : [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/token', async (req, res) => {
  const { roomName, participantName, password, isGuest } = req.body;
  if (!roomName || !participantName) return res.status(400).json({ error: 'Oda ve kullanıcı adı zorunlu.' });

  try {
    let room = await Room.findOne({ name: roomName });
    let isAdmin = false;

    if (!room) {
      room = new Room({ name: roomName, creator: participantName, password: password || '' });
      await room.save();
      isAdmin = true;
    } else {
      if (room.password && room.password !== password) {
        return res.status(403).json({ error: 'Yanlış oda şifresi!' });
      }
      if (room.creator === participantName) isAdmin = true;
    }

    if (!isGuest && !roomName.startsWith('DM_')) {
      await User.updateOne(
        { username: participantName },
        { $addToSet: { rooms: roomName } }
      );
    }

    if (roomName.startsWith('DM_')) {
      const friendName = roomName.replace('DM_', '').split('-').find(u => u !== participantName);
      if (friendName) {
        await User.updateOne(
          { username: participantName },
          { $set: { [`unreadDMs.${friendName}`]: 0 } }
        );
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

app.post('/api/chat', async (req, res) => {
  let { roomName, sender, message, timestamp } = req.body;
  if (!message || message.trim() === '') return res.status(400).json({ error: 'Boş mesaj gönderilemez.' });
  if (message.length > 500) message = message.substring(0, 500) + '...';

  try {
    const newMsg = new Message({ roomName, sender, message, timestamp });
    await newMsg.save();

    if (roomName.startsWith('DM_')) {
      const targetUser = roomName.replace('DM_', '').split('-').find(u => u !== sender);
      if (targetUser) {
        await User.updateOne(
          { username: targetUser },
          { $inc: { [`unreadDMs.${sender}`]: 1 } }
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chat/:roomName', async (req, res) => {
  try {
    const messages = await Message.find({ roomName }).sort({ timestamp: -1 }).limit(50);
    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda çalışıyor.`));