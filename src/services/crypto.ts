import { getRandomBytesAsync } from 'expo-crypto';
import nacl from 'tweetnacl';
import { Paths, File, Directory } from 'expo-file-system';
import { getSupabase } from './supabase';

const BUCKET = 'rilaxy-media';
const CACHE_DIR = 'rilaxy-decrypted';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function uint8ToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += B64[a >> 2];
    result += B64[((a & 3) << 4) | (b >> 4)];
    if (i + 1 >= bytes.length) { result += '=='; break; }
    result += B64[((b & 15) << 2) | (c >> 6)];
    if (i + 2 >= bytes.length) { result += '='; break; }
    result += B64[c & 63];
  }
  return result;
}

function base64ToUint8(base64: string): Uint8Array {
  const lookup: Record<string, number> = {};
  for (let i = 0; i < 64; i++) lookup[B64[i]] = i;
  const cleaned = base64.replace(/=+/g, '');
  const bytes = new Uint8Array(Math.floor(cleaned.length * 6 / 8));
  let pos = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = lookup[cleaned[i]];
    const b = lookup[cleaned[i + 1]];
    const c = lookup[cleaned[i + 2]];
    const d = lookup[cleaned[i + 3]];
    bytes[pos++] = (a << 2) | (b >> 4);
    if (c !== undefined) bytes[pos++] = ((b & 15) << 4) | (c >> 2);
    if (d !== undefined) bytes[pos++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

function getCacheDir(): Directory {
  return new Directory(Paths.cache, CACHE_DIR);
}

export function pathHash(path: string): string {
  let h = 0;
  for (let i = 0; i < path.length; i++) {
    h = ((h << 5) - h) + path.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function cachedFile(path: string, mimeType: string): File {
  const ext = mimeType.startsWith('video/') ? 'mp4' : 'jpg';
  return new File(getCacheDir(), `${pathHash(path)}.${ext}`);
}

export function extractStoragePath(mediaUrl: string): string {
  const marker = '/public/';
  const idx = mediaUrl.indexOf(marker);
  if (idx !== -1) {
    const afterBucket = mediaUrl.slice(idx + marker.length);
    const slashIdx = afterBucket.indexOf('/');
    if (slashIdx !== -1) return afterBucket.slice(slashIdx + 1);
  }
  return mediaUrl;
}

export async function generateMediaKey(): Promise<{ key: string; iv: string }> {
  const key = await getRandomBytesAsync(32);
  const iv = await getRandomBytesAsync(24);
  return {
    key: uint8ToBase64(key),
    iv: uint8ToBase64(iv),
  };
}

export async function encryptMedia(
  uri: string,
  keyBase64: string,
  ivBase64: string,
): Promise<Uint8Array> {
  const file = new File(uri);
  const data = await file.bytes();
  const key = base64ToUint8(keyBase64);
  const nonce = base64ToUint8(ivBase64);
  const encrypted = nacl.secretbox(data, nonce, key);
  if (!encrypted) throw new Error('Falha na criptografia');
  return encrypted;
}

export async function decryptAndCache(
  mediaUrl: string,
  keyBase64: string | null | undefined,
  ivBase64: string | null | undefined,
  mimeType: string,
): Promise<string | null> {
  if (!keyBase64 || !ivBase64) return mediaUrl;

  const cache = cachedFile(mediaUrl, mimeType);
  if (cache.exists) return cache.uri;

  const dir = getCacheDir();
  if (!dir.exists) dir.create({ intermediates: true });

  const supabase = getSupabase();
  const storagePath = extractStoragePath(mediaUrl);
  const { data: blob, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error || !blob) {
    console.error('Download encrypted blob failed:', error);
    return mediaUrl;
  }

  async function blobToArrayBuffer(b: Blob): Promise<ArrayBuffer> {
    try {
      return await new Response(b).arrayBuffer();
    } catch {
      return b.arrayBuffer();
    }
  }

  const encrypted = new Uint8Array(await blobToArrayBuffer(blob));
  const key = base64ToUint8(keyBase64);
  const nonce = base64ToUint8(ivBase64);
  const decrypted = nacl.secretbox.open(encrypted, nonce, key);
  if (!decrypted) {
    console.error('Decryption failed', {
      blobSize: blob.size,
      encryptedLen: encrypted.length,
      keyLen: key.length,
      nonceLen: nonce.length,
      storagePath,
    });
    return mediaUrl;
  }

  cache.write(decrypted);
  return cache.uri;
}