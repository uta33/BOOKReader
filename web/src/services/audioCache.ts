// IndexedDB store for generated narration audio.
//
// v2: audio is stored per CHUNK (a ~400-char group of sentences synthesized
// as one continuous utterance) together with its per-sentence timepoints.
// Keys are `bookId:chunkId:voice` — playback speed is applied client-side via
// HTMLAudioElement.playbackRate, so chunks synthesized once stay valid for
// every speed setting. Saved chunks play offline at any time.

import type { Timepoint } from './api';

const DB_NAME = 'bookreader-audio';
const STORE = 'chunks';
let dbPromise: Promise<IDBDatabase> | null = null;

export interface ChunkClip {
  /** base64 MP3 of the whole chunk. */
  audio: string;
  /** Start time of each sentence (markName = sentence id). */
  timepoints: Timepoint[];
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Legacy v1 per-sentence clips are unusable under chunk playback —
      // drop them to free space; chunks are re-synthesized on demand.
      if (db.objectStoreNames.contains('clips')) db.deleteObjectStore('clips');
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export function chunkKey(bookId: string, chunkId: string, voice: string): string {
  return `${bookId}:${chunkId}:${voice}`;
}

export async function getChunkClip(key: string): Promise<ChunkClip | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as ChunkClip | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function putChunkClip(key: string, clip: ChunkClip): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(clip, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Count saved chunks for a book (any voice). */
export async function countChunksForBook(bookId: string): Promise<number> {
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
