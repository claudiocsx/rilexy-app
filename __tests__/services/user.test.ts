import { searchUsers, searchUsersByEmail } from '../../src/services/user';

const { db } = require('../../src/services/firebase');

describe('user service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchUsers', () => {
    it('returns empty array for empty query', async () => {
      const result = await searchUsers('');
      expect(result).toEqual([]);
    });

    it('returns empty array for whitespace-only query', async () => {
      const result = await searchUsers('   ');
      expect(result).toEqual([]);
    });

    it('queries firestore with range-based prefix search', async () => {
      const result = await searchUsers('Ana');
      expect(db.collection).toHaveBeenCalledWith('users');
      expect(result).toBeInstanceOf(Array);
    });

    it('returns mapped user profiles', async () => {
      db.collection.mockImplementationOnce(() => ({
        orderBy: jest.fn(() => ({
          where: jest.fn(() => ({
            where: jest.fn(() => ({
              get: jest.fn(async () => ({
                docs: [
                  { id: 'uid1', data: () => ({ displayName: 'Ana', displayNameLower: 'ana', email: 'ana@test.com' }) },
                  { id: 'uid2', data: () => ({ displayName: 'Anacleto', displayNameLower: 'anacleto', email: 'anacleto@test.com' }) },
                ],
              })),
            })),
          })),
        })),
      }));

      const result = await searchUsers('Ana');
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe('uid1');
    });
  });

  describe('searchUsersByEmail', () => {
    it('returns empty array for empty query', async () => {
      const result = await searchUsersByEmail('');
      expect(result).toEqual([]);
    });

    it('queries firestore for exact email match', async () => {
      await searchUsersByEmail('ana@rilaxy.com');
      expect(db.collection).toHaveBeenCalledWith('users');
    });

    it('returns mapped user profiles', async () => {
      db.collection.mockImplementationOnce(() => ({
        where: jest.fn(() => ({
          get: jest.fn(async () => ({
            docs: [{ id: 'uid1', data: () => ({ displayName: 'Ana', email: 'ana@rilaxy.com' }) }],
          })),
        })),
      }));

      const result = await searchUsersByEmail('ana@rilaxy.com');
      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('uid1');
    });
  });
});
