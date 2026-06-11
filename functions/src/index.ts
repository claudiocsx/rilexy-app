import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

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
