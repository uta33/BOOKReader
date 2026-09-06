/**
 * AI要約。認証済みでCloudflare WorkerをHTTPS呼び出しする。
 *
 * クライアントに Anthropic SDK も API キーも置かない。
 * URL が設定されていなければ機能ごと出さない。
 */
import { apiBase, apiError, authenticatedFetch, isApiConfigured } from './authClient';
import { extractSummaryBody } from './summaryParser';
import type { Book } from '../types/book';

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

/** サーバーへ渡す抜き書き。写真や復習の状態は要らないので送らない。 */
function excerptsOf(book: Book) {
  return book.dogEars
    .filter((dogEar) => !dogEar.deletedAt && dogEar.quote.trim().length > 0)
    .map((dogEar) => ({
      page: dogEar.page,
      line: dogEar.line,
      quote: dogEar.quote,
      comment: dogEar.comment,
    }));
}

function noteBody(book: Book) {
  return {
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    pubdate: book.pubdate,
    isbn: book.isbn,
    blurb: book.blurb,
    excerpts: excerptsOf(book),
    purposes: book.purposes,
  };
}

async function postNote<T>(path: string, book: Book, signal?: AbortSignal): Promise<T> {
  const base = apiBase();
  if (!base) {
    throw new Error('APIサーバーのURLが未設定です。設定画面で指定してください。');
  }
  const res = await authenticatedFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteBody(book)),
    signal,
  });
  if (!res.ok) {
    throw new Error(await apiError(res, `生成に失敗しました (${res.status})`));
  }
  return (await res.json()) as T;
}

/** どの材料から書かれたか。UIに出して、AIが書いた文の出所を分かるようにする。 */
export type SummaryGrounding = 'dogears' | 'blurb' | 'none';

export interface NoteSummary {
  body: string;
  grounded: SummaryGrounding;
  excerptCount: number;
}

/**
 * マガジンノートの「まとめ」を生成する。
 *
 * `generateSummary`（朗読台本）と違い、**書名ではなく本人の抜き書きが材料**。
 * 材料が無ければ `grounded: 'none'` が返り、本文は空になる——
 * 知らない本を創作させるより、書けないと答えるほうが正しい。
 */
export function generateNoteSummary(book: Book, signal?: AbortSignal): Promise<NoteSummary> {
  return postNote<NoteSummary>('/v1/note-summary', book, signal);
}

/**
 * ふりかえりのための問いを3つもらう。
 *
 * ふりかえりは自分の言葉で書くものなので、**本文はAIに書かせない。**
 */
export async function fetchRecapQuestions(
  book: Book,
  signal?: AbortSignal,
): Promise<string[]> {
  const { questions } = await postNote<{ questions: string[] }>(
    '/v1/recap-questions',
    book,
    signal,
  );
  return questions;
}
