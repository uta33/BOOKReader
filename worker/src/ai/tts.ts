import type { Env } from '../types';
import type { TtsPart } from '../limits';

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const BETA_ENDPOINT = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';

export function sanitizeForSpeech(raw: string): string {
  return raw
    .replace(/[[（(]?\b\d{1,2}:\d{2}(?::\d{2})?\b[\]）)]?/g, '')
    .replace(/[（(](間|笑い?|拍手|ため息|沈黙|ポーズ|BGM[^）)]*|効果音[^）)]*)[）)]/g, '')
    .replace(/(ナレーション|ナレーター|話者\s*\d*|スピーカー\s*\d*)\s*[:：]\s*/g, '')
    .replace(/[*_`#<>|~]+/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isChirp(voiceName: string): boolean {
  return /Chirp3/i.test(voiceName);
}

function hasSpeech(text: string): boolean {
  return /[0-9A-Za-zぁ-んァ-ヶ一-龯ｦ-ﾟＡ-Ｚａ-ｚ０-９]/.test(text);
}

function ensureSentenceEnd(text: string): string {
  if (/[。．！？!?]$/.test(text)) return text;
  return text.replace(/[、，,]$/, '') + '。';
}

async function callGoogle(env: Env, endpoint: string, body: unknown) {
  if (!env.GOOGLE_TTS_API_KEY) return undefined;
  const response = await fetch(`${endpoint}?key=${encodeURIComponent(env.GOOGLE_TTS_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Google TTS error: ${response.status}`);
  return response.json<Record<string, unknown>>();
}

export async function synthesize(
  env: Env,
  input: { text: string; voiceName: string; speakingRate: number; pitch: number },
) {
  const text = sanitizeForSpeech(input.text);
  const chirp = isChirp(input.voiceName);
  const body = {
    input: { text },
    voice: { languageCode: 'ja-JP', name: input.voiceName },
    audioConfig: chirp
      ? { audioEncoding: 'MP3' }
      : {
          audioEncoding: 'MP3',
          speakingRate: input.speakingRate,
          pitch: input.pitch,
        },
  };
  const json = await callGoogle(env, ENDPOINT, body);
  if (!json) return { fallback: true as const };
  return { audioContent: String(json.audioContent ?? ''), fallback: false as const };
}

export async function synthesizeChunk(
  env: Env,
  input: { parts: TtsPart[]; voiceName: string; pitch: number },
) {
  const parts = input.parts
    .map((part) => ({ ...part, text: sanitizeForSpeech(part.text) }))
    .filter((part) => part.text && hasSpeech(part.text));
  const chirp = isChirp(input.voiceName);
  const body = chirp
    ? {
        input: { text: parts.map((part) => ensureSentenceEnd(part.text)).join('') },
        voice: { languageCode: 'ja-JP', name: input.voiceName },
        audioConfig: { audioEncoding: 'MP3' },
      }
    : {
        input: {
          ssml: `<speak>${parts
            .map((part) => `<mark name="${escapeXml(part.id)}"/>${escapeXml(part.text)}`)
            .join('')}</speak>`,
        },
        voice: { languageCode: 'ja-JP', name: input.voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1, pitch: input.pitch },
        enableTimePointing: ['SSML_MARK'],
      };
  const json = await callGoogle(env, chirp ? ENDPOINT : BETA_ENDPOINT, body);
  if (!json) return { fallback: true as const };
  return {
    audioContent: String(json.audioContent ?? ''),
    timepoints: chirp ? [] : (json.timepoints ?? []),
    fallback: false as const,
  };
}
