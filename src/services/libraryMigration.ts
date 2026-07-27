/**
 * 永続化された蔵書レコードを現行スキーマへ正規化する。
 *
 * このファイルは `react-native` / `expo-*` / AsyncStorage を **import しない**。
 * `tsx` で直接実行してユニットテストできる状態を保つため。
 */
import { isPurposeId } from '../constants/purposes';
import type { Book, DigitalLink, DogEar, LinkKind, Sentence } from '../types/book';

const LINK_KINDS: readonly LinkKind[] = ['notebooklm', 'claude', 'gdocs', 'other'];

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function optNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function counter(): () => string {
  let n = 0;
  return () => `gen_${Date.now().toString(36)}_${(n++).toString(36)}`;
}

function normalizeDogEar(raw: unknown, nextId: () => string): DogEar | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const quote = str(r.quote);
  // 引用のない抜き書きは描画できないので落とす。
  if (!quote) return null;
  return {
    id: str(r.id) ?? nextId(),
    page: Math.max(0, Math.trunc(num(r.page, 0))),
    line: optNum(r.line),
    quote,
    comment: str(r.comment),
    createdAt: num(r.createdAt, 0),
    updatedAt: optNum(r.updatedAt),
    photoUri: str(r.photoUri),
  };
}

function normalizeLink(raw: unknown, nextId: () => string): DigitalLink | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const url = str(r.url);
  if (!url) return null;
  const kind = r.kind;
  return {
    id: str(r.id) ?? nextId(),
    label: str(r.label) ?? url,
    url,
    kind: LINK_KINDS.includes(kind as LinkKind) ? (kind as LinkKind) : 'other',
    createdAt: num(r.createdAt, 0),
  };
}

/**
 * 1レコードを現行スキーマへ。冪等・全域（例外を投げない）で、
 * 描画不能なレコードは null を返して呼び出し側で落とす。
 */
export function normalizeBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const title = str(r.title);
  if (!id || !title) return null;

  const nextId = counter();

  return {
    id,
    title,
    // 旧レコードには kind が無い。旧アプリは取り込みでしか本を作れなかったので
    // 'content' に倒すのが正しい。'paper' は明示されたときだけ。
    kind: r.kind === 'paper' ? 'paper' : 'content',
    uri: str(r.uri) ?? '',
    totalPages: Math.max(0, Math.trunc(num(r.totalPages, 0))),
    sentences: Array.isArray(r.sentences) ? (r.sentences as Sentence[]) : [],
    lastSentenceIdx: Math.max(0, Math.trunc(num(r.lastSentenceIdx, 0))),
    cachedSentenceIds: Array.isArray(r.cachedSentenceIds)
      ? (r.cachedSentenceIds as string[])
      : [],
    createdAt: num(r.createdAt, 0),

    dogEars: Array.isArray(r.dogEars)
      ? r.dogEars
          .map((d) => normalizeDogEar(d, nextId))
          .filter((d): d is DogEar => d !== null)
      : [],
    links: Array.isArray(r.links)
      ? r.links
          .map((l) => normalizeLink(l, nextId))
          .filter((l): l is DigitalLink => l !== null)
      : [],
    purposes: Array.isArray(r.purposes) ? r.purposes.filter(isPurposeId) : [],

    isbn: str(r.isbn),
    author: str(r.author),
    publisher: str(r.publisher),
    pubdate: str(r.pubdate),
    coverUrl: str(r.coverUrl),

    bookstore: str(r.bookstore),
    summary: str(r.summary),
    recap: str(r.recap),
    rating: optNum(r.rating),
    startedAt: optNum(r.startedAt),
    finishedAt: optNum(r.finishedAt),
  };
}

/**
 * AsyncStorage の生ペイロードをパースして移行する。決して例外を投げない。
 *
 * 保存形式は素の配列のまま（`{version, books}` に包まない）。移行はデータ自身から
 * 推論でき（kind 欠落＝旧形式）、素の配列なら古いAPKでも読めるため。
 */
export function migrateLibrary(raw: string | null): Book[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeBook).filter((b): b is Book => b !== null);
}
