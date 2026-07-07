import type { QuizItem } from '../types/book';

/**
 * Extract a diagnosable error message from a failed response. Reads the body
 * as text first (a Response body can only be consumed once, so we can't try
 * `.json()` and fall back to `.text()` on the same response) and attempts to
 * parse it as our `{error}` shape. Platform-level failures (e.g. a Vercel
 * function timeout) return a non-JSON body — in that case we surface a
 * snippet of the raw text instead of silently discarding it, so the error is
 * actually diagnosable instead of just showing a bare status code.
 */
async function readError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) return parsed.error;
    } catch {
      // not JSON — fall through to the raw-text snippet below
    }
    const snippet = text.trim().slice(0, 200);
    if (snippet) return `${fallback}: ${snippet}`;
  }
  return fallback;
}

/**
 * Stream the generated summary script. `onProgress` receives the accumulated
 * text as it arrives; the resolved value is the complete text.
 */
export async function generateSummaryStream(
  topic: string,
  guidance: string | undefined,
  onProgress: (text: string) => void,
): Promise<string> {
  const res = await fetch('/api/generate-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, guidance }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `生成に失敗しました (${res.status})`));
  }
  if (!res.body) throw new Error('ストリーミングに対応していない応答です');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onProgress(full);
  }
  full += decoder.decode();
  if (!full.trim()) throw new Error('生成結果が空でした。もう一度お試しください。');
  return full;
}

export interface QuizResponse {
  quiz: QuizItem[];
  mock: boolean;
}

export async function generateQuiz(script: string): Promise<QuizResponse> {
  const res = await fetch('/api/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `クイズ生成に失敗しました (${res.status})`));
  }
  return res.json();
}

export type TTSResponse = { audioContent: string; fallback: false } | { fallback: true };

export interface Timepoint {
  markName: string;
  timeSeconds: number;
}

export type ChunkTTSResponse =
  | { audioContent: string; timepoints: Timepoint[]; fallback: false }
  | { fallback: true };

/**
 * Synthesize a multi-sentence chunk as one continuous utterance. Returns the
 * audio plus a start-time per sentence (keyed by sentence id) for highlight
 * sync and tap-to-seek.
 */
export async function synthesizeChunk(
  parts: { id: string; text: string }[],
  voiceName: string,
  pitch: number,
): Promise<ChunkTTSResponse> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts, voiceName, pitch }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `音声生成に失敗しました (${res.status})`));
  }
  return res.json();
}

export async function synthesize(
  text: string,
  voiceName: string,
  speakingRate: number,
  pitch: number,
): Promise<TTSResponse> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceName, speakingRate, pitch }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `音声生成に失敗しました (${res.status})`));
  }
  return res.json();
}
