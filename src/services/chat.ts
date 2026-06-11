import { db } from './firebase';

export const findOrCreateChat = async (
  currentUid: string,
  otherUid: string,
  otherDisplayName?: string
): Promise<string> => {
  const sortedIds = [currentUid, otherUid].sort();
  const chatId = sortedIds.join('_');

  await db.collection('chats').doc(chatId).set({
    participants: sortedIds,
    name: otherDisplayName || null,
    createdAt: new Date(),
    lastMessageTime: new Date(),
  }, { merge: true });

  return chatId;
};
