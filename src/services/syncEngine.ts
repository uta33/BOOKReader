import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticatedFetch, apiError, isApiConfigured } from './authClient';
import {
  applyFullSnapshot,
  applyServerChanges,
  dirtyChanges,
  replaceWithServerSnapshot,
  syncKey,
  type SyncChange,
  type SyncMetadata,
} from './syncModel';
import { registerSyncTrigger } from './syncTrigger';
import { useLibraryStore } from '../store/libraryStore';

const SYNC_KEY = 'bookreader_sync_state';
const EMPTY: SyncMetadata = { cursor: 0, syncedAt: {} };

let active: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let suspendCount = 0;

export interface SyncResponse {
  cursor: number;
  changes: SyncChange[];
  hasMore: boolean;
  fullResync?: true;
}

async function readMetadata(): Promise<SyncMetadata> {
  const raw = await AsyncStorage.getItem(SYNC_KEY);
  if (!raw) return { ...EMPTY, syncedAt: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<SyncMetadata>;
    return {
      cursor: Number.isSafeInteger(parsed.cursor) ? (parsed.cursor as number) : 0,
      syncedAt:
        parsed.syncedAt && typeof parsed.syncedAt === 'object' ? parsed.syncedAt : {},
    };
  } catch {
    return { ...EMPTY, syncedAt: {} };
  }
}

async function writeMetadata(metadata: SyncMetadata): Promise<void> {
  await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(metadata));
}

export function scheduleSync(): void {
  if (!isApiConfigured() || suspendCount > 0) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void syncNow().catch(() => undefined);
  }, 5_000);
}

export function installSyncScheduler(): () => void {
  registerSyncTrigger(scheduleSync);
  return () => {
    registerSyncTrigger(undefined);
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
}

export async function clearSyncState(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_KEY);
}

export async function syncNow(): Promise<void> {
  if (!isApiConfigured() || suspendCount > 0) return;
  if (!active) {
    active = runSync().finally(() => {
      active = null;
    });
  }
  return active;
}

export async function suspendSync(flush = false): Promise<() => void> {
  if (flush && isApiConfigured()) await syncNow();
  suspendCount += 1;
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  await active?.catch(() => undefined);
  let resumed = false;
  return () => {
    if (resumed) return;
    resumed = true;
    suspendCount = Math.max(0, suspendCount - 1);
  };
}

export async function adoptServerSnapshot(preserveLocalContent: boolean): Promise<void> {
  await active?.catch(() => undefined);
  const operation = runAdoptServerSnapshot(preserveLocalContent);
  active = operation.finally(() => {
    active = null;
  });
  return active;
}

async function runAdoptServerSnapshot(preserveLocalContent: boolean): Promise<void> {
  const response = await authenticatedFetch('/v1/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ since: 0, changes: [], forceFull: true }),
  });
  if (!response.ok) {
    throw new Error(await apiError(response, `同期に失敗しました (${response.status})`));
  }
  const result = (await response.json()) as SyncResponse;
  if (!result.fullResync) throw new Error('同期サーバーが完全スナップショットを返しませんでした。');
  const state = useLibraryStore.getState();
  const canonical = replaceWithServerSnapshot(
    state.allBooks,
    result.changes,
    preserveLocalContent,
  );
  useLibraryStore.getState().replaceAllBooks(canonical, false);
  await useLibraryStore.getState().saveLibrary();
  await writeMetadata({
    cursor: result.cursor,
    syncedAt: Object.fromEntries(
      result.changes.map((change) => [
        syncKey(change.entity, change.id),
        change.updatedAt,
      ]),
    ),
  });
}

async function runSync(): Promise<void> {
  let metadata = await readMetadata();
  for (let pass = 0; pass < 20; pass += 1) {
    const state = useLibraryStore.getState();
    const outgoing = dirtyChanges(state.allBooks, metadata, state.deviceId).slice(0, 100);
    const sentVersions = new Map(
      outgoing.map((change) => [syncKey(change.entity, change.id), change.updatedAt]),
    );
    const response = await authenticatedFetch('/v1/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since: metadata.cursor, changes: outgoing }),
    });
    if (!response.ok) {
      throw new Error(await apiError(response, `同期に失敗しました (${response.status})`));
    }
    const result = (await response.json()) as SyncResponse;
    const latest = useLibraryStore.getState();
    const merged = result.fullResync
      ? applyFullSnapshot(
          latest.allBooks,
          result.changes,
          metadata,
          latest.deviceId,
          sentVersions,
        )
      : applyServerChanges(latest.allBooks, result.changes, sentVersions);
    useLibraryStore.getState().replaceAllBooks(merged, false);
    await useLibraryStore.getState().saveLibrary();

    const syncedAt = { ...metadata.syncedAt };
    for (const change of result.changes) {
      syncedAt[syncKey(change.entity, change.id)] = change.updatedAt;
    }
    metadata = { cursor: result.cursor, syncedAt };
    await writeMetadata(metadata);

    const remaining = dirtyChanges(
      useLibraryStore.getState().allBooks,
      metadata,
      useLibraryStore.getState().deviceId,
    );
    if (!result.hasMore && remaining.length === 0) return;
  }
  throw new Error('同期が収束しませんでした。時間を置いて再試行してください。');
}
