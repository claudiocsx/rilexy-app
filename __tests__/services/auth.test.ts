import { registerUser, loginUser, logoutUser, resetPassword, onAuthChange } from '../../src/services/auth';

const firebase = require('firebase/compat/app');
const { auth, db } = require('../../src/services/firebase');

describe('auth service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    it('creates user with email, password, and displayName', async () => {
      const user = await registerUser('test@rilaxy.com', 'password123', 'Test User');
      expect(user).toMatchObject({
        uid: expect.any(String),
        email: 'test@rilaxy.com',
        displayName: 'Test User',
      });
      expect(auth.createUserWithEmailAndPassword).toHaveBeenCalledWith('test@rilaxy.com', 'password123');
    });

    it('writes user document to Firestore', async () => {
      await registerUser('test@rilaxy.com', 'password123', 'Test User');
      expect(db.collection).toHaveBeenCalledWith('users');
    });

    it('accepts optional invite code', async () => {
      const user = await registerUser('invited@rilaxy.com', 'password123', 'Invited User', 'CONVITE-123');
      expect(user).toBeTruthy();
    });
  });

  describe('loginUser', () => {
    it('calls signInWithEmailAndPassword with credentials', async () => {
      const user = await loginUser('test@rilaxy.com', 'password123');
      expect(auth.signInWithEmailAndPassword).toHaveBeenCalledWith('test@rilaxy.com', 'password123');
      expect(user).toMatchObject({
        uid: 'test-uid',
        email: 'test@rilaxy.com',
      });
    });

    it('throws when signIn returns no user', async () => {
      auth.signInWithEmailAndPassword.mockImplementationOnce(async () => ({ user: null }));
      await expect(loginUser('test@rilaxy.com', 'password123')).rejects.toThrow('Falha ao autenticar');
    });
  });

  describe('logoutUser', () => {
    it('calls auth.signOut', async () => {
      await logoutUser();
      expect(auth.signOut).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('calls sendPasswordResetEmail with email', async () => {
      await resetPassword('test@rilaxy.com');
      expect(auth.sendPasswordResetEmail).toHaveBeenCalledWith('test@rilaxy.com');
    });
  });

  describe('onAuthChange', () => {
    it('registers an id-token change listener', () => {
      const callback = jest.fn();
      const unsubscribe = onAuthChange(callback);
      expect(auth.onIdTokenChanged).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
