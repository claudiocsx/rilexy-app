import { db } from './firebase';
import firebase from 'firebase/compat/app';
import { getSupabase } from './supabase';

export interface GroupData {
  id: string;
  name: string;
  description?: string;
  participants: string[];
  createdBy: string;
  createdAt: firebase.firestore.Timestamp | Date;
  photoURL?: string | null;
  inviteCode?: string;
  admins?: string[];
  memberTags?: Record<string, string>;
  pendingApprovals?: string[];
  autoDeleteDuration?: number | null;
  bannedUsers?: Record<string, string>;
}

export const AUTO_DELETE_OPTIONS = [
  { label: 'Desligado', value: null },
  { label: '1 hora', value: 3600 },
  { label: '1 dia', value: 86400 },
  { label: '7 dias', value: 604800 },
  { label: '90 dias', value: 7776000 },
] as const;

export const createGroup = async (
  name: string,
  creatorUid: string,
  participantUids: string[],
  photoURL?: string | null
): Promise<string> => {
  const allParticipants = [creatorUid, ...participantUids.filter((u) => u !== creatorUid)];
  const uniqueParticipants = [...new Set(allParticipants)];
  const inviteCode = generateInviteCode();

  const docRef = await db.collection('groups').add({
    name: name.trim(),
    participants: uniqueParticipants,
    createdBy: creatorUid,
    admins: [creatorUid],
    memberTags: {},
    pendingApprovals: [],
    createdAt: new Date(),
    photoURL: photoURL || null,
    inviteCode,
  });

  await db.collection('chats').doc(docRef.id).set({
    participants: uniqueParticipants,
    name: name.trim(),
    createdAt: new Date(),
    lastMessageTime: new Date(),
    isGroup: true,
    groupId: docRef.id,
    photoURL: photoURL || null,
  }, { merge: true });

  return docRef.id;
};

export const getGroup = async (groupId: string): Promise<GroupData | null> => {
  const doc = await db.collection('groups').doc(groupId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as GroupData;
};

export const updateGroupName = async (groupId: string, name: string): Promise<void> => {
  const trimmed = name.trim();
  await db.collection('groups').doc(groupId).update({ name: trimmed });
  await db.collection('chats').doc(groupId).update({ name: trimmed }).catch(() => {});
};

export const updateGroupPhoto = async (groupId: string, photoURL: string): Promise<void> => {
  await db.collection('groups').doc(groupId).update({ photoURL });
  await db.collection('chats').doc(groupId).update({ photoURL }).catch(() => {});
};

export const uploadGroupPhoto = async (groupId: string, uri: string): Promise<string | null> => {
  try {
    const supabase = getSupabase();
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const path = `groups/${groupId}/photo.${ext}`;

    const file = await fetch(uri);
    const blob = await file.blob();

    const { error } = await supabase.storage
      .from('rilaxy-media')
      .upload(path, blob, { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`, upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from('rilaxy-media').getPublicUrl(path);
    return data.publicUrl;
  } catch (err: any) {
    console.error('uploadGroupPhoto error:', err?.message || err);
    return null;
  }
};

export const addParticipant = async (groupId: string, userId: string): Promise<void> => {
  await db.collection('groups').doc(groupId).update({
    participants: firebase.firestore.FieldValue.arrayUnion(userId),
  });
  await db.collection('chats').doc(groupId).update({
    participants: firebase.firestore.FieldValue.arrayUnion(userId),
  }).catch(() => {});
};

export const removeParticipant = async (groupId: string, userId: string): Promise<void> => {
  await db.collection('groups').doc(groupId).update({
    participants: firebase.firestore.FieldValue.arrayRemove(userId),
  });
  await db.collection('chats').doc(groupId).update({
    participants: firebase.firestore.FieldValue.arrayRemove(userId),
  }).catch(() => {});
};

export const updateGroupDescription = async (groupId: string, description: string): Promise<void> => {
  await db.collection('groups').doc(groupId).update({ description });
  await db.collection('chats').doc(groupId).update({ description }).catch(() => {});
};

export const exitGroup = async (groupId: string, userId: string): Promise<void> => {
  await removeParticipant(groupId, userId);
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  const messagesSnap = await db.collection('chats').doc(groupId).collection('messages').get();
  const batch = db.batch();
  messagesSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(db.collection('groups').doc(groupId));
  await batch.commit();

  await db.collection('chats').doc(groupId).delete().catch(() => {});
};

export const isCreator = (group: GroupData, userId: string): boolean => {
  return group.createdBy === userId;
};

export const promoteToAdmin = async (groupId: string, userId: string): Promise<void> => {
  await db.collection('groups').doc(groupId).update({
    admins: firebase.firestore.FieldValue.arrayUnion(userId),
  });
};

export const demoteAdmin = async (groupId: string, userId: string): Promise<void> => {
  await db.collection('groups').doc(groupId).update({
    admins: firebase.firestore.FieldValue.arrayRemove(userId),
  });
};

export const transferOwnership = async (groupId: string, newOwnerId: string): Promise<void> => {
  await db.collection('groups').doc(groupId).update({
    createdBy: newOwnerId,
    admins: firebase.firestore.FieldValue.arrayUnion(newOwnerId),
  });
};

export const updateAutoDeleteDuration = async (groupId: string, duration: number | null): Promise<void> => {
  await db.collection('groups').doc(groupId).update({
    autoDeleteDuration: duration,
  });
};

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const banMember = async (groupId: string, userId: string, reason: string): Promise<void> => {
  await db.collection('groups').doc(groupId).update({
    [`bannedUsers.${userId}`]: reason,
    participants: firebase.firestore.FieldValue.arrayRemove(userId),
  });
  await db.collection('chats').doc(groupId).update({
    participants: firebase.firestore.FieldValue.arrayRemove(userId),
  }).catch(() => {});
};

export const unbanMember = async (groupId: string, userId: string): Promise<void> => {
  await db.collection('groups').doc(groupId).update({
    [`bannedUsers.${userId}`]: firebase.firestore.FieldValue.delete(),
  });
};

export const joinGroupByCode = async (code: string, userId: string): Promise<string | null> => {
  const snap = await db.collection('groups')
    .where('inviteCode', '==', code)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const groupDoc = snap.docs[0];
  const groupId = groupDoc.id;
  const data = groupDoc.data();

  if (data.bannedUsers?.[userId]) return 'banned';

  if (data.participants.includes(userId)) return groupId;

  // Add to pending approvals instead of auto-joining
  await db.collection('groups').doc(groupId).update({
    pendingApprovals: firebase.firestore.FieldValue.arrayUnion(userId),
  });
  return groupId;
};
