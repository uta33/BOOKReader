import {
  createLocalJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
} from 'jose';
import { ApiError } from './errors';
import { randomToken, sha256, uuid } from './crypto';
import { mergeAccounts } from './merge';
import {
  consumeIpHourlySlot,
  deleteUserStatements,
  sessionForExistingUser,
  switchToExistingUser,
} from './auth';
import type { AuthUser, Env } from './types';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FLOW_TTL_MS = 10 * 60 * 1000;
const COMPLETE_TTL_MS = 60 * 1000;

export interface OAuthFlow {
  id: string;
  user_id: string;
  nonce: string;
  pkce_verifier: string;
  status: 'pending' | 'complete' | 'choice_required' | 'consumed' | 'cancelled';
  google_sub: string | null;
  google_email: string | null;
  conflict_user_id: string | null;
  expires_at: number;
  consumed_at: number | null;
}

export async function startGoogleLink(env: Env, user: AuthUser, ticket: unknown) {
  ensureGoogleConfigured(env);
  const linked = await env.DB.prepare(
    'SELECT 1 AS linked FROM google_identities WHERE user_id = ?',
  )
    .bind(user.id)
    .first<{ linked: number }>();
  if (linked) throw new ApiError(409, 'This account is already linked to Google');
  const normalizedTicket = validateTicket(ticket);
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const challenge = await sha256(verifier);
  const now = Date.now();
  const expiresAt = now + FLOW_TTL_MS;
  const active = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM oauth_flows
     WHERE user_id = ? AND status IN ('pending', 'choice_required') AND expires_at > ?`,
  )
    .bind(user.id, now)
    .first<{ count: number }>();
  if (Number(active?.count ?? 0) >= 5) {
    throw new ApiError(429, 'Too many active Google authentication attempts', 600);
  }
  await env.DB.prepare(
    `INSERT INTO oauth_flows
     (id, user_id, ticket_hash, state_hash, nonce, pkce_verifier, status, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(
      uuid(),
      user.id,
      await sha256(normalizedTicket),
      await sha256(state),
      nonce,
      verifier,
      expiresAt,
      now,
    )
    .run();

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_OAUTH_CLIENT_ID!);
  url.searchParams.set('redirect_uri', callbackUrl(env));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return { authorizationUrl: url.toString(), expiresAt };
}

