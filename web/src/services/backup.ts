/**
 * Full-data backup & restore.
 *
 * Everything the user builds up (books, recaps, review schedule, activity
 * stats, settings) lives in this browser's localStorage — a device change or
 * "clear site data" wipes it all. The backup is a single JSON file containing
 * every persisted store. Generated audio chunks are intentionally NOT
 * included (large, and regenerable on demand).
 */

const BACKUP_APP = 'bookreader-backup';
const BACKUP_VERSION = 1;

/** Every zustand-persisted store key. */
const STORE_KEYS = [
  'bookreader_library',
  'bookreader_reviews',
  'bookreader_stats',
  'bookreader_settings',
  'bookreader_bgm',
] as const;

interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  stores: Record<string, unknown>;
}

export interface BackupSummary {
  books: number;
  reviews: number;
}

function summarize(stores: Record<string, unknown>): BackupSummary {
  const count = (key: string, list: string): number => {
    const store = stores[key] as { state?: Record<string, unknown> } | undefined;
    const arr = store?.state?.[list];
    return Array.isArray(arr) ? arr.length : 0;
  };
  return {
    books: count('bookreader_library', 'books'),
    reviews: count('bookreader_reviews', 'items'),
  };
}

/** Serialize all persisted stores into one backup JSON string. */
export function buildBackup(): { json: string; summary: BackupSummary } {
  const stores: Record<string, unknown> = {};
  for (const key of STORE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    stores[key] = JSON.parse(raw);
  }
  const file: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  };
  return { json: JSON.stringify(file, null, 2), summary: summarize(stores) };
}

export function backupFilename(now = new Date()): string {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return `bookreader-backup-${ymd}.json`;
}

/**
 * Validate a backup file and overwrite the persisted stores with it.
 * Returns what was restored; the caller reloads the app so every zustand
 * store rehydrates from the restored localStorage.
 */
export function restoreBackup(json: string): BackupSummary {
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(json) as BackupFile;
  } catch {
    throw new Error('バックアップファイルを読み取れません（JSONが壊れています）。');
  }
  if (parsed?.app !== BACKUP_APP || typeof parsed.stores !== 'object' || !parsed.stores) {
    throw new Error('BOOKReaderのバックアップファイルではありません。');
  }
  if (parsed.version > BACKUP_VERSION) {
    throw new Error('このバックアップは新しいバージョンのアプリで作成されています。');
  }
  for (const key of STORE_KEYS) {
    const value = parsed.stores[key];
    if (value !== undefined) localStorage.setItem(key, JSON.stringify(value));
  }
  return summarize(parsed.stores);
}
