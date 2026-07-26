import { db } from './firebase';
import firebase from 'firebase/compat/app';

export const muteUser = async (currentUid: string, targetUid: string): Promise<void> => {
  await db.collection('users').doc(currentUid).update({
    mutedUsers: firebase.firestore.FieldValue.arrayUnion(targetUid),
  });
};

export const unmuteUser = async (currentUid: string, targetUid: string): Promise<void> => {
  await db.collection('users').doc(currentUid).update({
    mutedUsers: firebase.firestore.FieldValue.arrayRemove(targetUid),
  });
};

export const getMutedUids = async (uid: string): Promise<string[]> => {
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return [];
  return doc.data()!.mutedUsers || [];
};

export const observeMutedUids = (
  uid: string,
  cb: (mutedUids: string[]) => void
): (() => void) => {
  return db.collection('users').doc(uid).onSnapshot((doc) => {
    cb(doc.exists ? (doc.data()!.mutedUsers || []) : []);
  });
};
