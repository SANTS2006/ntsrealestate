// End-to-end encryption for chat, built only on the browser's standard Web
// Crypto API. Nothing here ever sends a key or plaintext anywhere: the server
// is handed ciphertext, public keys, and keys that are themselves encrypted.
//
//  Identity   ECDH P-256 key pair per person. The private half is stored on
//             the server only AFTER being encrypted (AES-GCM) with a key
//             derived (PBKDF2-SHA256) from a chat passphrase the server never
//             sees; a new device restores it by entering the passphrase.
//  Room key   One AES-256-GCM key per conversation, generated in a member's
//             browser. It is "wrapped" separately for every member: encrypted
//             with a key both sides can derive (ECDH -> HKDF) from the
//             wrapper's private key and the member's public key.
//  Messages   AES-GCM with the room key; the room id and sender are bound in
//             as authenticated data, so a message cannot be moved to another
//             room or attributed to someone else without failing to decrypt.
//  Files      Each file gets its own random AES-GCM key; that key rides inside
//             the (encrypted) message, the server only holds the ciphertext.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

const EC = { name: 'ECDH', namedCurve: 'P-256' };
const WRAP_INFO = enc.encode('nts-chat-wrap-v1');
export const DEFAULT_KDF_ITERATIONS = 250_000;

// ── encoding helpers ────────────────────────────────────────────────────

export function toB64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function fromB64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// ── identity key pair ───────────────────────────────────────────────────

export async function generateIdentity() {
  return subtle.generateKey(EC, true, ['deriveBits']);
}

// A canonical, comparable string for a public key (also what the server holds).
export async function exportPublicKey(publicKey) {
  const { kty, crv, x, y } = await subtle.exportKey('jwk', publicKey);
  return JSON.stringify({ crv, kty, x, y });
}

export function importPublicKey(text) {
  return subtle.importKey('jwk', JSON.parse(text), EC, true, []);
}

async function passphraseKey(passphrase, salt, iterations) {
  const base = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Encrypts the private key under the passphrase, for storing on the server.
export async function protectPrivateKey(privateKey, passphrase, iterations = DEFAULT_KDF_ITERATIONS) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const pkcs8 = await subtle.exportKey('pkcs8', privateKey);
  const key = await passphraseKey(passphrase, salt, iterations);
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, pkcs8);
  return { encryptedPrivateKey: toB64(encrypted), keySalt: toB64(salt), keyIv: toB64(iv), kdfIterations: iterations };
}

// Restores the private key from the server's copy. Throws on a wrong
// passphrase. The returned key can be USED but not exported again.
export async function restorePrivateKey(bundle, passphrase) {
  const key = await passphraseKey(passphrase, fromB64(bundle.keySalt), bundle.kdfIterations);
  const pkcs8 = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(bundle.keyIv) }, key, fromB64(bundle.encryptedPrivateKey));
  return subtle.importKey('pkcs8', pkcs8, EC, false, ['deriveBits']);
}

// Short, human-comparable fingerprint of a public key — two people can read
// these to each other to confirm nobody swapped a key in between.
export async function fingerprint(publicKeyText) {
  const digest = new Uint8Array(await subtle.digest('SHA-256', enc.encode(publicKeyText)));
  const hex = [...digest.slice(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex.match(/.{1,4}/g).join(' ');
}

// ── room keys ───────────────────────────────────────────────────────────

export function generateRoomKey() {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function sharedWrapKey(myPrivateKey, theirPublicKeyText, usages) {
  const theirPublic = await importPublicKey(theirPublicKeyText);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: theirPublic }, myPrivateKey, 256);
  const hkdf = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: WRAP_INFO },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

// Encrypts the room key so only `memberPublicKeyText`'s owner can open it.
export async function wrapRoomKey(roomKey, myPrivateKey, myPublicKeyText, memberPublicKeyText) {
  const iv = randomBytes(12);
  const wrapKey = await sharedWrapKey(myPrivateKey, memberPublicKeyText, ['encrypt']);
  const raw = await subtle.exportKey('raw', roomKey);
  const wrapped = await subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, raw);
  return { wrappedKey: toB64(wrapped), wrapIv: toB64(iv), wrapperPublicKey: myPublicKeyText };
}

export async function unwrapRoomKey({ wrappedKey, wrapIv, wrapperPublicKey }, myPrivateKey) {
  const wrapKey = await sharedWrapKey(myPrivateKey, wrapperPublicKey, ['decrypt']);
  const raw = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(wrapIv) }, wrapKey, fromB64(wrappedKey));
  // Extractable (in memory only) so this member can re-wrap it for people who join later.
  return subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

// ── messages ────────────────────────────────────────────────────────────

const aad = (roomId, senderRef) => enc.encode(`${roomId}|${senderRef}`);

export async function encryptPayload(roomKey, payload, roomId, senderRef) {
  const iv = randomBytes(12);
  const data = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(roomId, senderRef) },
    roomKey,
    enc.encode(JSON.stringify(payload)),
  );
  return { ciphertext: toB64(data), iv: toB64(iv) };
}

export async function decryptPayload(roomKey, { ciphertext, iv }, roomId, senderRef) {
  const data = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(iv), additionalData: aad(roomId, senderRef) },
    roomKey,
    fromB64(ciphertext),
  );
  return JSON.parse(dec.decode(data));
}

// ── files ───────────────────────────────────────────────────────────────

// Encrypts bytes with a fresh one-off key. Returns the ciphertext to upload
// plus the key and IV, which must be placed inside an encrypted message.
export async function encryptFile(bytes) {
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = randomBytes(12);
  const cipher = await subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { cipher, key: toB64(await subtle.exportKey('raw', key)), iv: toB64(iv) };
}

export async function decryptFile(cipher, keyB64, ivB64) {
  const key = await subtle.importKey('raw', fromB64(keyB64), 'AES-GCM', false, ['decrypt']);
  return subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, cipher);
}
