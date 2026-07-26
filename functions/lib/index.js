"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessageNotification = exports.signalingIceCandidate = exports.signalingAnswer = exports.signalingOffer = exports.sendFcmMessage = exports.createChatOnFirstMessage = exports.onUserStatusChange = exports.translateMessage = exports.sendScheduledMessages = exports.deleteExpiredMessages = exports.fetchLinkPreview = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
exports.fetchLinkPreview = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
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
        const html = await new Promise((resolve, reject) => {
            const req = protocol.get(url, { timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        });
        const title = ((_b = (_a = html.match(/<title[^>]*>([^<]*)<\/title>/i)) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.trim()) || '';
        const desc = ((_c = html.match(/<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["']/i)) === null || _c === void 0 ? void 0 : _c[1])
            || ((_d = html.match(/<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]+name\s*=\s*["']description["']/i)) === null || _d === void 0 ? void 0 : _d[1]) || '';
        const ogTitle = ((_e = html.match(/<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']*)["']/i)) === null || _e === void 0 ? void 0 : _e[1]) || title;
        const ogDesc = ((_f = html.match(/<meta[^>]+property\s*=\s*["']og:description["'][^>]+content\s*=\s*["']([^"']*)["']/i)) === null || _f === void 0 ? void 0 : _f[1]) || desc;
        const ogImage = ((_g = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']*)["']/i)) === null || _g === void 0 ? void 0 : _g[1]) || '';
        const ogSiteName = ((_h = html.match(/<meta[^>]+property\s*=\s*["']og:site_name["'][^>]+content\s*=\s*["']([^"']*)["']/i)) === null || _h === void 0 ? void 0 : _h[1]) || '';
        if (!ogTitle && !ogDesc && !ogImage) {
            return { url, title: '', description: '', image: '', siteName: '' };
        }
        const finalImage = ogImage.startsWith('//') ? `https:${ogImage}` : ogImage.startsWith('/') ? { url, title, description: '', image: '', siteName: '' }
            : ogImage;
        return { url, title: ogTitle, description: ogDesc, image: finalImage, siteName: ogSiteName };
    }
    catch (_j) {
        return { url, title: '', description: '', image: '', siteName: '' };
    }
});
exports.deleteExpiredMessages = functions.pubsub.schedule('every 1 minute').onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const chatsSnap = await db.collection('chats').get();
    const promises = [];
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
exports.sendScheduledMessages = functions.pubsub.schedule('every 1 minute').onRun(async () => {
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
exports.translateMessage = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
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
        if (!apiKey)
            throw new Error('API key not configured');
        const encodedText = encodeURIComponent(text);
        const url = `https://translation.googleapis.com/language/translate/v2?q=${encodedText}&target=${targetLanguage}&key=${apiKey}`;
        const result = await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
        const json = JSON.parse(result);
        const translatedText = ((_c = (_b = (_a = json === null || json === void 0 ? void 0 : json.data) === null || _a === void 0 ? void 0 : _a.translations) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.translatedText) || text;
        return { translatedText };
    }
    catch (_d) {
        return { translatedText: text };
    }
});
exports.onUserStatusChange = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
    var _a;
    const { userId } = context.params;
    const newStatus = (_a = change.after.data()) === null || _a === void 0 ? void 0 : _a.status;
    if (newStatus === 'online') {
        await db.collection('users').doc(userId).update({
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
exports.createChatOnFirstMessage = functions.firestore
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
exports.sendFcmMessage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Faça login primeiro');
    }
    const { token, title, body, data: payloadData, channelId, imageUrl } = data;
    if (!token || !title || !body) {
        throw new functions.https.HttpsError('invalid-argument', 'token, title e body obrigatórios');
    }
    const androidNotif = {
        channelId: channelId || 'messages',
        color: '#7c3aed',
        priority: 'high',
        sound: 'default',
    };
    if (imageUrl)
        androidNotif.imageUrl = imageUrl;
    const message = {
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
exports.signalingOffer = functions.https.onCall(async (data, context) => {
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
exports.signalingAnswer = functions.https.onCall(async (data, context) => {
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
exports.signalingIceCandidate = functions.https.onCall(async (data, context) => {
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
exports.sendMessageNotification = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
    var _a, _b;
    const { chatId } = context.params;
    const message = snap.data();
    if (!message.text && !message.sticker && !message.mediaUrl && !message.audioUrl)
        return;
    const chatDoc = await db.collection('chats').doc(chatId).get();
    const participants = ((_a = chatDoc.data()) === null || _a === void 0 ? void 0 : _a.participants) || [];
    if (participants.length < 2)
        return;
    const recipientId = participants.find((p) => p !== message.senderId);
    if (!recipientId)
        return;
    const userDoc = await db.collection('users').doc(recipientId).get();
    const fcmToken = (_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.fcmToken;
    if (!fcmToken)
        return;
    const senderDoc = await db.collection('users').doc(message.senderId).get();
    const senderData = senderDoc.data();
    const senderName = (senderData === null || senderData === void 0 ? void 0 : senderData.displayName) || message.senderName || 'Alguém';
    const senderPhoto = (senderData === null || senderData === void 0 ? void 0 : senderData.photoURL) || undefined;
    let body = message.text || '';
    if (!body && message.sticker)
        body = 'Figurinha';
    if (!body && message.mediaUrl)
        body = 'Mídia';
    if (!body && message.audioUrl)
        body = 'Áudio';
    const androidNotif = {
        channelId: 'messages',
        color: '#7c3aed',
        priority: 'high',
        sound: 'default',
    };
    if (senderPhoto)
        androidNotif.imageUrl = senderPhoto;
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
//# sourceMappingURL=index.js.map