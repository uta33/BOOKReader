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
// v1beta1 is required for enableTimePointing (SSML <mark> timepoints).
const BETA_ENDPOINT = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';

export interface ChunkPart {
  /** Sentence id — echoed back as the SSML mark name / timepoint key. */
  id: string;
  text: string;
}

export interface ChunkTTSInput {
  parts: ChunkPart[];
  voiceName: string;
  pitch: number;
}

export interface Timepoint {
  markName: string;
  timeSeconds: number;
}

export type ChunkTTSResult =
  | { audioContent: string; timepoints: Timepoint[]; fallback: false }
  | { fallback: true };

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Synthesize a multi-sentence chunk as ONE continuous utterance, with an SSML
 * <mark> before each sentence so the client gets a start-time per sentence
 * (highlight sync / tap-to-seek) out of a single seamless audio clip.
 * Speed is always 1.0 here — playback rate is applied client-side.
 */
export async function synthesizeChunk(input: ChunkTTSInput): Promise<ChunkTTSResult> {
  const parts = (input.parts ?? [])
    .map((p) => ({ id: String(p.id ?? ''), text: sanitizeForSpeech(p.text ?? '') }))
    .filter((p) => p.id && p.text);
  if (parts.length === 0) throw new Error('parts are required');

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return { fallback: true };

  const ssml = `<speak>${parts
    .map((p) => `<mark name="${escapeXml(p.id)}"/>${escapeXml(p.text)}`)
    .join('')}</speak>`;

  const body = {
    input: { ssml },
    voice: { languageCode: 'ja-JP', name: input.voiceName },
    audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: input.pitch },
    enableTimePointing: ['SSML_MARK'],
  };

  const res = await fetch(`${BETA_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google TTS error: ${res.status} ${err}`);
  }
  const json = (await res.json()) as { audioContent: string; timepoints?: Timepoint[] };
  return { audioContent: json.audioContent, timepoints: json.timepoints ?? [], fallback: false };
}

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
    .replace(/[*_`#<>|~]+/g, '')
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
