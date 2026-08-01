import { ApiError } from './errors';
import type { Env } from './types';

export const ATTACHMENT_LIMITS = {
  maxBytes: 12 * 1024 * 1024,
  maxFilesPerUser: 500,
  maxBytesPerUser: 250 * 1024 * 1024,
} as const;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

interface AttachmentRow {
  id: string;
  user_id: string;
  dog_ear_id: string;
  object_key: string;
  content_type: string;
  size_bytes: number;
}

interface UsageRow {
  count?: number;
  bytes?: number;
}

export function validateAttachmentMetadata(
  attachmentId: unknown,
  dogEarId: unknown,
  contentType: unknown,
  sizeBytes: unknown,
): { attachmentId: string; dogEarId: string; contentType: string; sizeBytes: number } {
  if (typeof attachmentId !== 'string' || !SAFE_ID.test(attachmentId)) {
    throw new ApiError(400, 'attachment id is invalid');
  }
  if (typeof dogEarId !== 'string' || !SAFE_ID.test(dogEarId)) {
    throw new ApiError(400, 'X-Dog-Ear-Id is invalid');
  }
  const normalizedType =
    typeof contentType === 'string' ? contentType.split(';', 1)[0].trim().toLowerCase() : '';
  if (!ALLOWED_IMAGE_TYPES.has(normalizedType)) {
    throw new ApiError(415, 'Only JPG, PNG, WebP, GIF, AVIF, and BMP images are supported');
  }
  if (
    typeof sizeBytes !== 'number' ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > ATTACHMENT_LIMITS.maxBytes
  ) {
    throw new ApiError(413, 'Image must be between 1 byte and 12 MB');
  }
  return { attachmentId, dogEarId, contentType: normalizedType, sizeBytes };
}

