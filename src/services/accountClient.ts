import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {
  apiBase,
  apiError,
  authenticatedFetch,
  clearStagedSession,
  clearSession,
  commitStagedSession,
  ensureSession,
  stageSession,
  type AuthSession,
} from './authClient';
import {
  adoptServerSnapshot,
  clearSyncState,
  syncNow,
  suspendSync,
} from './syncEngine';
import { deleteAllAudioCache } from './googleTTS';
import { useLibraryStore } from '../store/libraryStore';

const WIPE_PENDING_KEY = 'bookreader_local_wipe_pending';

interface PendingLocalChange {
  kind: 'remote' | 'destructive';
  preserveLocalContent?: boolean;
}

export interface AccountInfo {
  userId: string;
  auth: 'anonymous' | 'google';
  email?: string;
  bookCount: number;
  quota: Record<string, unknown>;
}

export interface DiagnosticsInfo {
  ok: true;
  checkedAt: number;
  services: {
    sync: boolean;
    summary: boolean;
    quiz: boolean;
    tts: boolean;
    ocr: boolean;
    googleAuth: boolean;
  };
  quota: {
    day: string;
    used: { summary: number; quiz: number; ttsChars: number; ocrPages: number };
    limits: { summary: number; quiz: number; ttsChars: number; ocrPages: number };
    estimatedUsd: number;
  };
}

export type GoogleLinkResult =
  | { status: 'linked'; userId: string; email?: string }
  | {
      status: 'choice_required';
      conflictId: string;
      localBooks: number;
      cloudBooks: number;
      email?: string;
    };

export class InvalidSessionError extends Error {}

export async function getAccount(): Promise<AccountInfo> {
  const response = await authenticatedFetch('/v1/account');
  if (response.status === 401) {
    throw new InvalidSessionError(
      'クラウドセッションは削除済みか無効です。端末データをどう扱うか選んでください。',
    );
  }
  if (!response.ok) throw new Error(await apiError(response, 'アカウントを取得できませんでした。'));
  return response.json();
}

export async function getDiagnostics(): Promise<DiagnosticsInfo> {
  const response = await authenticatedFetch('/v1/diagnostics');
  if (!response.ok) throw new Error(await apiError(response, '接続状態を確認できませんでした。'));
  return response.json();
}

export async function linkGoogle(): Promise<GoogleLinkResult> {
  await syncNow();
  const ticket = await randomTicket();
  const start = await authenticatedFetch('/v1/auth/google/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket }),
  });
  if (!start.ok) throw new Error(await apiError(start, 'Google連携を開始できませんでした。'));
  const { authorizationUrl } = (await start.json()) as { authorizationUrl: string };
  let browserClosed = false;
  const browser = WebBrowser.openBrowserAsync(authorizationUrl).finally(() => {
    browserClosed = true;
  });
  let closedPendingAttempts = 0;

  try {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      await delay(2_000);
      const response = await authenticatedFetch('/v1/auth/google/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
      });
      if (response.status === 202) {
        if (browserClosed) {
          closedPendingAttempts += 1;
          if (closedPendingAttempts >= 5) {
            throw new Error('Google連携が完了する前にブラウザーが閉じられました。');
          }
        }
        continue;
      }
      if (!response.ok) throw new Error(await apiError(response, 'Google連携に失敗しました。'));
      WebBrowser.dismissBrowser();
      return response.json();
    }
    throw new Error('Google連携が時間切れになりました。');
  } finally {
    void browser.catch(() => undefined);
  }
}

export async function resolveGoogleConflict(
  conflictId: string,
  choice: 'merge' | 'cloud' | 'cancel',
): Promise<void> {
  const resumeSync = await suspendSync(true);
  let safeToResume = true;
  const changesAccount = choice === 'merge' || choice === 'cloud';
  try {
    if (changesAccount) {
      await writePending({
        kind: 'remote',
        preserveLocalContent: choice === 'merge',
      });
    }
    const response = await authenticatedFetch('/v1/auth/google/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conflictId, choice }),
    });
    if (!response.ok) {
      if (changesAccount) await clearPending();
      throw new Error(await apiError(response, 'アカウントの選択を完了できませんでした。'));
    }
    const result = (await response.json()) as
      | ({ status: 'linked' } & AuthSession)
      | { status: 'cancelled' };
    if (result.status === 'cancelled') return;

    await stageSession(result);
    safeToResume = false;
    if (!(await commitStagedSession())) {
      throw new Error('新しい認証セッションを安全に保存できませんでした。アプリを再起動してください。');
    }
    await adoptServerSnapshot(choice === 'merge');
    await deleteAllAudioCache();
    await clearPending();
    await clearStagedSession();
    safeToResume = true;
  } catch (error) {
    if (safeToResume) await clearStagedSession();
    throw error;
  } finally {
    if (safeToResume) resumeSync();
  }
}

