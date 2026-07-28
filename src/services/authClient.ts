import * as SecureStore from 'expo-secure-store';
import { useSettingsStore } from '../store/settingsStore';

const TOKEN_KEY = 'bookreader_auth_token';
const USER_KEY = 'bookreader_auth_user_id';
const PENDING_TOKEN_KEY = 'bookreader_pending_auth_token';
const PENDING_USER_KEY = 'bookreader_pending_auth_user_id';
const ENV_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

let sessionPromise: Promise<AuthSession> | null = null;

export interface AuthSession {
  userId: string;
  token: string;
}

export function apiBase(): string {
  if (__DEV__) {
    const override = useSettingsStore.getState().apiBaseUrl.trim().replace(/\/+$/, '');
    if (override) return override;
  }
  return ENV_BASE;
}

export function isApiConfigured(): boolean {
  return apiBase().length > 0;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return fallback;
  try {
    return (JSON.parse(text) as { error?: string }).error ?? fallback;
  } catch {
    return text.trim().slice(0, 200) || fallback;
  }
}

async function storedSession(): Promise<AuthSession | null> {
  const [userId, token] = await Promise.all([
    SecureStore.getItemAsync(USER_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
  ]);
  return userId && token ? { userId, token } : null;
}

export async function replaceSession(session: AuthSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(USER_KEY, session.userId),
    SecureStore.setItemAsync(TOKEN_KEY, session.token),
  ]);
  sessionPromise = Promise.resolve(session);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(USER_KEY),
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(PENDING_USER_KEY),
    SecureStore.deleteItemAsync(PENDING_TOKEN_KEY),
  ]);
  sessionPromise = null;
}

export async function stageSession(session: AuthSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(PENDING_USER_KEY, session.userId),
    SecureStore.setItemAsync(PENDING_TOKEN_KEY, session.token),
  ]);
}

export async function commitStagedSession(): Promise<boolean> {
  const [userId, token] = await Promise.all([
    SecureStore.getItemAsync(PENDING_USER_KEY),
    SecureStore.getItemAsync(PENDING_TOKEN_KEY),
  ]);
  if (!userId || !token) {
    await clearStagedSession();
    return false;
  }
  await replaceSession({ userId, token });
  return true;
}

export async function clearStagedSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(PENDING_USER_KEY),
    SecureStore.deleteItemAsync(PENDING_TOKEN_KEY),
  ]);
}

async function issueAnonymous(): Promise<AuthSession> {
  const base = apiBase();
  if (!base) throw new Error('APIサーバーのURLが設定されていません。');
  const response = await fetch(`${base}/v1/auth/anonymous`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(await readError(response, `匿名アカウントを作成できませんでした (${response.status})`));
  }
  const session = (await response.json()) as AuthSession;
  if (!session.userId || !session.token) throw new Error('認証サーバーの応答が不正です。');
  await replaceSession(session);
  return session;
}

export async function ensureSession(): Promise<AuthSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => (await storedSession()) ?? issueAnonymous())();
    sessionPromise.catch(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

export async function authenticatedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith('/')) throw new Error('API path must be relative');
  const base = apiBase();
  if (!base) throw new Error('APIサーバーのURLが設定されていません。');
  const session = await ensureSession();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.token}`);
  return fetch(`${base}${path}`, { ...init, headers });
}

export async function apiError(response: Response, fallback: string): Promise<string> {
  return readError(response, fallback);
}
