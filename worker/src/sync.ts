import { ApiError } from './errors';
import { LIMITS, requireText } from './limits';
import type { EntityType, Env, SyncChange } from './types';

const MAX_FUTURE_MS = 5 * 60 * 1000;
const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const BOOK_FIELDS = new Set([
  'title',
  'totalPages',
  'lastSentenceIdx',
  'createdAt',
  'kind',
  'purposes',
  'isbn',
  'author',
  'publisher',
  'pubdate',
  'coverUrl',
  'bookstore',
  'summary',
  'recap',
  'recapCreatedAt',
  'rating',
  'startedAt',
  'finishedAt',
]);
const DOG_EAR_FIELDS = new Set([
  'page',
  'line',
  'quote',
  'comment',
  'createdAt',
  'reviewLevel',
  'lastReviewedAt',
  'nextReviewAt',
  'photoAttachmentId',
]);
const LINK_FIELDS = new Set(['label', 'url', 'kind', 'createdAt']);

export function compareVersions(
  left: Pick<SyncChange, 'updatedAt' | 'deletedAt' | 'originDeviceId'>,
  right: Pick<SyncChange, 'updatedAt' | 'deletedAt' | 'originDeviceId'>,
): number {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
  const leftDeleted = left.deletedAt === undefined ? 0 : 1;
  const rightDeleted = right.deletedAt === undefined ? 0 : 1;
  if (leftDeleted !== rightDeleted) return leftDeleted - rightDeleted;
  return left.originDeviceId.localeCompare(right.originDeviceId);
}

export function normalizeSyncChange(raw: unknown, now = Date.now()): SyncChange {
  if (!raw || typeof raw !== 'object') throw new ApiError(400, 'each change must be an object');
  const item = raw as Record<string, unknown>;
  const entity = item.entity;
  if (entity !== 'book' && entity !== 'dogEar' && entity !== 'digitalLink') {
    throw new ApiError(400, 'change.entity is invalid');
  }
  const id = requireText(item.id, 'change.id', 128);
  const originDeviceId = requireText(item.originDeviceId, 'originDeviceId', 128);
  const rawUpdatedAt = finiteTimestamp(item.updatedAt, 'updatedAt');
  const updatedAt = Math.min(rawUpdatedAt, now + MAX_FUTURE_MS);
  const rawDeletedAt =
    item.deletedAt === undefined || item.deletedAt === null
      ? undefined
      : finiteTimestamp(item.deletedAt, 'deletedAt');
  const deletedAt =
    rawDeletedAt === undefined ? undefined : Math.min(rawDeletedAt, now + MAX_FUTURE_MS);
  const version = Math.max(updatedAt, deletedAt ?? 0);
  const data = sanitizeData(entity, item.data);
  const bookId =
    entity === 'book' ? undefined : requireText(item.bookId, 'change.bookId', 128);

  return {
    entity,
    id,
    bookId,
    data,
    updatedAt: version,
    deletedAt: deletedAt === undefined ? undefined : version,
    originDeviceId,
  };
}

function finiteTimestamp(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ApiError(400, `${field} must be a non-negative timestamp`);
  }
  return Math.trunc(value);
}

function sanitizeData(entity: EntityType, raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, 'change.data must be an object');
  }
  const allowed =
    entity === 'book' ? BOOK_FIELDS : entity === 'dogEar' ? DOG_EAR_FIELDS : LINK_FIELDS;
  const data = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(([key]) => allowed.has(key)),
  );
  const encoded = JSON.stringify(data);
  if (encoded.length > 64_000) throw new ApiError(400, 'change.data is too large');
  return data;
}

