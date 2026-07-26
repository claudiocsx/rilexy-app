import { getRandomBytesAsync } from 'expo-crypto';

export async function generateId(length = 16): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = await getRandomBytesAsync(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}
