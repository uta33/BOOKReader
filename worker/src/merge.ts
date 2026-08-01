import type { EntityType, Env } from './types';
import { mergeUserAttachments } from './attachments';

export interface DomainRow {
  id: string;
  book_id?: string;
  isbn?: string | null;
  payload_json: string;
  updated_at: number;
  deleted_at: number | null;
  origin_device_id: string;
}

interface CanonicalRow extends DomainRow {
  entity: EntityType;
}

export interface AccountMergePlan {
  writes: CanonicalRow[];
  bookIdMap: Map<string, string>;
}

export function mergeBookPayload(
  target: DomainRow,
  source: DomainRow,
): { payload: Record<string, unknown>; winner: DomainRow } {
  const targetPayload = parsePayload(target.payload_json);
  const sourcePayload = parsePayload(source.payload_json);
  const winner = compareRows(source, target) > 0 ? source : target;
  const winningPayload = winner === source ? sourcePayload : targetPayload;
  const targetPurposes = Array.isArray(targetPayload.purposes) ? targetPayload.purposes : [];
  const sourcePurposes = Array.isArray(sourcePayload.purposes) ? sourcePayload.purposes : [];
  return {
    payload: {
      ...winningPayload,
      purposes: [...new Set([...targetPurposes, ...sourcePurposes])],
      lastSentenceIdx: Math.max(
        numberValue(targetPayload.lastSentenceIdx),
        numberValue(sourcePayload.lastSentenceIdx),
      ),
    },
    winner,
  };
}

export async function mergeAccounts(
  env: Env,
  sourceUserId: string,
  targetUserId: string,
  mergeId: string,
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO account_merges (id, source_user_id, target_user_id, status, created_at)
     VALUES (?, ?, ?, 'running', ?)
     ON CONFLICT(id) DO UPDATE SET status = 'running', error = NULL`,
  )
    .bind(mergeId, sourceUserId, targetUserId, now)
    .run();

  try {
    const loaded = await env.DB.batch([
      env.DB.prepare('SELECT * FROM books WHERE user_id = ?').bind(sourceUserId),
      env.DB.prepare('SELECT * FROM books WHERE user_id = ?').bind(targetUserId),
      env.DB.prepare('SELECT * FROM dog_ears WHERE user_id = ?').bind(sourceUserId),
      env.DB.prepare('SELECT * FROM dog_ears WHERE user_id = ?').bind(targetUserId),
      env.DB.prepare('SELECT * FROM digital_links WHERE user_id = ?').bind(sourceUserId),
      env.DB.prepare('SELECT * FROM digital_links WHERE user_id = ?').bind(targetUserId),
    ]);
    const sourceBooks = loaded[0].results as unknown as DomainRow[];
    const targetBooks = loaded[1].results as unknown as DomainRow[];
    const sourceDogEars = loaded[2].results as unknown as DomainRow[];
    const targetDogEars = loaded[3].results as unknown as DomainRow[];
    const sourceLinks = loaded[4].results as unknown as DomainRow[];
    const targetLinks = loaded[5].results as unknown as DomainRow[];

    const { writes } = planAccountMerge(
      sourceUserId,
      sourceBooks,
      targetBooks,
      sourceDogEars,
      targetDogEars,
      sourceLinks,
      targetLinks,
    );

    for (let offset = 0; offset < writes.length; offset += 20) {
      const statements = writes
        .slice(offset, offset + 20)
        .flatMap((row) => canonicalStatements(env, targetUserId, row, Date.now()));
      if (statements.length) await env.DB.batch(statements);
    }

    await mergeUserAttachments(env, sourceUserId, targetUserId);

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE account_merges SET status = 'complete', completed_at = ? WHERE id = ?`,
      ).bind(Date.now(), mergeId),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(sourceUserId),
      env.DB.prepare('DELETE FROM account_merges WHERE id = ?').bind(mergeId),
    ]);
  } catch (error) {
    await env.DB.prepare(
      `UPDATE account_merges SET status = 'failed', error = ? WHERE id = ?`,
    )
      .bind(error instanceof Error ? error.message.slice(0, 500) : 'merge failed', mergeId)
      .run();
    throw error;
  }
}