export async function syncUser(
  env: Env,
  userId: string,
  since: number,
  rawChanges: unknown[],
  forceFull = false,
) {
  if (!Number.isSafeInteger(since) || since < 0) throw new ApiError(400, 'since is invalid');
  if (rawChanges.length > LIMITS.syncPush) {
    throw new ApiError(400, `changes must contain <= ${LIMITS.syncPush} items`);
  }
  const now = Date.now();
  const changes = rawChanges.map((change) => normalizeSyncChange(change, now));

  for (let offset = 0; offset < changes.length; offset += 25) {
    const statements = changes
      .slice(offset, offset + 25)
      .flatMap((change) => mutationStatements(env, userId, change, now));
    if (statements.length) await env.DB.batch(statements);
  }

  const user = await env.DB.prepare(
    'SELECT seq, min_available_rev FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{ seq: number; min_available_rev: number }>();
  if (!user) throw new ApiError(401, 'Account no longer exists');

  const fullResync = forceFull || since < user.min_available_rev;
  if (fullResync) {
    const snapshot = await currentSnapshot(env, userId);
    return {
      cursor: user.seq,
      changes: snapshot,
      hasMore: false,
      fullResync: true as const,
    };
  }

  const pulled = await env.DB.prepare(
    `SELECT rev, entity_type, entity_id, book_id, payload_json, updated_at, deleted_at,
            origin_device_id
     FROM sync_changes
     WHERE user_id = ? AND rev > ?
     ORDER BY rev ASC
     LIMIT ?`,
  )
    .bind(userId, since, LIMITS.syncPull + 1)
    .all<ChangeRow>();
  const hasMore = pulled.results.length > LIMITS.syncPull;
  const page = pulled.results.slice(0, LIMITS.syncPull);
  const cursor = hasMore && page.length ? page[page.length - 1].rev : user.seq;
  return {
    cursor,
    changes: page.map(rowToChange),
    hasMore,
  };
}

interface ChangeRow {
  rev: number;
  entity_type: EntityType;
  entity_id: string;
  book_id: string | null;
  payload_json: string;
  updated_at: number;
  deleted_at: number | null;
  origin_device_id?: string;
}

function rowToChange(row: ChangeRow): SyncChange {
  return {
    entity: row.entity_type,
    id: row.entity_id,
    bookId: row.book_id ?? undefined,
    data: JSON.parse(row.payload_json) as Record<string, unknown>,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
    originDeviceId: row.origin_device_id ?? 'server',
    rev: row.rev,
  };
}

function mutationStatements(
  env: Env,
  userId: string,
  change: SyncChange,
  now: number,
): D1PreparedStatement[] {
  const payload = JSON.stringify(change.data);
  const deletedAt = change.deletedAt ?? null;
  const bump = env.DB.prepare(
    'UPDATE users SET seq = seq + 1 WHERE id = ? RETURNING seq',
  ).bind(userId);
  const table =
    change.entity === 'book'
      ? 'books'
      : change.entity === 'dogEar'
        ? 'dog_ears'
        : 'digital_links';
  const upsert =
    change.entity === 'book'
      ? bookUpsert(env, userId, change, payload, deletedAt)
      : childUpsert(
          env,
          change.entity === 'dogEar' ? 'dog_ears' : 'digital_links',
          userId,
          change,
          payload,
          deletedAt,
        );
  const log = env.DB.prepare(
    `INSERT INTO sync_changes
     (user_id, rev, entity_type, entity_id, book_id, payload_json, updated_at, deleted_at,
      origin_device_id, created_at)
     SELECT ?, (SELECT seq FROM users WHERE id = ?), ?, id, ?, payload_json, updated_at,
            deleted_at, origin_device_id, ?
     FROM ${table}
     WHERE user_id = ? AND id = ?`,
  ).bind(
    userId,
    userId,
    change.entity,
    change.bookId ?? null,
    now,
    userId,
    change.id,
  );
  return [bump, upsert, log];
}

function bookUpsert(
  env: Env,
  userId: string,
  change: SyncChange,
  payload: string,
  deletedAt: number | null,
): D1PreparedStatement {
  const wins = versionWins('books');
  const incomingPosition =
    "COALESCE(CAST(json_extract(excluded.payload_json, '$.lastSentenceIdx') AS INTEGER), 0)";
  const currentPosition =
    "COALESCE(CAST(json_extract(books.payload_json, '$.lastSentenceIdx') AS INTEGER), 0)";
  return env.DB.prepare(
    `INSERT INTO books
     (user_id, id, isbn, payload_json, updated_at, deleted_at, origin_device_id, rev)
     VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT seq FROM users WHERE id = ?))
     ON CONFLICT(user_id, id) DO UPDATE SET
       isbn = CASE WHEN ${wins} THEN excluded.isbn ELSE books.isbn END,
       payload_json = CASE
         WHEN ${wins} THEN json_set(excluded.payload_json, '$.lastSentenceIdx', MAX(${incomingPosition}, ${currentPosition}))
         ELSE json_set(books.payload_json, '$.lastSentenceIdx', MAX(${incomingPosition}, ${currentPosition}))
       END,
       updated_at = CASE WHEN ${wins} THEN excluded.updated_at ELSE books.updated_at END,
       deleted_at = CASE WHEN ${wins} THEN excluded.deleted_at ELSE books.deleted_at END,
       origin_device_id = CASE WHEN ${wins} THEN excluded.origin_device_id ELSE books.origin_device_id END,
       rev = excluded.rev
     WHERE ${wins} OR ${incomingPosition} > ${currentPosition}`,
  ).bind(
    userId,
    change.id,
    typeof change.data.isbn === 'string' ? change.data.isbn : null,
    payload,
    change.updatedAt,
    deletedAt,
    change.originDeviceId,
    userId,
  );
}

function childUpsert(
  env: Env,
  table: 'dog_ears' | 'digital_links',
  userId: string,
  change: SyncChange,
  payload: string,
  deletedAt: number | null,
): D1PreparedStatement {
  const wins = versionWins(table);
  return env.DB.prepare(
    `INSERT INTO ${table}
     (user_id, id, book_id, payload_json, updated_at, deleted_at, origin_device_id, rev)
     VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT seq FROM users WHERE id = ?))
     ON CONFLICT(user_id, id) DO UPDATE SET
       book_id = excluded.book_id,
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at,
       origin_device_id = excluded.origin_device_id,
       rev = excluded.rev
     WHERE ${wins}`,
  ).bind(
    userId,
    change.id,
    change.bookId,
    payload,
    change.updatedAt,
    deletedAt,
    change.originDeviceId,
    userId,
  );
}

function versionWins(table: string): string {
  return `(excluded.updated_at > ${table}.updated_at OR
    (excluded.updated_at = ${table}.updated_at AND
      ((excluded.deleted_at IS NOT NULL) > (${table}.deleted_at IS NOT NULL) OR
       ((excluded.deleted_at IS NOT NULL) = (${table}.deleted_at IS NOT NULL) AND
        excluded.origin_device_id > ${table}.origin_device_id))))`;
}

async function currentSnapshot(env: Env, userId: string): Promise<SyncChange[]> {
  const result = await env.DB.prepare(
    `SELECT rev, 'book' AS entity_type, id AS entity_id, NULL AS book_id,
            payload_json, updated_at, deleted_at, origin_device_id
     FROM books WHERE user_id = ?
     UNION ALL
     SELECT rev, 'dogEar', id, book_id, payload_json, updated_at, deleted_at, origin_device_id
     FROM dog_ears WHERE user_id = ?
     UNION ALL
     SELECT rev, 'digitalLink', id, book_id, payload_json, updated_at, deleted_at, origin_device_id
     FROM digital_links WHERE user_id = ?
     ORDER BY rev ASC`,
  )
    .bind(userId, userId, userId)
    .all<ChangeRow>();
  return result.results.map(rowToChange);
}

export async function pruneExpiredTombstones(env: Env, now = Date.now()): Promise<void> {
  const cutoff = now - TOMBSTONE_RETENTION_MS;
  const users = await env.DB.prepare(
    `SELECT user_id, MAX(rev) AS max_rev
     FROM sync_changes
     WHERE created_at < ?
     GROUP BY user_id`,
  )
    .bind(cutoff)
    .all<{ user_id: string; max_rev: number }>();
  for (const user of users.results) {
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE users SET min_available_rev = MAX(min_available_rev, ?) WHERE id = ?',
      ).bind(user.max_rev, user.user_id),
      env.DB.prepare(
        'DELETE FROM sync_changes WHERE user_id = ? AND created_at < ?',
      ).bind(user.user_id, cutoff),
      env.DB.prepare(
        'DELETE FROM dog_ears WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?',
      ).bind(user.user_id, cutoff),
      env.DB.prepare(
        'DELETE FROM digital_links WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?',
      ).bind(user.user_id, cutoff),
      env.DB.prepare(
        `DELETE FROM dog_ears
         WHERE user_id = ? AND book_id IN
           (SELECT id FROM books WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?)`,
      ).bind(user.user_id, user.user_id, cutoff),
      env.DB.prepare(
        `DELETE FROM digital_links
         WHERE user_id = ? AND book_id IN
           (SELECT id FROM books WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?)`,
      ).bind(user.user_id, user.user_id, cutoff),
      env.DB.prepare(
        'DELETE FROM books WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?',
      ).bind(user.user_id, cutoff),
    ]);
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_flows WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM web_deletion_flows WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM deletion_tickets WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM anonymous_issuance WHERE updated_at < ?').bind(
      now - 48 * 60 * 60 * 1000,
    ),
    env.DB.prepare(
      'DELETE FROM sessions WHERE revoked_at IS NOT NULL AND revoked_at < ?',
    ).bind(now - 7 * 24 * 60 * 60 * 1000),
  ]);
}