export async function putAttachment(
  env: Env,
  userId: string,
  attachmentId: unknown,
  request: Request,
) {
  const declaredLength = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > ATTACHMENT_LIMITS.maxBytes) {
    throw new ApiError(413, 'Image must be 12 MB or smaller');
  }
  const body = await request.arrayBuffer();
  const metadata = validateAttachmentMetadata(
    attachmentId,
    request.headers.get('X-Dog-Ear-Id'),
    request.headers.get('Content-Type'),
    body.byteLength,
  );

  const [dogEar, sameId, sameDogEar, usage] = await env.DB.batch([
    env.DB.prepare(
      'SELECT payload_json FROM dog_ears WHERE user_id = ? AND id = ? AND deleted_at IS NULL',
    ).bind(userId, metadata.dogEarId),
    env.DB.prepare('SELECT * FROM attachments WHERE id = ?').bind(metadata.attachmentId),
    env.DB.prepare(
      'SELECT * FROM attachments WHERE user_id = ? AND dog_ear_id = ?',
    ).bind(userId, metadata.dogEarId),
    env.DB.prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes
       FROM attachments WHERE user_id = ? AND id <> ? AND dog_ear_id <> ?`,
    ).bind(userId, metadata.attachmentId, metadata.dogEarId),
  ]);
  const dogEarRow = dogEar.results[0] as { payload_json?: string } | undefined;
  if (!dogEarRow) throw new ApiError(409, 'Dog-ear must be synced before its image');
  const payload = parsePayload(dogEarRow.payload_json);
  if (payload.photoAttachmentId !== metadata.attachmentId) {
    throw new ApiError(409, 'Dog-ear does not reference this attachment');
  }

  const idRow = sameId.results[0] as unknown as AttachmentRow | undefined;
  if (idRow && idRow.user_id !== userId) throw new ApiError(409, 'Attachment id is already used');
  const previous = sameDogEar.results[0] as unknown as AttachmentRow | undefined;
  const totals = usage.results[0] as UsageRow | undefined;
  const nextCount = Number(totals?.count ?? 0) + 1;
  const nextBytes = Number(totals?.bytes ?? 0) + metadata.sizeBytes;
  if (nextCount > ATTACHMENT_LIMITS.maxFilesPerUser) {
    throw new ApiError(429, 'Image backup limit of 500 files has been reached');
  }
  if (nextBytes > ATTACHMENT_LIMITS.maxBytesPerUser) {
    throw new ApiError(429, 'Image backup limit of 250 MB has been reached');
  }

  const objectKey = `attachments/${userId}/${metadata.attachmentId}`;
  await env.ATTACHMENTS.put(objectKey, body, {
    httpMetadata: { contentType: metadata.contentType },
    customMetadata: { dogEarId: metadata.dogEarId },
  });
  const now = Date.now();
  try {
    await env.DB.batch([
      env.DB.prepare(
        'DELETE FROM attachments WHERE user_id = ? AND dog_ear_id = ? AND id <> ?',
      ).bind(userId, metadata.dogEarId, metadata.attachmentId),
      env.DB.prepare(
        `INSERT INTO attachments
         (id, user_id, dog_ear_id, object_key, content_type, size_bytes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           dog_ear_id = excluded.dog_ear_id,
           object_key = excluded.object_key,
           content_type = excluded.content_type,
           size_bytes = excluded.size_bytes,
           updated_at = excluded.updated_at`,
      ).bind(
        metadata.attachmentId,
        userId,
        metadata.dogEarId,
        objectKey,
        metadata.contentType,
        metadata.sizeBytes,
        idRow ? now : now,
        now,
      ),
    ]);
  } catch (error) {
    if (!idRow) await env.ATTACHMENTS.delete(objectKey).catch(() => undefined);
    throw error;
  }
  if (previous && previous.id !== metadata.attachmentId) {
    await env.ATTACHMENTS.delete(previous.object_key);
  }
  return {
    attachmentId: metadata.attachmentId,
    sizeBytes: metadata.sizeBytes,
    mimeType: metadata.contentType,
  };
}

export async function getAttachment(
  env: Env,
  userId: string,
  attachmentId: unknown,
): Promise<Response> {
  const id = validateId(attachmentId);
  const row = await env.DB.prepare(
    'SELECT * FROM attachments WHERE id = ? AND user_id = ?',
  ).bind(id, userId).first<AttachmentRow>();
  if (!row) throw new ApiError(404, 'Image was not found');
  const object = await env.ATTACHMENTS.get(row.object_key);
  if (!object) throw new ApiError(404, 'Image data was not found');
  const headers = new Headers({
    'Content-Type': row.content_type,
    'Content-Length': String(row.size_bytes),
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  });
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  return new Response(object.body, { headers });
}

export async function deleteAttachment(
  env: Env,
  userId: string,
  attachmentId: unknown,
) {
  const id = validateId(attachmentId);
  const row = await env.DB.prepare(
    'SELECT * FROM attachments WHERE id = ? AND user_id = ?',
  ).bind(id, userId).first<AttachmentRow>();
  if (!row) return { deleted: true as const };
  await env.ATTACHMENTS.delete(row.object_key);
  await env.DB.prepare('DELETE FROM attachments WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return { deleted: true as const };
}

export async function deleteUserAttachmentObjects(env: Env, userId: string): Promise<void> {
  const rows = await attachmentRowsForUser(env, userId);
  for (let offset = 0; offset < rows.length; offset += 100) {
    await env.ATTACHMENTS.delete(rows.slice(offset, offset + 100).map((row) => row.object_key));
  }
}

export async function mergeUserAttachments(
  env: Env,
  sourceUserId: string,
  targetUserId: string,
): Promise<void> {
  const sourceRows = await attachmentRowsForUser(env, sourceUserId);
  for (const source of sourceRows) {
    const dogEar = await env.DB.prepare(
      'SELECT payload_json FROM dog_ears WHERE user_id = ? AND id = ?',
    ).bind(targetUserId, source.dog_ear_id).first<{ payload_json: string }>();
    const expectedId = parsePayload(dogEar?.payload_json).photoAttachmentId;
    const targetRows = await env.DB.prepare(
      'SELECT * FROM attachments WHERE user_id = ? AND dog_ear_id = ?',
    ).bind(targetUserId, source.dog_ear_id).all<AttachmentRow>();

    if (expectedId === source.id || (expectedId === undefined && targetRows.results.length === 0)) {
      for (const duplicate of targetRows.results) {
        await env.ATTACHMENTS.delete(duplicate.object_key);
        await env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(duplicate.id).run();
      }
      await env.DB.prepare('UPDATE attachments SET user_id = ?, updated_at = ? WHERE id = ?')
        .bind(targetUserId, Date.now(), source.id)
        .run();
    } else {
      await env.ATTACHMENTS.delete(source.object_key);
      await env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(source.id).run();
    }
  }
}

async function attachmentRowsForUser(env: Env, userId: string): Promise<AttachmentRow[]> {
  const rows = await env.DB.prepare('SELECT * FROM attachments WHERE user_id = ?')
    .bind(userId)
    .all<AttachmentRow>();
  return rows.results;
}

function validateId(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new ApiError(400, 'attachment id is invalid');
  }
  return value;
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