export function planAccountMerge(
  sourceUserId: string,
  sourceBooks: DomainRow[],
  targetBooks: DomainRow[],
  sourceDogEars: DomainRow[],
  targetDogEars: DomainRow[],
  sourceLinks: DomainRow[],
  targetLinks: DomainRow[],
): AccountMergePlan {
  const targetBookIds = new Set(targetBooks.map((row) => row.id));
  const targetByIsbn = new Map(
    targetBooks.filter((row) => row.isbn).map((row) => [row.isbn as string, row]),
  );
  const bookIdMap = new Map<string, string>();
  const bookWrites = new Map<string, CanonicalRow>();

  for (const source of sourceBooks) {
    const duplicate = source.isbn ? targetByIsbn.get(source.isbn) : undefined;
    if (duplicate) {
      const merged = mergeBookPayload(duplicate, source);
      bookIdMap.set(source.id, duplicate.id);
      const canonical: CanonicalRow = {
        ...merged.winner,
        id: duplicate.id,
        isbn: duplicate.isbn,
        payload_json: JSON.stringify(merged.payload),
        entity: 'book',
      };
      bookWrites.set(canonical.id, canonical);
      targetByIsbn.set(source.isbn as string, canonical);
      continue;
    }
    let targetId = source.id;
    if (targetBookIds.has(targetId)) {
      targetId = deterministicMergedId(source.id, sourceUserId);
    }
    targetBookIds.add(targetId);
    bookIdMap.set(source.id, targetId);
    const canonical: CanonicalRow = { ...source, id: targetId, entity: 'book' };
    bookWrites.set(canonical.id, canonical);
    if (canonical.isbn) targetByIsbn.set(canonical.isbn, canonical);
  }

  const writes: CanonicalRow[] = [...bookWrites.values()];
  mergeChildren(sourceDogEars, targetDogEars, bookIdMap, 'dogEar', writes);
  mergeChildren(sourceLinks, targetLinks, bookIdMap, 'digitalLink', writes);
  return { writes, bookIdMap };
}

export function deterministicMergedId(sourceId: string, sourceUserId: string): string {
  return `${sourceId.slice(0, 80)}_merged_${sourceUserId.slice(0, 36)}`;
}

function mergeChildren(
  sourceRows: DomainRow[],
  targetRows: DomainRow[],
  bookIdMap: Map<string, string>,
  entity: 'dogEar' | 'digitalLink',
  writes: CanonicalRow[],
): void {
  const targetById = new Map(targetRows.map((row) => [row.id, row]));
  for (const source of sourceRows) {
    const current = targetById.get(source.id);
    const winner = current && compareRows(current, source) >= 0 ? current : source;
    writes.push({
      ...winner,
      book_id:
        winner === current
          ? current.book_id
          : bookIdMap.get(source.book_id ?? '') ?? source.book_id,
      entity,
    });
  }
}

function canonicalStatements(
  env: Env,
  userId: string,
  row: CanonicalRow,
  now: number,
): D1PreparedStatement[] {
  const table =
    row.entity === 'book'
      ? 'books'
      : row.entity === 'dogEar'
        ? 'dog_ears'
        : 'digital_links';
  const bump = env.DB.prepare(
    'UPDATE users SET seq = seq + 1 WHERE id = ? RETURNING seq',
  ).bind(userId);
  const upsert =
    row.entity === 'book'
      ? env.DB.prepare(
          `INSERT INTO books
           (user_id, id, isbn, payload_json, updated_at, deleted_at, origin_device_id, rev)
           VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT seq FROM users WHERE id = ?))
           ON CONFLICT(user_id, id) DO UPDATE SET
             isbn = excluded.isbn, payload_json = excluded.payload_json,
             updated_at = excluded.updated_at, deleted_at = excluded.deleted_at,
             origin_device_id = excluded.origin_device_id, rev = excluded.rev`,
        ).bind(
          userId,
          row.id,
          row.isbn ?? null,
          row.payload_json,
          row.updated_at,
          row.deleted_at,
          row.origin_device_id,
          userId,
        )
      : env.DB.prepare(
          `INSERT INTO ${table}
           (user_id, id, book_id, payload_json, updated_at, deleted_at, origin_device_id, rev)
           VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT seq FROM users WHERE id = ?))
           ON CONFLICT(user_id, id) DO UPDATE SET
             book_id = excluded.book_id, payload_json = excluded.payload_json,
             updated_at = excluded.updated_at, deleted_at = excluded.deleted_at,
             origin_device_id = excluded.origin_device_id, rev = excluded.rev`,
        ).bind(
          userId,
          row.id,
          row.book_id,
          row.payload_json,
          row.updated_at,
          row.deleted_at,
          row.origin_device_id,
          userId,
        );
  const log = env.DB.prepare(
    `INSERT INTO sync_changes
     (user_id, rev, entity_type, entity_id, book_id, payload_json, updated_at,
      deleted_at, origin_device_id, created_at)
     VALUES (?, (SELECT seq FROM users WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    userId,
    userId,
    row.entity,
    row.id,
    row.book_id ?? null,
    row.payload_json,
    row.updated_at,
    row.deleted_at,
    row.origin_device_id,
    now,
  );
  return [bump, upsert, log];
}

function compareRows(left: DomainRow, right: DomainRow): number {
  if (left.updated_at !== right.updated_at) return left.updated_at - right.updated_at;
  const deleted = Number(left.deleted_at !== null) - Number(right.deleted_at !== null);
  if (deleted) return deleted;
  return left.origin_device_id.localeCompare(right.origin_device_id);
}

function parsePayload(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
