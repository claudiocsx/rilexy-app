import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { initializeAuth, getReactNativePersistence } from '@firebase/auth/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = firebase.initializeApp(firebaseConfig);

// Initialize Auth with React Native AsyncStorage persistence BEFORE compat wrapper.
// The default RN build uses require('react-native').AsyncStorage which was removed
// in RN 0.72+, so we must supply our own AsyncStorage-backed persistence here.
initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// firebase.auth() now returns the compat wrapper around the already-initialized
// auth instance that uses AsyncStorage for persistence.
const auth = firebase.auth();

export const db = firebase.firestore();
export { auth };
export default firebase;