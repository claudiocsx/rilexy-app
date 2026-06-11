import { db } from './firebase';
import { onAuthChange, RilaxyUser } from './auth';

export const setupPresence = (user: RilaxyUser) => {
  const userRef = db.collection('users').doc(user.uid);

  userRef.set({
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    email: user.email,
    status: 'online',
    lastSeen: new Date(),
  }, { merge: true });

  userRef.update({ status: 'online' });

  onAuthChange((currentUser) => {
    if (!currentUser) {
      userRef.update({ status: 'offline' });
    }
  });
};

export const listenToUserStatus = (
  userId: string,
  onStatusChange: (status: string) => void
) => {
  const userRef = db.collection('users').doc(userId);
  return userRef.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (data) {
      onStatusChange(data.status || 'offline');
    }
  });
};
