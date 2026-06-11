import { db } from './firebase';
import firebase from 'firebase/compat/app';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  displayNameLower?: string;
  photoURL: string | null;
  createdAt: firebase.firestore.Timestamp;
}

export const searchUsers = async (query: string): Promise<UserProfile[]> => {
  if (!query.trim()) return [];

  const lower = query.toLowerCase();
  const end = lower.replace(/.$/, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 1)
  );

  const snapshot = await db
    .collection('users')
    .orderBy('displayNameLower')
    .where('displayNameLower', '>=', lower)
    .where('displayNameLower', '<', end)
    .get();

  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  })) as UserProfile[];
};

export const searchUsersByEmail = async (
  email: string
): Promise<UserProfile[]> => {
  if (!email.trim()) return [];

  const snapshot = await db
    .collection('users')
    .where('email', '==', email)
    .get();

  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  })) as UserProfile[];
};
