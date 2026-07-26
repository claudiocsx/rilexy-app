import {
  uint8ToBase64,
  base64ToUint8,
  pathHash,
  extractStoragePath,
  generateMediaKey,
  encryptMedia,
  decryptAndCache,
} from '../../src/services/crypto';

describe('crypto service - base64', () => {
  it('uint8ToBase64 and base64ToUint8 roundtrip', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111, 32, 240, 159, 152, 137]);
    const b64 = uint8ToBase64(original);
    expect(typeof b64).toBe('string');
    const decoded = base64ToUint8(b64);
    expect(decoded).toEqual(original);
  });

  it('uint8ToBase64 handles empty array', () => {
    expect(uint8ToBase64(new Uint8Array(0))).toBe('');
  });

  it('uint8ToBase64 handles single byte', () => {
    const result = uint8ToBase64(new Uint8Array([65]));
    expect(result).toBe('QQ==');
  });

  it('uint8ToBase64 handles two bytes', () => {
    const result = uint8ToBase64(new Uint8Array([65, 66]));
    expect(result).toBe('QUI=');
  });

  it('base64ToUint8 handles empty string', () => {
    expect(base64ToUint8('')).toEqual(new Uint8Array(0));
  });

  it('base64ToUint8 handles padding correctly', () => {
    const result = base64ToUint8('QQ==');
    expect(result).toEqual(new Uint8Array([65]));
  });
});

describe('crypto service - pathHash', () => {
  it('returns a 32-char hex string', () => {
    const hash = pathHash('chats/abc123/image.jpg');
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces same hash for same input', () => {
    expect(pathHash('test/path')).toBe(pathHash('test/path'));
  });

  it('produces different hashes for different inputs', () => {
    expect(pathHash('path/a')).not.toBe(pathHash('path/b'));
  });

  it('handles empty string', () => {
    const hash = pathHash('');
    expect(hash).toHaveLength(32);
  });
});

describe('crypto service - extractStoragePath', () => {
  it('extracts path from full Supabase URL', () => {
    const url = 'https://kojmnryyhzxuyxarlvse.supabase.co/storage/v1/object/public/rilaxy-media/chats/abc/image.jpg';
    expect(extractStoragePath(url)).toBe('chats/abc/image.jpg');
  });

  it('returns original URL when no public marker found', () => {
    const url = 'https://example.com/file.jpg';
    expect(extractStoragePath(url)).toBe(url);
  });

  it('handles URLs without path after bucket', () => {
    const url = 'https://supabase.co/storage/v1/object/public/rilaxy-media/';
    expect(extractStoragePath(url)).toBe('');
  });

  it('handles nested paths', () => {
    const url = 'https://supabase.co/storage/v1/object/public/rilaxy-media/posts/abc/media_0.mp4';
    expect(extractStoragePath(url)).toBe('posts/abc/media_0.mp4');
  });
});

describe('crypto service - generateMediaKey', () => {
  it('returns key and iv as base64 strings', async () => {
    const result = await generateMediaKey();
    expect(result.key).toBeTruthy();
    expect(result.iv).toBeTruthy();
    expect(typeof result.key).toBe('string');
    expect(typeof result.iv).toBe('string');
  });

  it('generates different keys each call', async () => {
    const [a, b] = await Promise.all([generateMediaKey(), generateMediaKey()]);
    expect(a.key).not.toBe(b.key);
  });
});

describe('crypto service - encryptMedia', () => {
  it('returns encrypted bytes', async () => {
    const { key, iv } = await generateMediaKey();
    const encrypted = await encryptMedia('file://mock/test-image.jpg', key, iv);
    expect(encrypted).toBeInstanceOf(Uint8Array);
    expect(encrypted.length).toBeGreaterThan(0);
  });
});

describe('crypto service - decryptAndCache', () => {
  it('returns original URL when no key provided', async () => {
    const result = await decryptAndCache('https://example.com/img.jpg', null, null, 'image/jpeg');
    expect(result).toBe('https://example.com/img.jpg');
  });

  it('returns original URL when key present but iv missing', async () => {
    const result = await decryptAndCache('https://example.com/img.jpg', 'base64key', null, 'image/jpeg');
    expect(result).toBe('https://example.com/img.jpg');
  });

  it('returns cache URI on successful decrypt', async () => {
    const result = await decryptAndCache('https://supabase.co/storage/v1/object/public/rilaxy-media/test.jpg', 'aGVsbG8=', 'd29ybGQ=', 'image/jpeg');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
