import { auth, db } from './firebase';

export type RilaxyUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export const registerUser = async (
  email: string,
  password: string,
  displayName: string
) => {
  const result = await auth.createUserWithEmailAndPassword(email, password);
  if (!result.user) throw new Error('Usuário não criado');
  await result.user.updateProfile({ displayName });
  await result.user.getIdToken(true);

  const updatedUser = auth.currentUser;
  const userRecord = {
    uid: updatedUser?.uid || result.user.uid,
    email: updatedUser?.email || result.user.email,
    displayName: updatedUser?.displayName || displayName,
    displayNameLower: (displayName || '').toLowerCase(),
    photoURL: updatedUser?.photoURL || result.user.photoURL,
    createdAt: new Date(),
  };

  await db.collection('users').doc(userRecord.uid).set(userRecord);

  return {
    uid: userRecord.uid,
    email: userRecord.email,
    displayName: userRecord.displayName,
    photoURL: userRecord.photoURL,
  };
};

export const loginUser = async (email: string, password: string) => {
  const result = await auth.signInWithEmailAndPassword(email, password);
  if (!result.user) throw new Error('Falha ao autenticar');
  return {
    uid: result.user.uid,
    email: result.user.email,
    displayName: result.user.displayName,
    photoURL: result.user.photoURL,
  };
};

export const logoutUser = async () => {
  await auth.signOut();
};

export const resetPassword = async (email: string) => {
  await auth.sendPasswordResetEmail(email);
};

export const onAuthChange = (callback: (user: RilaxyUser | null) => void) => {
  return auth.onIdTokenChanged((user) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
    } else {
      callback(null);
    }
  });
};
