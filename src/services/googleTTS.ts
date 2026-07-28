import * as FileSystem from 'expo-file-system/legacy';
import { TTSOptions } from '../types/tts';
import { apiError, authenticatedFetch } from './authClient';
import { buildWorkerTtsRequest } from './ttsRequest';

export function audioCachePath(bookId: string, sentenceId: string): string {
  return `${FileSystem.cacheDirectory}audio/${bookId}/${sentenceId}.mp3`;
}

export function previewCachePath(voiceName: string, rate: number, pitch: number): string {
  const key = `${voiceName}_${rate}_${pitch}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `${FileSystem.cacheDirectory}audio/preview/${key}.mp3`;
}

async function ensureDir(path: string) {
  const dir = path.substring(0, path.lastIndexOf('/'));
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

async function synthesize(text: string, options: TTSOptions): Promise<string> {
  const res = await authenticatedFetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildWorkerTtsRequest(text, options)),
  });

  if (!res.ok) {
    throw new Error(await apiError(res, `音声生成に失敗しました (${res.status})`));
  }

  const json = (await res.json()) as
    | { audioContent: string; fallback: false }
    | { fallback: true };
  if (json.fallback) throw new Error('音声サーバーが設定されていません。');
  return json.audioContent;
}

export async function generateAndCache(
  text: string,
  options: TTSOptions,
  filePath: string
): Promise<string> {
  const info = await FileSystem.getInfoAsync(filePath);
  if (info.exists) return filePath;

  const base64 = await synthesize(text, options);
  await ensureDir(filePath);
  await FileSystem.writeAsStringAsync(filePath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return filePath;
}

export async function generatePreview(
  text: string,
  options: TTSOptions
): Promise<string> {
  const filePath = previewCachePath(options.voiceName, options.speakingRate, options.pitch);
  return generateAndCache(text, options, filePath);
}

export async function deleteCacheForBook(bookId: string): Promise<void> {
  const dir = `${FileSystem.cacheDirectory}audio/${bookId}`;
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
}

export async function deleteAllAudioCache(): Promise<void> {
  const dir = `${FileSystem.cacheDirectory}audio`;
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
}
