import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_HASH_KEY = 'app_pin_hash';
const LOCKED_KEY = 'app_locked';
const FAILED_ATTEMPTS_KEY = 'app_failed_attempts';
const LOCKOUT_UNTIL_KEY = 'app_lockout_until';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30000;

let lockedCache = false;

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export async function isPinSetup(): Promise<boolean> {
  try {
    const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
    return !!hash;
  } catch {
    return false;
  }
}

export async function setupPin(pin: string): Promise<boolean> {
  try {
    const hash = await hashPin(pin);
    await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
    return true;
  } catch {
    return false;
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
    if (!storedHash) return false;
    const inputHash = await hashPin(pin);
    return storedHash === inputHash;
  } catch {
    return false;
  }
}

export async function removePin(): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(PIN_HASH_KEY);
    await SecureStore.deleteItemAsync(FAILED_ATTEMPTS_KEY);
    await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  const valid = await verifyPin(oldPin);
  if (!valid) return false;
  return setupPin(newPin);
}

export async function lockApp(): Promise<void> {
  lockedCache = true;
  try {
    await SecureStore.setItemAsync(LOCKED_KEY, 'true');
  } catch {}
}

export async function unlockApp(): Promise<void> {
  lockedCache = false;
  try {
    await SecureStore.deleteItemAsync(LOCKED_KEY);
    await SecureStore.deleteItemAsync(FAILED_ATTEMPTS_KEY);
    await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
  } catch {}
}

export async function isLocked(): Promise<boolean> {
  if (lockedCache) return true;
  try {
    const val = await SecureStore.getItemAsync(LOCKED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export function getLockedCache(): boolean {
  return lockedCache;
}

export function setLockedCache(val: boolean): void {
  lockedCache = val;
}

async function getFailedAttempts(): Promise<number> {
  try {
    const val = await SecureStore.getItemAsync(FAILED_ATTEMPTS_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch { return 0; }
}

async function incrementFailedAttempts(): Promise<number> {
  const current = await getFailedAttempts();
  const next = current + 1;
  await SecureStore.setItemAsync(FAILED_ATTEMPTS_KEY, String(next));
  if (next >= MAX_ATTEMPTS) {
    const until = Date.now() + LOCKOUT_DURATION_MS;
    await SecureStore.setItemAsync(LOCKOUT_UNTIL_KEY, String(until));
  }
  return next;
}

export async function getLockoutRemaining(): Promise<number> {
  try {
    const val = await SecureStore.getItemAsync(LOCKOUT_UNTIL_KEY);
    if (!val) return 0;
    const until = parseInt(val, 10);
    const remaining = until - Date.now();
    if (remaining <= 0) {
      await SecureStore.deleteItemAsync(FAILED_ATTEMPTS_KEY);
      await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
      return 0;
    }
    return remaining;
  } catch { return 0; }
}

export async function authenticateWithPin(pin: string): Promise<boolean> {
  const lockout = await getLockoutRemaining();
  if (lockout > 0) return false;

  const valid = await verifyPin(pin);
  if (!valid) {
    await incrementFailedAttempts();
    return false;
  }
  return true;
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear Rilaxy',
      cancelLabel: 'Usar PIN',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function canUseBiometrics(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}
