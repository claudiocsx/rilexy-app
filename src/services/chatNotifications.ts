import { Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { db } from './firebase';

let currentChatId: string | null = null;
let currentUserId: string | null = null;
const lastNotifiedAt = new Map<string, number>();
const notifiedMessages = new Map<string, number>();
const knownMessages = new Map<string, string>();
let isFirstSnapshot = true;
let unsubscribe: (() => void) | null = null;

export function setCurrentChatId(chatId: string | null) {
  currentChatId = chatId;
}

export function updateChatLastMessage(
  chatId: string,
  displayText: string,
  senderId: string
) {
  db.collection('chats').doc(chatId).update({
    lastMessage: displayText,
    lastMessageTime: new Date(),
    lastMessageSender: senderId,
    hiddenFor: [],
  }).catch(() => {});
}

export function startLocalChatNotifications(userId: string) {
  stopLocalChatNotifications();
  currentUserId = userId;
  isFirstSnapshot = true;

  const query = db.collection('chats')
    .where('participants', 'array-contains', userId);

  unsubscribe = query.onSnapshot((snapshot) => {
    if (isFirstSnapshot) {
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.lastMessage) {
          knownMessages.set(doc.id, data.lastMessage);
        }
      });
      isFirstSnapshot = false;
      return;
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'modified' && change.type !== 'added') return;
      const doc = change.doc;
      const data = doc.data();
      const chatId = doc.id;
      const lastMsg = data.lastMessage as string | undefined;
      const senderId = data.lastMessageSender as string | undefined;

      if (!lastMsg || !senderId || senderId === userId) return;
      if (currentChatId === chatId) return;

      const prevMsg = knownMessages.get(chatId);
      if (prevMsg === lastMsg) return;
      knownMessages.set(chatId, lastMsg);

      const now = Date.now();
      if (now - (lastNotifiedAt.get(chatId) ?? 0) < 3000) return;
      lastNotifiedAt.set(chatId, now);

      const msgKey = `${chatId}:${senderId}:${lastMsg}`;
      if (now - (notifiedMessages.get(msgKey) ?? 0) < 15000) return;
      notifiedMessages.set(msgKey, now);

      if (notifiedMessages.size > 100) {
        const cutoff = now - 30000;
        for (const [k, t] of notifiedMessages) {
          if (t < cutoff) notifiedMessages.delete(k);
        }
      }

      scheduleNotification(chatId, lastMsg, senderId);
    });
  }, () => {});
}

async function scheduleNotification(chatId: string, message: string, senderId: string) {
  let senderName = 'Nova mensagem';
  let senderPhoto: string | undefined;
  let chatTitle = '';
  try {
    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (chatDoc.exists) {
      const chatData = chatDoc.data()!;
      if (chatData.isGroup) {
        chatTitle = chatData.name || '';
      }
    }
    let userDoc;
    try {
      userDoc = await db.collection('users').doc(senderId).get({ source: 'server' });
    } catch {
      userDoc = await db.collection('users').doc(senderId).get();
    }
    if (userDoc.exists) {
      const data = userDoc.data()!;
      senderName = data.displayName || 'Nova mensagem';
      senderPhoto = data.photoURL || undefined;
      console.log('scheduleNotification: senderPhoto =', senderPhoto);
    }
  } catch {
    console.warn('scheduleNotification: failed to fetch sender data');
  }

  const groupTitle = chatTitle ? `${senderName} — ${chatTitle}` : senderName;
  const title = groupTitle;

  Vibration.vibrate([0, 250, 250, 250]);

  const content: Record<string, any> = {
    title,
    body: message,
    image: senderPhoto,
    data: { chatId, groupTitle, peerName: senderName, type: 'message', currentUserId: senderId, recipientId: currentUserId, _fromLocal: true, image: senderPhoto },
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.HIGH,
    channelId: 'messages',
    categoryIdentifier: 'message',
  };

  await Notifications.scheduleNotificationAsync({
    identifier: 'chat_' + chatId,
    content: content as any,
    trigger: null,
  }).catch(() => {});
}

export function stopLocalChatNotifications() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  knownMessages.clear();
  lastNotifiedAt.clear();
  notifiedMessages.clear();
  isFirstSnapshot = true;
}
