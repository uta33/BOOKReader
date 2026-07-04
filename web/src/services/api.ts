import type { QuizItem } from '../types/book';

async function readError(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  return (err as { error?: string }).error ?? fallback;
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
