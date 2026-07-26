const express = require('express');
const admin = require('firebase-admin');

const app = express();
app.use(express.json({ limit: '100kb' }));

const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (!credJson) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(credJson)),
});

const API_KEY = process.env.PUSH_API_KEY || '';

app.post('/send-push', async (req, res) => {
  try {
    const auth = req.headers.authorization?.replace('Bearer ', '');
    if (API_KEY && auth !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token, title, body, channelId, imageUrl, categoryId, data } = req.body;
    if (!token || !title || !body) {
      return res.status(400).json({ error: 'token, title e body obrigatórios' });
    }

    // Expo Push Token — use Expo Push API
    if (token.startsWith('ExponentPushToken')) {
      const expoPayload = {
        to: token,
        title,
        body,
        data: {
          ...(data || {}),
          ...(categoryId ? { categoryId } : {}),
          channelId: channelId || 'messages',
          color: '#7c3aed',
          priority: 'max',
        },
        sound: 'default',
        priority: 'high',
        android: { channelId: channelId || 'messages', color: '#7c3aed', priority: 'high' },
      };
      if (imageUrl) expoPayload.data.imageUrl = imageUrl;

      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(expoPayload),
      });
      const expoResult = await expoRes.json();
      return res.json({ ok: true, expo: expoResult });
    }

    // Native FCM token
    if (categoryId) {
      // Data-only message so Expo processes categoryId for interactive buttons
      const message = {
        token,
        android: { priority: 'high' },
        data: {
          title,
          body,
          categoryId,
          channelId: channelId || 'messages',
          color: '#7c3aed',
          sound: 'default',
          priority: 'max',
          ...(data || {}),
        },
      };
      await admin.messaging().send(message);
      return res.json({ ok: true });
    }

    const androidNotif = {
      channelId: channelId || 'messages',
      color: '#7c3aed',
      priority: 'high',
      sound: 'default',
    };
    if (imageUrl) androidNotif.imageUrl = imageUrl;

    const message = {
      token,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: androidNotif,
      },
      data: data || {},
    };

    await admin.messaging().send(message);
    res.json({ ok: true });
  } catch (e) {
    console.error('send-push error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
