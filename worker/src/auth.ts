import type { Context, Next } from 'hono';
import { ApiError, isCheckConstraintError } from './errors';
import { hmacSha256, hourBucket, randomToken, sha256, uuid } from './crypto';
import type { Env, WorkerVariables } from './types';
import { deleteUserAttachmentObjects } from './attachments';

type AppContext = Context<{ Bindings: Env; Variables: WorkerVariables }>;

export async function createAnonymous(request: Request, env: Env) {
  const now = Date.now();
  const userId = uuid();
  const sessionId = uuid();
  const token = randomToken();
  const tokenHash = await sha256(token);

  try {
    await env.DB.batch([
      ...(await ipHourlyLimitStatements(request, env, now, 'anonymous')),
      env.DB.prepare('INSERT INTO users (id, created_at) VALUES (?, ?)').bind(userId, now),
      env.DB.prepare(
        `INSERT INTO sessions (id, user_id, token_hash, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(sessionId, userId, tokenHash, now, now),
    ]);
  } catch (error) {
    if (isCheckConstraintError(error)) {
      throw new ApiError(429, 'Too many anonymous accounts from this network', 3_600);
    }
    throw error;
  }
  return { userId, token };
}

export async function issueSession(
  env: Env,
  userId: string,
  statements: D1PreparedStatement[] = [],
): Promise<{ userId: string; token: string }> {
  const now = Date.now();
  const token = randomToken();
  const tokenHash = await sha256(token);
  statements.push(
    env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(uuid(), userId, tokenHash, now, now),
  );
  await env.DB.batch(statements);
  return { userId, token };
}

export async function replaceWithAnonymous(
  request: Request,
  env: Env,
  currentUserId: string,
): Promise<{ userId: string; token: string }> {
  const now = Date.now();
  const userId = uuid();
  const token = randomToken();
  const tokenHash = await sha256(token);
  const statements: D1PreparedStatement[] = [
    ...(await ipHourlyLimitStatements(request, env, now, 'anonymous')),
    env.DB.prepare('INSERT INTO users (id, created_at) VALUES (?, ?)').bind(userId, now),
    env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(uuid(), userId, tokenHash, now, now),
    env.DB.prepare(
      'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
    ).bind(now, currentUserId),
  ];
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (isCheckConstraintError(error)) {
      throw new ApiError(429, 'Too many anonymous accounts from this network', 3_600);
    }
    throw error;
  }
  return { userId, token };
}

export async function sessionForExistingUser(
  env: Env,
  userId: string,
  revokeUserId?: string,
): Promise<{ userId: string; token: string }> {
  const now = Date.now();
  const token = randomToken();
  const tokenHash = await sha256(token);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(uuid(), userId, tokenHash, now, now),
  ];
  if (revokeUserId) {
    statements.push(
      env.DB.prepare(
        'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
      ).bind(now, revokeUserId),
    );
  }
  await env.DB.batch(statements);
  return { userId, token };
}

export async function switchToExistingUser(
  env: Env,
  targetUserId: string,
  sourceUserId: string,
): Promise<{ userId: string; token: string }> {
  const now = Date.now();
  const token = randomToken();
  const tokenHash = await sha256(token);
  await deleteUserAttachmentObjects(env, sourceUserId);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(uuid(), targetUserId, tokenHash, now, now),
    ...deleteUserStatements(env, sourceUserId),
  ]);
  return { userId: targetUserId, token };
}

export function deleteUserStatements(
  env: Env,
  userId: string,
): D1PreparedStatement[] {
  return [
    env.DB.prepare(
      'DELETE FROM account_merges WHERE source_user_id = ? OR target_user_id = ?',
    ).bind(userId, userId),
    env.DB.prepare('DELETE FROM web_deletion_flows WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ];
}

export async function consumeIpHourlySlot(
  request: Request,
  env: Env,
  namespace: string,
): Promise<void> {
  const now = Date.now();
  try {
    await env.DB.batch(await ipHourlyLimitStatements(request, env, now, namespace));
  } catch (error) {
    if (isCheckConstraintError(error)) {
      throw new ApiError(429, 'Too many requests from this network', 3_600);
    }
    throw error;
  }
}

async function ipHourlyLimitStatements(
  request: Request,
  env: Env,
  now: number,
  namespace: string,
): Promise<D1PreparedStatement[]> {
  if (!env.AUTH_HMAC_SECRET || env.AUTH_HMAC_SECRET.length < 32) {
    throw new ApiError(503, 'Authentication is not configured');
  }
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const ipHash = await hmacSha256(env.AUTH_HMAC_SECRET, `${namespace}:${ip}`);
  const bucket = hourBucket(new Date(now));
  return [
    env.DB.prepare(
      `INSERT OR IGNORE INTO anonymous_issuance (ip_hash, hour_bucket, count, updated_at)
       VALUES (?, ?, 0, ?)`,
    ).bind(ipHash, bucket, now),
    env.DB.prepare(
      `UPDATE anonymous_issuance SET count = count + 1, updated_at = ?
       WHERE ip_hash = ? AND hour_bucket = ?`,
    ).bind(now, ipHash, bucket),
  ];
}

export async function authenticate(request: Request, env: Env) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required');
  const token = authorization.slice(7).trim();
  if (!token) throw new ApiError(401, 'Authentication required');
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT id, user_id FROM sessions
     WHERE token_hash = ? AND revoked_at IS NULL`,
  )
    .bind(tokenHash)
    .first<{ id: string; user_id: string }>();
  if (!row) throw new ApiError(401, 'Invalid or expired session');
  return { id: row.user_id, sessionId: row.id };
}

export async function requireAuth(c: AppContext, next: Next) {
  c.set('user', await authenticate(c.req.raw, c.env));
  await next();
}
