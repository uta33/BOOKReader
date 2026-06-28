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
 * Synthesize Japanese speech via Google Cloud TTS.
 * Returns { fallback: true } when no key is configured so the browser can fall
 * back to the built-in SpeechSynthesis API (zero-config audio).
 */
export async function synthesize(input: TTSInput): Promise<TTSResult> {
  const text = input.text?.trim();
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
