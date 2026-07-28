/**
 * AI要約。認証済みでCloudflare WorkerをHTTPS呼び出しする。
 *
 * クライアントに Anthropic SDK も API キーも置かない。
 * URL が設定されていなければ機能ごと出さない。
 */
import { apiBase, apiError, authenticatedFetch, isApiConfigured } from './authClient';
import { extractSummaryBody } from './summaryParser';

export function isSummaryApiConfigured(): boolean {
  return isApiConfigured();
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

  const res = await authenticatedFetch('/api/generate-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, guidance }),
    signal,
  });

  if (!res.ok) {
    throw new Error(await apiError(res, `生成に失敗しました (${res.status})`));
  }

  const text = await res.text();
  if (!text.trim()) {
    throw new Error('生成結果が空でした。もう一度お試しください。');
  }
  return extractSummaryBody(text);
}