export async function handleGoogleCallback(env: Env, requestUrl: URL): Promise<Response> {
  try {
    ensureGoogleConfigured(env);
    const code = requestUrl.searchParams.get('code');
    const state = requestUrl.searchParams.get('state');
    const oauthError = requestUrl.searchParams.get('error');
    if (oauthError) throw new ApiError(400, 'Google authentication was cancelled');
    if (!code || !state) throw new ApiError(400, 'OAuth callback is incomplete');
    const stateHash = await sha256(state);
    const flow = await env.DB.prepare(
      `SELECT * FROM oauth_flows
       WHERE state_hash = ? AND status = 'pending' AND expires_at > ?`,
    )
      .bind(stateHash, Date.now())
      .first<OAuthFlow>();
    if (!flow) return await handleWebDeletionCallback(env, code, stateHash);

    const tokens = await exchangeCode(env, code, flow.pkce_verifier);
    if (!tokens.id_token) throw new ApiError(502, 'Google did not return an ID token');
    const claims = await verifyGoogleIdToken(env, tokens.id_token, flow.nonce);
    if (!claims.sub) throw new ApiError(400, 'Google account identifier is missing');
    const existing = await env.DB.prepare(
      'SELECT user_id FROM google_identities WHERE google_sub = ?',
    )
      .bind(claims.sub)
      .first<{ user_id: string }>();
    const email = typeof claims.email === 'string' ? claims.email : null;
    const now = Date.now();

    if (!existing || existing.user_id === flow.user_id) {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO google_identities (google_sub, user_id, email, linked_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email`,
        ).bind(claims.sub, flow.user_id, email, now),
        env.DB.prepare(
          `UPDATE oauth_flows
           SET status = 'complete', google_sub = ?, google_email = ?, completed_at = ?,
               expires_at = ?
           WHERE id = ? AND status = 'pending'`,
        ).bind(claims.sub, email, now, now + COMPLETE_TTL_MS, flow.id),
      ]);
    } else {
      await env.DB.prepare(
        `UPDATE oauth_flows
         SET status = 'choice_required', google_sub = ?, google_email = ?,
             conflict_user_id = ?, completed_at = ?, expires_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
        .bind(
          claims.sub,
          email,
          existing.user_id,
          now,
          now + FLOW_TTL_MS,
          flow.id,
        )
        .run();
    }
    return callbackPage('Google連携を確認しました。BOOKReaderへ戻ってください。', 200);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Google連携に失敗しました。';
    return callbackPage(message, error instanceof ApiError ? error.status : 500);
  }
}

export async function startWebDeletion(request: Request, env: Env): Promise<Response> {
  ensureGoogleConfigured(env);
  await consumeIpHourlySlot(request, env, 'web-deletion');
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const challenge = await sha256(verifier);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO web_deletion_flows
     (state_hash, nonce, pkce_verifier, status, expires_at, created_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(await sha256(state), nonce, verifier, now + FLOW_TTL_MS, now)
    .run();
  const url = googleAuthorizationUrl(env, state, nonce, challenge);
  return Response.redirect(url, 302);
}

export async function confirmWebDeletion(env: Env, token: unknown): Promise<void> {
  if (typeof token !== 'string' || token.length < 43 || token.length > 128) {
    throw new ApiError(400, 'Deletion confirmation is invalid');
  }
  const flow = await env.DB.prepare(
    `SELECT state_hash, user_id FROM web_deletion_flows
     WHERE confirmation_hash = ? AND status = 'confirmed' AND expires_at > ?`,
  )
    .bind(await sha256(token), Date.now())
    .first<{ state_hash: string; user_id: string | null }>();
  if (!flow?.user_id) throw new ApiError(400, 'Deletion confirmation is invalid or expired');
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE web_deletion_flows SET status = 'consumed' WHERE state_hash = ? AND status = 'confirmed'`,
    ).bind(flow.state_hash),
    ...deleteUserStatements(env, flow.user_id),
    env.DB.prepare('DELETE FROM web_deletion_flows WHERE state_hash = ?').bind(flow.state_hash),
  ]);
}

export async function completeGoogleLink(env: Env, user: AuthUser, ticket: unknown) {
  const ticketHash = await sha256(validateTicket(ticket));
  const found = await env.DB.prepare(
    'SELECT * FROM oauth_flows WHERE ticket_hash = ?',
  )
    .bind(ticketHash)
    .first<OAuthFlow>();
  const flow = requireUsableOAuthFlow(found, user.id, Date.now());
  if (flow.status === 'pending') return { status: 'pending' as const };
  if (flow.status === 'complete') {
    const result = await env.DB.prepare(
      `UPDATE oauth_flows SET status = 'consumed', consumed_at = ?
       WHERE id = ? AND status = 'complete' AND consumed_at IS NULL`,
    )
      .bind(Date.now(), flow.id)
      .run();
    if (Number(result.meta.changes ?? 0) !== 1) {
      throw new ApiError(409, 'OAuth ticket has already been used');
    }
    return { status: 'linked' as const, userId: user.id, email: flow.google_email };
  }
  if (!flow.conflict_user_id) throw new ApiError(500, 'OAuth conflict is incomplete');
  const counts = await env.DB.batch([
    env.DB.prepare(
      'SELECT COUNT(*) AS count FROM books WHERE user_id = ? AND deleted_at IS NULL',
    ).bind(user.id),
    env.DB.prepare(
      'SELECT COUNT(*) AS count FROM books WHERE user_id = ? AND deleted_at IS NULL',
    ).bind(flow.conflict_user_id),
  ]);
  return {
    status: 'choice_required' as const,
    conflictId: flow.id,
    localBooks: Number((counts[0].results[0] as { count?: number } | undefined)?.count ?? 0),
    cloudBooks: Number((counts[1].results[0] as { count?: number } | undefined)?.count ?? 0),
    email: flow.google_email,
  };
}

export function requireUsableOAuthFlow(
  flow: OAuthFlow | null,
  expectedUserId: string,
  now: number,
): OAuthFlow {
  if (!flow || flow.user_id !== expectedUserId) {
    throw new ApiError(403, 'OAuth ticket does not match this session');
  }
  if (flow.status === 'consumed' || flow.consumed_at) {
    throw new ApiError(409, 'OAuth ticket has already been used');
  }
  if (flow.status === 'cancelled') throw new ApiError(409, 'OAuth link was cancelled');
  if (flow.expires_at <= now) throw new ApiError(400, 'OAuth ticket has expired');
  return flow;
}

export async function resolveGoogleConflict(
  env: Env,
  user: AuthUser,
  conflictId: unknown,
  choice: unknown,
) {
  if (typeof conflictId !== 'string' || !conflictId) {
    throw new ApiError(400, 'conflictId is required');
  }
  if (choice !== 'merge' && choice !== 'cloud' && choice !== 'cancel') {
    throw new ApiError(400, 'choice is invalid');
  }
  const flow = await env.DB.prepare(
    `SELECT * FROM oauth_flows
     WHERE id = ? AND user_id = ? AND status = 'choice_required' AND expires_at > ?`,
  )
    .bind(conflictId, user.id, Date.now())
    .first<OAuthFlow>();
  if (!flow?.conflict_user_id) throw new ApiError(409, 'OAuth conflict is no longer available');

  if (choice === 'cancel') {
    await env.DB.prepare(
      `UPDATE oauth_flows SET status = 'cancelled', consumed_at = ? WHERE id = ?`,
    )
      .bind(Date.now(), flow.id)
      .run();
    return { status: 'cancelled' as const };
  }

  if (choice === 'cloud') {
    const session = await switchToExistingUser(env, flow.conflict_user_id, user.id);
    return { status: 'linked' as const, ...session };
  }

  const session = await sessionForExistingUser(env, flow.conflict_user_id);
  await mergeAccounts(env, user.id, flow.conflict_user_id, flow.id);
  return { status: 'linked' as const, ...session };
}

export async function verifyGoogleIdToken(
  env: Env,
  token: string,
  nonce: string,
): Promise<JWTPayload> {
  let raw = await env.JWKS_CACHE.get('google-oidc-jwks');
  if (!raw) {
    raw = await fetchAndCacheGoogleJwks(env);
  }
  try {
    return await verifyGoogleIdTokenWithJwks(
      token,
      JSON.parse(raw) as JSONWebKeySet,
      env.GOOGLE_OAUTH_CLIENT_ID!,
      nonce,
    );
  } catch {
    const refreshed = await fetchAndCacheGoogleJwks(env);
    return verifyGoogleIdTokenWithJwks(
      token,
      JSON.parse(refreshed) as JSONWebKeySet,
      env.GOOGLE_OAUTH_CLIENT_ID!,
      nonce,
    );
  }
}

export async function verifyGoogleIdTokenWithJwks(
  token: string,
  jwks: JSONWebKeySet,
  audience: string,
  nonce: string,
  now?: Date,
): Promise<JWTPayload> {
  const result = await jwtVerify(token, createLocalJWKSet(jwks), {
    audience,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    currentDate: now,
    algorithms: ['RS256'],
  });
  if (result.payload.nonce !== nonce) throw new ApiError(400, 'Google nonce does not match');
  return result.payload;
}

function ensureGoogleConfigured(env: Env): void {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new ApiError(503, 'Google OAuth is not configured');
  }
}

async function fetchAndCacheGoogleJwks(env: Env): Promise<string> {
  const response = await fetch(GOOGLE_JWKS_URL);
  if (!response.ok) throw new ApiError(502, 'Google signing keys are unavailable');
  const raw = await response.text();
  await env.JWKS_CACHE.put('google-oidc-jwks', raw, { expirationTtl: 21_600 });
  return raw;
}

function validateTicket(ticket: unknown): string {
  if (
    typeof ticket !== 'string' ||
    ticket.length < 43 ||
    ticket.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(ticket)
  ) {
    throw new ApiError(400, 'ticket is invalid');
  }
  return ticket;
}

function callbackUrl(env: Env): string {
  return `${env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/v1/auth/google/callback`;
}

function googleAuthorizationUrl(
  env: Env,
  state: string,
  nonce: string,
  challenge: string,
): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_OAUTH_CLIENT_ID!);
  url.searchParams.set('redirect_uri', callbackUrl(env));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

async function exchangeCode(env: Env, code: string, verifier: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl(env),
    }),
  });
  if (!response.ok) throw new ApiError(502, 'Google authorization code exchange failed');
  return response.json<{ id_token?: string }>();
}

function callbackPage(message: string, status: number): Response {
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return new Response(
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BOOKReader</title><body style="font-family:system-ui;padding:32px;line-height:1.7"><h1>BOOKReader</h1><p>${safe}</p><p>このページを閉じても認証情報がURLへ残ることはありません。</p></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}

async function handleWebDeletionCallback(
  env: Env,
  code: string,
  stateHash: string,
): Promise<Response> {
  const flow = await env.DB.prepare(
    `SELECT nonce, pkce_verifier FROM web_deletion_flows
     WHERE state_hash = ? AND status = 'pending' AND expires_at > ?`,
  )
    .bind(stateHash, Date.now())
    .first<{ nonce: string; pkce_verifier: string }>();
  if (!flow) throw new ApiError(400, 'OAuth state is invalid or expired');
  const tokens = await exchangeCode(env, code, flow.pkce_verifier);
  if (!tokens.id_token) throw new ApiError(502, 'Google did not return an ID token');
  const claims = await verifyGoogleIdToken(env, tokens.id_token, flow.nonce);
  if (!claims.sub) throw new ApiError(400, 'Google account identifier is missing');
  const identity = await env.DB.prepare(
    'SELECT user_id, email FROM google_identities WHERE google_sub = ?',
  )
    .bind(claims.sub)
    .first<{ user_id: string; email: string | null }>();
  if (!identity) throw new ApiError(404, 'BOOKReader account was not found');
  const confirmation = randomToken();
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE web_deletion_flows
     SET status = 'confirmed', user_id = ?, confirmation_hash = ?, expires_at = ?
     WHERE state_hash = ? AND status = 'pending'`,
  )
    .bind(identity.user_id, await sha256(confirmation), now + FLOW_TTL_MS, stateHash)
    .run();
  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM books WHERE user_id = ? AND deleted_at IS NULL',
  )
    .bind(identity.user_id)
    .first<{ count: number }>();
  const safeEmail = (identity.email ?? 'Googleアカウント')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return new Response(
    `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BOOKReader 削除確認</title><body style="max-width:42rem;margin:2rem auto;padding:1rem;font-family:system-ui;line-height:1.7"><h1>削除確認</h1><p>${safeEmail} のBOOKReaderアカウントと${Number(count?.count ?? 0)}冊を削除します。</p><form method="post" action="/account/delete/google/confirm"><input type="hidden" name="confirmation" value="${confirmation}"><button type="submit" style="padding:.8rem 1rem">完全に削除する</button></form><p>この操作は元に戻せません。</p></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}
