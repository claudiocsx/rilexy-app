import { findOrCreateChat } from '../../src/services/chat';

const firebase = require('firebase/compat/app');
const { db } = require('../../src/services/firebase');

describe('chat service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a deterministic chat ID from sorted participant UIDs', async () => {
    const chatId = await findOrCreateChat('user_a', 'user_b');
    expect(chatId).toBe('user_a_user_b');
  });

  it('always sorts IDs alphabetically regardless of argument order', async () => {
    const chatId1 = await findOrCreateChat('user_a', 'user_b');
    const chatId2 = await findOrCreateChat('user_b', 'user_a');
    expect(chatId1).toBe(chatId2);
  });

  it('creates a new chat document when one does not exist', async () => {
    const docGet = jest.fn(async () => ({ exists: false, data: () => ({}), id: 'user_a_user_b' }));
    const docSet = jest.fn(async () => {});
    const docRef = { get: docGet, set: docSet, update: jest.fn() };
    const collectionSpy = jest.fn(() => ({ doc: jest.fn(() => docRef) }));
    db.collection.mockImplementation(collectionSpy);

    await findOrCreateChat('user_a', 'user_b');
    expect(docSet).toHaveBeenCalled();
    const setCall = docSet.mock.calls[0][0];
    expect(setCall.participants).toEqual(['user_a', 'user_b']);
    expect(setCall.name).toBeNull();
  });

  it('updates lastMessageTime for existing chat', async () => {
    const docUpdate = jest.fn(async () => {});
    const docGet = jest.fn(async () => ({
      exists: true,
      data: () => ({ participants: ['user_a', 'user_b'], hiddenFor: [] }),
      id: 'user_a_user_b',
    }));
    const docRef = { get: docGet, update: docUpdate, set: jest.fn() };
    const collectionSpy = jest.fn(() => ({ doc: jest.fn(() => docRef) }));
    db.collection.mockImplementation(collectionSpy);

    await findOrCreateChat('user_a', 'user_b');
    expect(docUpdate).toHaveBeenCalledWith(expect.objectContaining({
      lastMessageTime: expect.any(Date),
    }));
  });

  it('re-adds user to participants if removed', async () => {
    const docUpdate = jest.fn(async () => {});
    const docGet = jest.fn(async () => ({
      exists: true,
      data: () => ({ participants: ['user_b'], hiddenFor: [] }),
      id: 'user_a_user_b',
    }));
    const docRef = { get: docGet, update: docUpdate, set: jest.fn() };
    db.collection.mockImplementation(() => ({ doc: jest.fn(() => docRef) }));

    await findOrCreateChat('user_a', 'user_b');
    expect(docUpdate).toHaveBeenCalled();
  });

  it('removes user from hiddenFor when reopening chat', async () => {
    const docUpdate = jest.fn(async () => {});
    const docGet = jest.fn(async () => ({
      exists: true,
      data: () => ({ participants: ['user_a', 'user_b'], hiddenFor: ['user_a'] }),
      id: 'user_a_user_b',
    }));
    const docRef = { get: docGet, update: docUpdate, set: jest.fn() };
    db.collection.mockImplementation(() => ({ doc: jest.fn(() => docRef) }));

    await findOrCreateChat('user_a', 'user_b');
    expect(docUpdate).toHaveBeenCalledWith(expect.objectContaining({
      hiddenFor: expect.any(Array),
    }));
  });
});
