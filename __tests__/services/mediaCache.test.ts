import { getCachedUri, downloadAndCache, getMediaUri, clearCache, getCacheSize } from '../../src/services/mediaCache';

describe('mediaCache service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCachedUri', () => {
    it('returns null for uncached URL', async () => {
      const result = await getCachedUri('https://example.com/image.jpg');
      expect(result).toBeNull();
    });

    it('returns uri for cached URL', async () => {
      const { File } = require('expo-file-system');
      File.mockImplementationOnce(() => ({
        exists: true,
        uri: 'file://mock/cache/rilaxy-media/abc123.jpg',
      }));
      const result = await getCachedUri('https://example.com/image.jpg');
      expect(result).toContain('file://');
    });
  });

  describe('downloadAndCache', () => {
    it('downloads and caches returning a file URI', async () => {
      const result = await downloadAndCache('https://example.com/image.jpg');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('deduplicates concurrent downloads for same URL', async () => {
      const [a, b] = await Promise.all([
        downloadAndCache('https://example.com/same.jpg'),
        downloadAndCache('https://example.com/same.jpg'),
      ]);
      expect(a).toBe(b);
    });
  });

  describe('getMediaUri', () => {
    it('returns cached URI when available', async () => {
      const { File } = require('expo-file-system');
      File.mockImplementationOnce(() => ({
        exists: true,
        uri: 'file://mock/cached/file.jpg',
      }));
      const result = await getMediaUri('https://example.com/img.jpg');
      expect(result).toContain('file://mock/cached');
    });

    it('downloads when not cached', async () => {
      const result = await getMediaUri('https://example.com/uncached.jpg');
      expect(result).toBeTruthy();
    });
  });

  describe('clearCache', () => {
    it('completes without error', async () => {
      await expect(clearCache()).resolves.toBeUndefined();
    });
  });

  describe('getCacheSize', () => {
    it('returns a number', async () => {
      const size = await getCacheSize();
      expect(typeof size).toBe('number');
    });
  });
});
