import { generateMediaKey, encryptMedia, decryptAndCache, extractStoragePath, pathHash } from '../../src/services/crypto';

describe('crypto integration - public API', () => {
  it('generateMediaKey returns key and iv as base64 strings', async () => {
    const { key, iv } = await generateMediaKey();
    expect(typeof key).toBe('string');
    expect(typeof iv).toBe('string');
    expect(key.length).toBeGreaterThan(0);
    expect(iv.length).toBeGreaterThan(0);
  });

  it('pathHash returns a consistent 32-char hex string', () => {
    const hash1 = pathHash('https://example.com/img.jpg');
    const hash2 = pathHash('https://example.com/img.jpg');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{32}$/);
  });

  it('encryptMedia produces different output for same input (due to nonce)', async () => {
    const { key, iv: iv1 } = await generateMediaKey();
    const { iv: iv2 } = await generateMediaKey();
    const enc1 = await encryptMedia('file://mock/test.bin', key, iv1);
    const enc2 = await encryptMedia('file://mock/test.bin', key, iv2);
    expect(enc1).not.toEqual(enc2);
  });

  it('decryptAndCache returns mediaUrl when no key', async () => {
    const result = await decryptAndCache('https://example.com/img.jpg', null, null, 'image/jpeg');
    expect(result).toBe('https://example.com/img.jpg');
  });
});

describe('extractStoragePath edge cases', () => {
  it('handles URL with query params', () => {
    const url = 'https://supabase.co/storage/v1/object/public/rilaxy-media/img.jpg?t=123';
    expect(extractStoragePath(url)).toBe('img.jpg');
  });

  it('handles deeply nested paths', () => {
    const url = 'https://supabase.co/storage/v1/object/public/rilaxy-media/a/b/c/d/e.jpg';
    expect(extractStoragePath(url)).toBe('a/b/c/d/e.jpg');
  });

  it('returns full URL when no bucket marker', () => {
    const url = 'https://cdn.example.com/images/photo.jpg';
    expect(extractStoragePath(url)).toBe(url);
  });
});
