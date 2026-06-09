import * as FileSystem from 'expo-file-system';
import { TTSOptions } from '../types/tts';

// .trim() + BOM除去：Windows PowerShellがUTF-16/BOM付きで.envを作った場合の防御
const API_KEY = (process.env.EXPO_PUBLIC_GOOGLE_TTS_API_KEY ?? '')
  .replace(/﻿/g, '')
  .trim();
const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 4000, 8000];

/** 設定（音声・速度・ピッチ）ごとに別ディレクトリへキャッシュする */
function optionsKey(options: TTSOptions): string {
  return `${options.voiceName}_${options.speakingRate}_${options.pitch}`.replace(
    /[^a-zA-Z0-9_.-]/g,
    '_'
  );
}

export function audioCachePath(
  bookId: string,
  sentenceId: string,
  options: TTSOptions
): string {
  return `${FileSystem.cacheDirectory}audio/${bookId}/${optionsKey(options)}/${sentenceId}.mp3`;
}

export function previewCachePath(options: TTSOptions): string {
  return `${FileSystem.cacheDirectory}audio/preview/${optionsKey(options)}.mp3`;
}

async function ensureDir(path: string) {
  const dir = path.substring(0, path.lastIndexOf('/'));
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

function apiErrorMessage(status: number, body: string): string {
  if (status === 403) {
    return (
      'TTS APIへのアクセスが拒否されました (403)。\n\n' +
      '確認事項：\n' +
      '1. .env の EXPO_PUBLIC_GOOGLE_TTS_API_KEY が正しいか\n' +
      '2. Google Cloud Console で Cloud Text-to-Speech API が有効か\n' +
      '3. APIキーに制限がかかっていないか\n\n' +
      'Windows では .env を UTF-8 で作成してください：\n' +
      'Set-Content -Path .env -Value "EXPO_PUBLIC_GOOGLE_TTS_API_KEY=..." -Encoding ascii'
    );
  }
  if (status === 400) {
    return `TTSリクエストが不正です (400)。音声名や設定値を確認してください。\n${body}`;
  }
  if (status === 429) {
    return 'TTS APIのレート制限に達しました (429)。しばらく待ってから再試行してください。';
  }
  return `TTS APIエラー (${status})：${body}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function synthesize(text: string, options: TTSOptions): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      'Google TTS APIキーが設定されていません。\n\n' +
        'プロジェクトルートに .env ファイルを UTF-8 で作成してください：\n' +
        'EXPO_PUBLIC_GOOGLE_TTS_API_KEY=あなたのAPIキー\n\n' +
        'Windows PowerShell の場合：\n' +
        'Set-Content -Path .env -Value "EXPO_PUBLIC_GOOGLE_TTS_API_KEY=..." -Encoding ascii\n\n' +
        '作成後はキャッシュをクリアして再起動：npx expo start --clear'
    );
  }

  const body = {
    input: { text },
    voice: { languageCode: 'ja-JP', name: options.voiceName },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: options.speakingRate,
      pitch: options.pitch,
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${TTS_ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const json = await res.json();
      return json.audioContent as string;
    }

    const errBody = await res.text();
    lastError = new Error(apiErrorMessage(res.status, errBody));

    // 429（レート制限）と5xx（サーバーエラー）のみリトライ
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) break;

    await sleep(RETRY_DELAYS_MS[attempt]);
  }

  throw lastError ?? new Error('TTS APIエラー：不明なエラー');
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
  const filePath = previewCachePath(options);
  return generateAndCache(text, options, filePath);
}

export async function deleteCacheForBook(bookId: string): Promise<void> {
  const dir = `${FileSystem.cacheDirectory}audio/${bookId}`;
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
}
