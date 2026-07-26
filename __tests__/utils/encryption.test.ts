import { generateKey, encrypt, decrypt } from '../../src/utils/encryption';

describe('encryption utils', () => {
  it('generateKey returns a hex string of 64 chars (32 bytes)', async () => {
    const key = await generateKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('encrypt and decrypt roundtrip succeeds', async () => {
    const key = await generateKey();
    const original = 'Hello, Rilaxy! Mensagem secreta.';
    const encrypted = await encrypt(original, key);
    expect(encrypted).toBeTruthy();
    expect(typeof encrypted).toBe('string');

    const decrypted = await decrypt(encrypted, key);
    expect(decrypted).toBe(original);
  });

  it('decrypt returns error placeholder with wrong key', async () => {
    const key = await generateKey();
    const wrongKey = await generateKey();
    const encrypted = await encrypt('test data', key);
    const decrypted = await decrypt(encrypted, wrongKey);
    expect(decrypted).toBe('[mensagem criptografada]');
  });

  it('decrypt returns error placeholder for tampered data', async () => {
    const key = await generateKey();
    const encrypted = await encrypt('test data', key);
    const tampered = encrypted.slice(0, -5) + 'XXXXX';
    const decrypted = await decrypt(tampered, key);
    expect(decrypted).toBe('[mensagem criptografada]');
  });

  it('encrypt handles empty string', async () => {
    const key = await generateKey();
    const encrypted = await encrypt('', key);
    const decrypted = await decrypt(encrypted, key);
    expect(decrypted).toBe('');
  });

  it('encrypt handles special characters and unicode', async () => {
    const key = await generateKey();
    const original = 'Olá, mundo! 日本語 émoji 🎉 test@#$%';
    const encrypted = await encrypt(original, key);
    const decrypted = await decrypt(encrypted, key);
    expect(decrypted).toBe(original);
  });

  it('decrypt with empty string returns placeholder', async () => {
    const result = await decrypt('', 'invalid');
    expect(result).toBe('[mensagem criptografada]');
  });
});
