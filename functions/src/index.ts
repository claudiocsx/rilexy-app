import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const fetchLinkPreview = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Faça login primeiro');
  }
  const { url } = data;
  if (!url || typeof url !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'URL inválida');
  }
  try {
    const https = require('https');
    const http = require('http');
    const protocol = url.startsWith('https') ? https : http;
    const html = await new Promise<string>((resolve, reject) => {
      const req = protocol.get(url, { timeout: 5000 }, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
    const desc = html.match(/<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["']/i)?.[1]
      || html.match(/<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]+name\s*=\s*["']description["']/i)?.[1] || '';
    const ogTitle = html.match(/<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']*)["']/i)?.[1] || title;
    const ogDesc = html.match(/<meta[^>]+property\s*=\s*["']og:description["'][^>]+content\s*=\s*["']([^"']*)["']/i)?.[1] || desc;
    const ogImage = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    const ogSiteName = html.match(/<meta[^>]+property\s*=\s*["']og:site_name["'][^>]+content\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    if (!ogTitle && !ogDesc && !ogImage) {
      return { url, title: '', description: '', image: '', siteName: '' };
    }
    const finalImage = ogImage.startsWith('//') ? `https:${ogImage}` : ogImage.startsWith('/') ? { url, title, description: '', image: '', siteName: '' }
      : ogImage;
    return { url, title: ogTitle, description: ogDesc, image: finalImage, siteName: ogSiteName };
  } catch {
    return { url, title: '', description: '', image: '', siteName: '' };
  }
});

export const deleteExpiredMessages = functions.pubsub.schedule('every 1 minute').onRun(async () => {
  const now = admin.firestore.Timestamp.now();
  const chatsSnap = await db.collection('chats').get();
  const promises: Promise<any>[] = [];
  chatsSnap.forEach((chatDoc) => {
    promises.push((async () => {
      const expiredSnap = await db
        .collection('chats').doc(chatDoc.id)
        .collection('messages')
        .where('timerExpiresAt', '<=', now)
        .get();
      const batch = db.batch();
      expiredSnap.forEach((msgDoc) => {
        batch.delete(msgDoc.ref);
      });
      if (expiredSnap.size > 0) {
        await batch.commit();
      }
    })());
  });
  await Promise.all(promises);
});

export const sendScheduledMessages = functions.pubsub.schedule('every 1 minute').onRun(async () => {
  const now = admin.firestore.Timestamp.now();
  const snapshot = await db
    .collection('scheduledMessages')
    .where('scheduledAt', '<=', now)
    .where('sent', '==', false)
    .get();
  const batch = db.batch();
  snapshot.forEach((doc) => {
    const data = doc.data();
    const msgRef = db.collection('chats').doc(data.chatId).collection('messages').doc();
    batch.set(msgRef, {
      text: data.text,
      senderId: data.senderId,
      senderName: data.senderName,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      participants: data.participants,
    });
    batch.delete(doc.ref);
  });
  if (snapshot.size > 0) {
    await batch.commit();
  }
});

export const translateMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Faça login primeiro');
  }
  const { text, targetLanguage } = data;
  if (!text || !targetLanguage) {
    throw new functions.https.HttpsError('invalid-argument', 'Texto e idioma obrigatórios');
  }
  try {
    const https = require('https');
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) throw new Error('API key not configured');
    const encodedText = encodeURIComponent(text);
    const url = `https://translation.googleapis.com/language/translate/v2?q=${encodedText}&target=${targetLanguage}&key=${apiKey}`;
    const result = await new Promise<string>((resolve, reject) => {
      https.get(url, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
    const json = JSON.parse(result);
    const translatedText = json?.data?.translations?.[0]?.translatedText || text;
    return { translatedText };
  } catch {
    return { translatedText: text };
  }
});

export const onUserStatusChange = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const { userId } = context.params;
    const newStatus = change.after.data()?.status;

    if (newStatus === 'online') {
      await db.collection('users').doc(userId).update({
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

export const createChatOnFirstMessage = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { chatId } = context.params;
    const message = snap.data();

    await db.collection('chats').doc(chatId).update({
      lastMessage: message.text || '[Mídia]',
      lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageSender: message.senderId,
    });
  });

export const sendFcmMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Faça login primeiro');
  }

  const { token, title, body, data: payloadData, channelId, imageUrl } = data;
  if (!token || !title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'token, title e body obrigatórios');
  }

  const androidNotif: Record<string, any> = {
    channelId: channelId || 'messages',
    color: '#7c3aed',
    priority: 'high',
    sound: 'default',
  };
  if (imageUrl) androidNotif.imageUrl = imageUrl;

  const message: admin.messaging.Message = {
    token,
    notification: { title, body },
    android: {
      priority: 'high',
      notification: androidNotif,
    },
    data: payloadData || {},
  };

  await admin.messaging().send(message);
  return { success: true };
});

export const signalingOffer = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Faça login primeiro');
  }

  const { targetUserId, offer } = data;
  await db.collection('calls').doc(targetUserId).set({
    callerId: context.auth.uid,
    offer,
    type: 'video',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

export const signalingAnswer = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Faça login primeiro');
  }

  const { callerId, answer } = data;
  await db.collection('calls').doc(callerId).update({
    answer,
    status: 'answered',
  });

  return { success: true };
});

export const signalingIceCandidate = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Faça login primeiro');
  }

  const { targetUserId, candidate } = data;
  await db.collection('calls').doc(targetUserId).collection('iceCandidates').add({
    candidate,
    senderId: context.auth.uid,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});


export const sendMessageNotification = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { chatId } = context.params;
    const message = snap.data();
    if (!message.text && !message.sticker && !message.mediaUrl && !message.audioUrl) return;
    const chatDoc = await db.collection('chats').doc(chatId).get();
    const participants = chatDoc.data()?.participants || [];
    if (participants.length < 2) return;
    const recipientId = participants.find((p) => p !== message.senderId);
    if (!recipientId) return;
    const userDoc = await db.collection('users').doc(recipientId).get();
    const fcmToken = userDoc.data()?.fcmToken;
    if (!fcmToken) return;
    const senderDoc = await db.collection('users').doc(message.senderId).get();
    const senderData = senderDoc.data();
    const senderName = senderData?.displayName || message.senderName || 'Alguém';
    const senderPhoto = senderData?.photoURL || undefined;
    let body = message.text || '';
    if (!body && message.sticker) body = 'Figurinha';
    if (!body && message.mediaUrl) body = 'Mídia';
    if (!body && message.audioUrl) body = 'Áudio';

    const androidNotif: Record<string, any> = {
      channelId: 'messages',
      color: '#7c3aed',
      priority: 'high',
      sound: 'default',
    };
    if (senderPhoto) androidNotif.imageUrl = senderPhoto;

    await admin.messaging().send({
      token: fcmToken,
      notification: { title: senderName, body },
      android: {
        priority: 'high',
        notification: androidNotif,
      },
      data: { chatId, peerName: senderName },
    });
  });
