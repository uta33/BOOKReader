import * as FileSystem from 'expo-file-system';
import { TTSOptions } from '../types/tts';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_TTS_API_KEY ?? '';
const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

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
  const body = {
    input: { text },
    voice: { languageCode: 'ja-JP', name: options.voiceName },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: options.speakingRate,
      pitch: options.pitch,
    },
  };

  const res = await fetch(`${TTS_ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS API error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json.audioContent as string;
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
