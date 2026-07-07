export interface TTSInput {
  text: string;
  voiceName: string;
  speakingRate: number;
  pitch: number;
}

export type TTSResult =
  | { audioContent: string; fallback: false }
  | { fallback: true };

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/**
 * Remove notation the TTS engine would vocalize awkwardly — markdown
 * leftovers, transcript timestamps, and stage directions — so narration
 * stays smooth even for books imported before the client-side cleanup.
 */
export function sanitizeForSpeech(raw: string): string {
  return raw
    .replace(/[[（(]?\b\d{1,2}:\d{2}(?::\d{2})?\b[\]）)]?/g, '') // timestamps
    .replace(/[（(](間|笑い?|拍手|ため息|沈黙|ポーズ|BGM[^）)]*|効果音[^）)]*)[）)]/g, '')
    .replace(/(ナレーション|ナレーター|話者\s*\d*|スピーカー\s*\d*)\s*[:：]\s*/g, '')
    .replace(/[*_`#>|~]+/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Synthesize Japanese speech via Google Cloud TTS.
 * Returns { fallback: true } when no key is configured so the browser can fall
 * back to the built-in SpeechSynthesis API (zero-config audio).
 */
export async function synthesize(input: TTSInput): Promise<TTSResult> {
  const text = sanitizeForSpeech(input.text ?? '');
  if (!text) throw new Error('text is required');

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return { fallback: true };

  const body = {
    input: { text },
    voice: { languageCode: 'ja-JP', name: input.voiceName },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: input.speakingRate,
      pitch: input.pitch,
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google TTS error: ${res.status} ${err}`);
  }
  const json = (await res.json()) as { audioContent: string };
  return { audioContent: json.audioContent, fallback: false };
}
