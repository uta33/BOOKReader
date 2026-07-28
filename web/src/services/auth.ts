const TOKEN_KEY = 'bookreader_api_token';
const USER_KEY = 'bookreader_api_user_id';
const WORKER_BASE = (import.meta.env?.VITE_WORKER_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

let pending: Promise<string> | null = null;

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retryUnauthorized = true,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await ensureToken()}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const target =
    typeof input === 'string' && input.startsWith('/')
      ? `${WORKER_BASE}${input}`
      : input;
  const response = await fetch(target, { ...init, headers });
  if (response.status === 401 && retryUnauthorized) {
    clearStoredSession();
    return authenticatedFetch(input, init, false);
  }
  return response;
}

async function ensureToken(): Promise<string> {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) return stored;
  if (!WORKER_BASE) throw new Error('Worker API is not configured');
  if (!pending) {
    pending = (async () => {
      const response = await fetch(`${WORKER_BASE}/v1/auth/anonymous`, { method: 'POST' });
      if (!response.ok) throw new Error(`匿名認証に失敗しました (${response.status})`);
      const session = (await response.json()) as { userId: string; token: string };
      localStorage.setItem(TOKEN_KEY, session.token);
      localStorage.setItem(USER_KEY, session.userId);
      return session.token;
    })();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}

function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  pending = null;
}
