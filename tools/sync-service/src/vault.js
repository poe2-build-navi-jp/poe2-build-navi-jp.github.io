// This module never sends the recovery code or the encryption key to the server.
const encoder = new TextEncoder();
export const SYNC_LIMIT = 2 * 1024 * 1024;
export const base64url = bytes =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
export function unbase64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value))
    throw Error('Invalid encoding');
  return Uint8Array.from(
    atob(value.replaceAll('-', '+').replaceAll('_', '/')),
    c => c.charCodeAt(0)
  );
}
export async function digest(value) {
  return base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
  );
}
export function newSyncCode() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
export async function syncKeys(code) {
  const raw = unbase64url(code.trim());
  if (raw.length !== 32) throw Error('Invalid recovery code');
  const master = await crypto.subtle.importKey('raw', raw, 'HKDF', false, [
    'deriveBits',
    'deriveKey',
  ]);
  const params = purpose => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: encoder.encode('poe2-build-navi-sync-v1'),
    info: encoder.encode(purpose),
  });
  const key = await crypto.subtle.deriveKey(
    params('encryption'),
    master,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const token = base64url(
    new Uint8Array(
      await crypto.subtle.deriveBits(params('authorization'), master, 256)
    )
  );
  return { key, token, room: await digest('poe2-vault:' + token) };
}
export async function encryptVault(value, keys) {
  const bytes = encoder.encode(JSON.stringify(value));
  if (bytes.length > SYNC_LIMIT) throw Error('SYNC_CAPACITY');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: encoder.encode(keys.room) },
      keys.key,
      bytes
    )
  );
  // Avoid spreading a large snapshot onto the JavaScript call stack.
  let binary = '';
  for (let i = 0; i < encrypted.length; i += 16384)
    binary += String.fromCharCode(...encrypted.subarray(i, i + 16384));
  return {
    iv: base64url(iv),
    ciphertext: btoa(binary)
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, ''),
  };
}
export async function decryptVault(envelope, keys) {
  if (
    !envelope ||
    typeof envelope.ciphertext !== 'string' ||
    envelope.ciphertext.length > 2800000 ||
    envelope.iv?.length !== 16
  )
    throw Error('Invalid encrypted snapshot');
  const bytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: unbase64url(envelope.iv),
      additionalData: encoder.encode(keys.room),
    },
    keys.key,
    unbase64url(envelope.ciphertext)
  );
  if (bytes.byteLength > SYNC_LIMIT) throw Error('SYNC_CAPACITY');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
