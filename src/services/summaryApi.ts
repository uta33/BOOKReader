/**
 * AI要約。web/ の Vercel Functions を HTTPS で呼ぶ。
 *
 * クライアントに Anthropic SDK も API キーも置かない（web/ と同じ性質を保つ）。
 * URL が設定されていなければ機能ごと出さない。
 */
import { useSettingsStore } from '../store/settingsStore';
import { extractSummaryBody } from './summaryParser';

const ENV_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

/** 設定画面での上書き > .env > 未設定。 */
export function apiBase(): string {
  const override = useSettingsStore.getState().apiBaseUrl?.trim().replace(/\/+$/, '');
  return override || ENV_BASE;
}

export function isSummaryApiConfigured(): boolean {
  return apiBase().length > 0;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      return json.error ?? json.message ?? text.slice(0, 200);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return fallback;
  }
}

/**
 * 要約を生成する。
 *
 * React Native の fetch には res.body（ReadableStream）が無いので、
 * web/ 側の getReader() によるストリーミングは移植できない。サーバーは
 * text/plain を流すので res.text() で透過的にバッファできる
 * ——エンドポイントは無変更で、クライアントだけが違う。
 */
export async function generateSummary(
  topic: string,
  guidance?: string,
  signal?: AbortSignal,
): Promise<{ title?: string; body: string }> {
  const base = apiBase();
  if (!base) {
    throw new Error('要約サーバーのURLが未設定です。設定画面で指定してください。');
  }

  const res = await fetch(`${base}/api/generate-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, guidance }),
    signal,
  });

  if (!res.ok) {
    throw new Error(await readError(res, `生成に失敗しました (${res.status})`));
  }

  const text = await res.text();
  if (!text.trim()) {
    throw new Error('生成結果が空でした。もう一度お試しください。');
  }
  return extractSummaryBody(text);
}
