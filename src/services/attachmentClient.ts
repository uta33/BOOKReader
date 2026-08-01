import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { apiBase, apiError, authenticatedFetch, ensureSession } from './authClient';
import {
  imageMimeType,
  persistDownloadedDogEarImage,
  type PendingDogEarImage,
} from './dogEarImage';

export function createAttachmentId(): string {
  return `att_${Crypto.randomUUID()}`;
}

export async function uploadAttachment(
  attachmentId: string,
  dogEarId: string,
  photoUri: string,
): Promise<void> {
  const file = new File(photoUri);
  if (!file.exists) throw new Error('バックアップする画像が端末に見つかりません。');
  const mimeType = imageMimeType({ uri: photoUri, fileName: file.name });
  const session = await ensureSession();
  const result = await file.upload(`${apiBase()}/v1/attachments/${encodeURIComponent(attachmentId)}`, {
    httpMethod: 'PUT',
    mimeType,
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': mimeType,
      'X-Dog-Ear-Id': dogEarId,
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(readUploadError(result.body, `画像をバックアップできませんでした (${result.status})`));
  }
}

export async function downloadAttachment(
  attachmentId: string,
  dogEarId: string,
): Promise<string> {
  const response = await authenticatedFetch(`/v1/attachments/${encodeURIComponent(attachmentId)}`);
  if (!response.ok) {
    throw new Error(await apiError(response, `画像を復元できませんでした (${response.status})`));
  }
  const mimeType = response.headers.get('Content-Type')?.split(';', 1)[0] ?? 'image/jpeg';
  const bytes = new Uint8Array(await response.arrayBuffer());
  return persistDownloadedDogEarImage(bytes, mimeType, dogEarId);
}

export async function deleteAttachment(attachmentId?: string): Promise<void> {
  if (!attachmentId) return;
  const response = await authenticatedFetch(`/v1/attachments/${encodeURIComponent(attachmentId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(await apiError(response, `画像バックアップを削除できませんでした (${response.status})`));
  }
}

function readUploadError(body: string, fallback: string): string {
  try {
    return (JSON.parse(body) as { error?: string }).error ?? fallback;
  } catch {
    return body.trim().slice(0, 200) || fallback;
  }
}
