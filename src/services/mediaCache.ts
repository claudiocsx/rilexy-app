import { Paths, File, Directory } from 'expo-file-system';

const DOWNLOADING = new Map<string, Promise<string>>();

function urlHash(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) - h) + url.charCodeAt(i);
    h |= 0;
  }
  const ext = url.match(/\.(jpe?g|png|gif|webp|mp4|mov|avi)$/i)?.[0] || '.jpg';
  return Math.abs(h).toString(36) + ext;
}

function cachedFile(url: string): File {
  return new File(Paths.cache, 'rilaxy-media', urlHash(url));
}

function cacheDir(): Directory {
  return new Directory(Paths.cache, 'rilaxy-media');
}

async function ensureDir(): Promise<void> {
  const dir = cacheDir();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
}

export async function getCachedUri(url: string): Promise<string | null> {
  const file = cachedFile(url);
  try {
    if (file.exists) {
      return file.uri;
    }
  } catch {}
  return null;
}

export async function downloadAndCache(url: string): Promise<string> {
  if (DOWNLOADING.has(url)) {
    return DOWNLOADING.get(url)!;
  }

  const promise = (async () => {
    await ensureDir();
    const dest = cachedFile(url);
    const result = await File.downloadFileAsync(url, dest, { idempotent: true });
    return result.uri;
  })();

  DOWNLOADING.set(url, promise);

  try {
    return await promise;
  } finally {
    DOWNLOADING.delete(url);
  }
}

export async function getMediaUri(url: string): Promise<string> {
  const cached = await getCachedUri(url);
  if (cached) return cached;
  return downloadAndCache(url);
}

export async function clearCache(): Promise<void> {
  const dir = cacheDir();
  if (dir.exists) {
    const entries = dir.list();
    await Promise.all(entries.map((e) => {
      if (e instanceof File) {
        e.delete();
      } else {
        (e as Directory).delete();
      }
    }));
  }
}

export async function getCacheSize(): Promise<number> {
  const dir = cacheDir();
  if (!dir.exists) return 0;
  const info = dir.info();
  return info.size ?? 0;
}
