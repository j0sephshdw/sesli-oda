require('dotenv').config();
const express = require('express');
const { AccessToken } = require('livekit-server-sdk');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Şifreler artık .env dosyasından güvenli bir şekilde çekiliyor
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

app.get('/get-token', async (req, res) => {
    try {
        const roomName = req.query.room || "genel-oda";
        const participantName = req.query.username || "Misafir";
        
        // Ekranda görünen isim aynı kalırken, arkaplandaki kimlik (identity) güvenli hale getiriliyor.
        // Aynı isimle girenlerin çakışmaması için sonuna rastgele sayı ekliyoruz.
        const safeIdentity = participantName.trim().replace(/[^a-zA-Z0-9]/g, '_') + '_' + Math.floor(Math.random() * 10000);

        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: safeIdentity,
            name: participantName,
            ttl: '10m' // Biletin geçerlilik süresi 10 dakika (odaya girdikten sonra sizi atmaz)
        });

        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true
        });

        const token = await at.toJwt();
        console.log(`[BAŞARILI] '${participantName}' (ID: ${safeIdentity}) için odaya giriş bileti üretildi.`);
        
        res.json({ token, url: LIVEKIT_URL });
    } catch (err) {
        console.error("[HATA] Token üretilemedi:", err);
        res.status(500).json({ error: "Token üretilemedi", details: err.message });
    }
});

// Render gibi platformlar için port ayarı eklendi
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu hazır! Tarayıcıdan aç: http://localhost:${PORT}`);
});