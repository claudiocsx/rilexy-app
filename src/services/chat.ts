import { db } from './firebase';
import firebase from 'firebase/compat/app';

export const findOrCreateChat = async (
  currentUid: string,
  otherUid: string,
  otherDisplayName?: string
): Promise<string> => {
  const sortedIds = [currentUid, otherUid].sort();
  const chatId = sortedIds.join('_');
  const chatRef = db.collection('chats').doc(chatId);
  const now = new Date();

  const doc = await chatRef.get();
  if (doc.exists) {
    const data = doc.data()!;
    const participants: string[] = data.participants || [];
    const hiddenFor: string[] = data.hiddenFor || [];
    if (!participants.includes(currentUid)) {
      await chatRef.update({
        participants: firebase.firestore.FieldValue.arrayUnion(currentUid),
        hiddenFor: firebase.firestore.FieldValue.arrayRemove(currentUid),
        [`clearedAt.${currentUid}`]: now,
        lastMessageTime: now,
      }).catch(async () => {
        await chatRef.set({
          participants: sortedIds,
          name: otherDisplayName || null,
          createdAt: now,
          lastMessageTime: now,
        }, { merge: true }).catch((e) => { console.error('Chat creation fallback failed', e); });
      });
    } else if (hiddenFor.includes(currentUid)) {
      await chatRef.update({
        hiddenFor: firebase.firestore.FieldValue.arrayRemove(currentUid),
        [`clearedAt.${currentUid}`]: now,
        lastMessageTime: now,
      });
    } else {
      await chatRef.update({ lastMessageTime: now }).catch(() => {});
    }
  } else {
    await chatRef.set({
      participants: sortedIds,
      name: otherDisplayName || null,
      createdAt: now,
      lastMessageTime: now,
    });
  }

  return chatId;
};
