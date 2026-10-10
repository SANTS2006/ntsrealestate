import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';

// Backup file layout:
//   "RBK1" | 12-byte IV | AES-256-GCM ciphertext of the gzipped dump | 16-byte tag
//   "RBK0" | gzipped dump                                  (development, no key)
// The tag at the end authenticates the whole file: a damaged or tampered
// backup fails to decrypt instead of restoring wrong data.

export const MAGIC_ENCRYPTED = Buffer.from('RBK1');
export const MAGIC_PLAIN = Buffer.from('RBK0');
const TAG_LENGTH = 16;
const IV_LENGTH = 12;

export function keyFromHex(hex) {
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Buffer.from(hex, 'hex');
}

// Takes the raw (uncompressed) dump chunks written by `writeDump(write)` and
// produces the stored file. Returns { sizeBytes, encrypted }.
export async function writeBackupFile(filePath, key, produce) {
  const out = createWriteStream(filePath);
  const gzip = createGzip({ level: 6 });
  let cipher = null;
  let iv = null;
  if (key) {
    iv = randomBytes(IV_LENGTH);
    cipher = createCipheriv('aes-256-gcm', key, iv);
  }
  out.write(key ? MAGIC_ENCRYPTED : MAGIC_PLAIN);
  if (iv) out.write(iv);

  const stages = cipher ? [gzip, cipher, out] : [gzip, out];
  const done = pipeline(...stages);
  done.catch(() => {}); // surfaced through the awaits below
  // `write` waits for the buffer to drain, so memory stays flat however big the dump is.
  const write = async (chunk) => {
    if (!gzip.write(chunk)) await Promise.race([once(gzip, 'drain'), done]);
  };

  try {
    await produce(write);
    gzip.end();
    await done;
  } catch (err) {
    gzip.destroy();
    out.destroy();
    throw err;
  }
  // The GCM tag is only known once the cipher has finished.
  if (cipher) {
    const fh = await open(filePath, 'a');
    try { await fh.write(cipher.getAuthTag()); } finally { await fh.close(); }
  }
  const { size } = await stat(filePath);
  return { sizeBytes: size, encrypted: Boolean(key) };
}

// A readable stream of the original (uncompressed) dump text. Authentication
// failure surfaces as an error when the stream ends.
export async function openBackupFile(filePath, key) {
  const fh = await open(filePath, 'r');
  let magic;
  let size;
  try {
    ({ size } = await fh.stat());
    const head = Buffer.alloc(4);
    await fh.read(head, 0, 4, 0);
    magic = head;
    if (magic.equals(MAGIC_PLAIN)) {
      return createReadStream(filePath, { start: 4 }).pipe(createGunzip());
    }
    if (!magic.equals(MAGIC_ENCRYPTED)) throw new Error('Not a recognised backup file.');
    if (!key) throw new Error('This backup is encrypted but no BACKUP_ENCRYPTION_KEY is configured.');
    const iv = Buffer.alloc(IV_LENGTH);
    await fh.read(iv, 0, IV_LENGTH, 4);
    const tag = Buffer.alloc(TAG_LENGTH);
    await fh.read(tag, 0, TAG_LENGTH, size - TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const start = 4 + IV_LENGTH;
    const end = size - TAG_LENGTH - 1;
    if (end < start) throw new Error('Backup file is truncated.');
    const source = createReadStream(filePath, { start, end });
    const gunzip = createGunzip();
    source.on('error', (e) => decipher.destroy(e));
    decipher.on('error', (e) => gunzip.destroy(e));
    source.pipe(decipher).pipe(gunzip);
    return gunzip;
  } finally {
    await fh.close();
  }
}
