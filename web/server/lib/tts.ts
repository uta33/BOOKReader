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
  // Punctuation-only fragments (ellipsis lines, dangling 」 from quote
  // splitting) carry nothing to speak — drop them from the audio.
  const parts = (input.parts ?? [])
    .map((p) => ({ id: String(p.id ?? ''), text: sanitizeForSpeech(p.text ?? '') }))
    .filter((p) => p.id && p.text && hasSpeech(p.text));
  if (parts.length === 0) throw new Error('parts are required');

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return { fallback: true };

  // Chirp3-HD rejects SSML (so no mark timepoints), pitch and speakingRate.
  // Send plain text on v1; the client estimates sentence positions from
  // character offsets instead of marks.
  const chirp = isChirp(input.voiceName);
  const body = chirp
    ? {
        input: { text: parts.map((p) => ensureSentenceEnd(p.text)).join('') },
        voice: { languageCode: 'ja-JP', name: input.voiceName },
        audioConfig: { audioEncoding: 'MP3' },
      }
    : {
        input: {
          ssml: `<speak>${parts
            .map((p) => `<mark name="${escapeXml(p.id)}"/>${escapeXml(p.text)}`)
            .join('')}</speak>`,
        },
        voice: { languageCode: 'ja-JP', name: input.voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: input.pitch },
        enableTimePointing: ['SSML_MARK'],
      };

  const res = await fetch(`${chirp ? ENDPOINT : BETA_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google TTS error: ${res.status} ${err}`);
  }
  const json = (await res.json()) as { audioContent: string; timepoints?: Timepoint[] };
  // Chirp (plain-text) clips carry no marks by definition — an empty list is
  // the client's signal to use character-proportional highlight sync.
  const timepoints = chirp ? [] : (json.timepoints ?? []);
  return { audioContent: json.audioContent, timepoints, fallback: false };
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
/** Chirp3-HD voices reject SSML, pitch and speakingRate parameters. */
function isChirp(voiceName: string): boolean {
  return /Chirp3/i.test(voiceName);
}

/** Does the text contain anything speakable (kana/kanji/letters/digits)? */
function hasSpeech(text: string): boolean {
  return /[0-9A-Za-zぁ-んァ-ヶ一-龯ｦ-ﾟＡ-Ｚａ-ｚ０-９]/.test(text);
}

/**
 * Guarantee the fragment reads as a full sentence to the TTS segmenter.
 * The splitter emits comma-bounded fragments (long-sentence subdivision) and
 * quote-only lines; joined bare, they merge into one endless "sentence" that
 * Chirp3-HD rejects with INVALID_ARGUMENT ("sentences that are too long").
 */
function ensureSentenceEnd(text: string): string {
  if (/[。．！？!?]$/.test(text)) return text;
  return text.replace(/[、，,]$/, '') + '。';
}

export async function synthesize(input: TTSInput): Promise<TTSResult> {
  const text = sanitizeForSpeech(input.text ?? '');
  if (!text) throw new Error('text is required');

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return { fallback: true };

  const body = {
    input: { text },
    voice: { languageCode: 'ja-JP', name: input.voiceName },
    audioConfig: isChirp(input.voiceName)
      ? { audioEncoding: 'MP3' }
      : {
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
