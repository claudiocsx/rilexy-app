import * as Crypto from 'expo-crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

export async function generateKey(): Promise<string> {
  const keyBytes = Crypto.getRandomBytes(KEY_LENGTH);
  return Array.from(keyBytes)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function encrypt(text: string, keyHex: string): Promise<string> {
  const iv = Crypto.getRandomBytes(IV_LENGTH);
  const key = hexToBytes(keyHex);
  const data = new TextEncoder().encode(text);

  const combined = new Uint8Array(iv.length + data.length);
  combined.set(iv);
  combined.set(data, iv.length);

  const combinedHex = Array.from(combined)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combinedHex + keyHex
  );

  const encrypted = combinedHex + ':' + hash;
  return btoa(encrypted);
}

export async function decrypt(encryptedBase64: string, keyHex: string): Promise<string> {
  try {
    const encrypted = atob(encryptedBase64);
    const [combinedHex, hash] = encrypted.split(':');

    const hashCheck = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combinedHex + keyHex
    );

    if (hashCheck !== hash) {
      throw new Error('Integridade falhou — chave inválida ou mensagem adulterada');
    }

    const combined = hexToBytes(combinedHex);
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);
    return new TextDecoder().decode(data);
  } catch {
    return '[mensagem criptografada]';
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
