import { authenticatedFetch } from './authClient';
import { isSupportedBookCoverUrl } from './bookCoverPolicy';
import {
  searchBookCovers,
  type CoverCandidate,
  type CoverSearchInput,
  type CoverSource,
} from './bookLookup';

const SERVER_SOURCES = new Set<CoverSource>([
  'google-books-isbn',
  'google-books-search',
]);

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function validServerCandidate(value: unknown): CoverCandidate | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const url = clean(raw.url);
  const source = clean(raw.source) as CoverSource | undefined;
  if (!url || !isSupportedBookCoverUrl(url) || !source || !SERVER_SOURCES.has(source)) {
    return undefined;
  }
  return {
    url,
    source,
    title: clean(raw.title),
    author: clean(raw.author),
    exactIsbn: raw.exactIsbn === true,
  };
}

async function searchWorkerCovers(
  input: CoverSearchInput,
  signal?: AbortSignal,
): Promise<CoverCandidate[]> {
  const params = new URLSearchParams();
  const isbn = clean(input.isbn)?.slice(0, 32);
  const title = clean(input.title)?.slice(0, 200);
  const author = clean(input.author)?.slice(0, 200);
  if (isbn) params.set('isbn', isbn);
  if (title) params.set('title', title);
  if (author) params.set('author', author);
  if (!isbn && !title) return [];

  try {
    const response = await authenticatedFetch(`/v1/books/covers?${params.toString()}`, {
      signal,
    });
    if (!response.ok) return [];
    const payload = await response.json() as { candidates?: unknown };
    if (!Array.isArray(payload.candidates)) return [];
    return payload.candidates
      .map(validServerCandidate)
      .filter((candidate): candidate is CoverCandidate => Boolean(candidate));
  } catch {
    // Workerが一時停止中でも、公開APIの候補はそのまま使える。
    return [];
  }
}

function sourceRank(source: CoverSource): number {
  if (source === 'openbd') return 0;
  if (source === 'google-books-isbn') return 1;
  if (source === 'openlibrary-isbn') return 2;
  if (source === 'google-books-search') return 3;
  return 4;
}

/** 国内書誌、Google Books、Open Libraryを並列照会して安全な候補へ統合する。 */
export async function searchAvailableBookCovers(
  input: CoverSearchInput,
  signal?: AbortSignal,
): Promise<CoverCandidate[]> {
  const [local, server] = await Promise.all([
    searchBookCovers(input, signal),
    searchWorkerCovers(input, signal),
  ]);
  const seen = new Set<string>();
  return [...local, ...server]
    .filter((candidate) => {
      if (seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    })
    .sort((left, right) => {
      const exact = Number(right.exactIsbn) - Number(left.exactIsbn);
      return exact || sourceRank(left.source) - sourceRank(right.source);
    })
    .slice(0, 16);
}
