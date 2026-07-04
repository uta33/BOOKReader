// IndexedDB store for generated MP3 audio (base64).
//
// Keys are `bookId:sentenceId:voice` — playback speed is applied client-side
// via HTMLAudioElement.playbackRate, so clips synthesized once stay valid for
// every speed setting. Saved clips play offline at any time.

const DB_NAME = 'bookreader-audio';
const STORE = 'clips';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export function clipKey(bookId: string, sentenceId: string, voice: string): string {
  return `${bookId}:${sentenceId}:${voice}`;
}

export async function getClip(key: string): Promise<string | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function putClip(key: string, base64: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(base64, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Count saved clips for a book (any voice). */
export async function countClipsForBook(bookId: string): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const range = IDBKeyRange.bound(`${bookId}:`, `${bookId}:￿`);
    const req = tx.objectStore(STORE).count(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteClipsForBook(bookId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const range = IDBKeyRange.bound(`${bookId}:`, `${bookId}:￿`);
    tx.objectStore(STORE).delete(range);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Ask the browser to make our storage durable (prevents automatic eviction of
 * saved audio under storage pressure). Safe to call repeatedly.
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* unsupported browser */
  }
  return false;
}

export interface StorageInfo {
  usageMB: number;
  quotaMB: number;
  persisted: boolean;
}

export async function getStorageInfo(): Promise<StorageInfo | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const est = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    return {
      usageMB: (est.usage ?? 0) / (1024 * 1024),
      quotaMB: (est.quota ?? 0) / (1024 * 1024),
      persisted,
    };
  } catch {
    return null;
  }
}