export async function signOutAccount(): Promise<void> {
  await destructiveSessionChange('/v1/auth/signout', 'POST');
}

export async function deleteCurrentAccount(): Promise<void> {
  const resumeSync = await suspendSync();
  let remoteDeleted = false;
  await writePending({ kind: 'destructive' });
  try {
    const response = await authenticatedFetch('/v1/account', { method: 'DELETE' });
    if (!response.ok) {
      await clearPending();
      throw new Error(await apiError(response, 'アカウントを削除できませんでした。'));
    }
    remoteDeleted = true;
    await clearSession();
    await clearLocalData();
    await clearPending();
  } catch (error) {
    if (!remoteDeleted) await clearPending();
    throw error;
  } finally {
    resumeSync();
  }
}

export async function resetInvalidSession(keepLocalData: boolean): Promise<void> {
  const resumeSync = await suspendSync();
  try {
    if (keepLocalData) {
      // Clear the old cursor first. If the process stops after this point, the
      // next session will treat every retained local row as unsynced.
      await clearSyncState();
      await clearSession();
    } else {
      await writePending({ kind: 'destructive' });
      await clearSession();
      await clearLocalData();
      await clearPending();
    }
    await ensureSession();
  } finally {
    resumeSync();
  }
  if (keepLocalData) await syncNow();
}

export async function createAccountDeletionTicket(): Promise<{
  ticket: string;
  expiresAt: number;
  deletionUrl: string;
}> {
  const response = await authenticatedFetch('/v1/account/deletion-ticket', { method: 'POST' });
  if (!response.ok) throw new Error(await apiError(response, '削除用コードを発行できませんでした。'));
  const result = (await response.json()) as { ticket: string; expiresAt: number };
  return { ...result, deletionUrl: `${apiBase()}/account/delete` };
}

export async function completePendingLocalWipe(): Promise<void> {
  const pending = await readPending();
  if (!pending) {
    await clearStagedSession();
    return;
  }
  const staged = await commitStagedSession();
  if (pending.kind === 'remote') {
    if (!staged) {
      await clearPending();
      return;
    }
    await adoptServerSnapshot(pending.preserveLocalContent === true);
    await deleteAllAudioCache();
  } else {
    if (!staged) await clearSession();
    await clearLocalData();
  }
  await clearPending();
  await clearStagedSession();
}

async function destructiveSessionChange(path: string, method: 'POST' | 'DELETE'): Promise<void> {
  const resumeSync = await suspendSync(true);
  let safeToResume = true;
  await writePending({ kind: 'destructive' });
  try {
    const response = await authenticatedFetch(path, { method });
    if (!response.ok) {
      await clearPending();
      throw new Error(await apiError(response, 'アカウント操作に失敗しました。'));
    }
    await stageSession((await response.json()) as AuthSession);
    safeToResume = false;
    if (!(await commitStagedSession())) {
      throw new Error('新しい認証セッションを安全に保存できませんでした。アプリを再起動してください。');
    }
    await clearLocalData();
    await clearPending();
    await clearStagedSession();
    safeToResume = true;
  } catch (error) {
    if (safeToResume) await clearStagedSession();
    throw error;
  } finally {
    if (safeToResume) resumeSync();
  }
}

async function writePending(pending: PendingLocalChange): Promise<void> {
  await AsyncStorage.setItem(WIPE_PENDING_KEY, JSON.stringify(pending));
}

async function readPending(): Promise<PendingLocalChange | null> {
  const raw = await AsyncStorage.getItem(WIPE_PENDING_KEY);
  if (!raw) return null;
  if (raw === '1') return { kind: 'destructive' };
  try {
    const parsed = JSON.parse(raw) as Partial<PendingLocalChange>;
    if (parsed.kind !== 'remote' && parsed.kind !== 'destructive') return null;
    return {
      kind: parsed.kind,
      preserveLocalContent: parsed.preserveLocalContent === true,
    };
  } catch {
    return { kind: 'destructive' };
  }
}

async function clearPending(): Promise<void> {
  await AsyncStorage.removeItem(WIPE_PENDING_KEY);
}

async function clearLocalData(): Promise<void> {
  await Promise.all([
    useLibraryStore.getState().clearLibrary(),
    clearSyncState(),
    deleteAllAudioCache(),
  ]);
}

async function randomTicket(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
