export interface GenerateResponse {
  title: string;
  script: string;
  mock: boolean;
}

export async function generateSummary(topic: string, guidance?: string): Promise<GenerateResponse> {
  const res = await fetch('/api/generate-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, guidance }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `生成に失敗しました (${res.status})`);
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
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `音声生成に失敗しました (${res.status})`);
  }
  return res.json();
}
