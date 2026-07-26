import { generateId } from '../../src/utils/generateId';

describe('generateId', () => {
  it('returns a string of default length 16', async () => {
    const id = await generateId();
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it('returns a string of specified length', async () => {
    const id = await generateId(32);
    expect(id).toHaveLength(32);
  });

  it('returns a string of length 1 when requested', async () => {
    const id = await generateId(1);
    expect(id).toHaveLength(1);
  });

  it('generates unique IDs', async () => {
    const ids = await Promise.all(Array.from({ length: 20 }, () => generateId(32)));
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });

  it('only uses alphanumeric characters', async () => {
    const id = await generateId(1000);
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});
