// Remembers the unlocked chat identity on THIS device so the passphrase is
// asked for once per device, not every visit. The private key is stored as a
// non-extractable CryptoKey: scripts on the page can use it but never read its
// bytes, and it cannot be copied out of the browser. Signing out clears it.
const DB = 'nts-chat';
const STORE = 'identity';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(result?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function saveIdentity(actorRef, identity) {
  try {
    await run('readwrite', (s) => s.put(identity, actorRef));
  } catch {
    // Storage unavailable (private mode): the passphrase is just asked again next visit.
  }
}

export async function loadIdentity(actorRef) {
  try {
    return (await run('readonly', (s) => s.get(actorRef))) ?? null;
  } catch {
    return null;
  }
}

export async function clearIdentity(actorRef) {
  try {
    await run('readwrite', (s) => s.delete(actorRef));
  } catch {
    // ignore
  }
}
