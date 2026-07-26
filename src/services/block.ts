import { db } from './firebase';
import firebase from 'firebase/compat/app';

export const blockUser = async (currentUid: string, targetUid: string): Promise<void> => {
  await db.collection('users').doc(currentUid).update({
    blockedUsers: firebase.firestore.FieldValue.arrayUnion(targetUid),
  });
};

export const unblockUser = async (currentUid: string, targetUid: string): Promise<void> => {
  await db.collection('users').doc(currentUid).update({
    blockedUsers: firebase.firestore.FieldValue.arrayRemove(targetUid),
  });
};

export const getBlockedUids = async (uid: string): Promise<string[]> => {
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return [];
  return doc.data()!.blockedUsers || [];
};

export const observeBlockedUids = (
  uid: string,
  cb: (blockedUids: string[]) => void
): (() => void) => {
  return db.collection('users').doc(uid).onSnapshot((doc) => {
    cb(doc.exists ? (doc.data()!.blockedUsers || []) : []);
  });
};
