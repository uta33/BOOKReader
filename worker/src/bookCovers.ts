import type { Env } from './types';

const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
const GOOGLE_DYNAMIC_LINKS_ENDPOINT = 'https://books.google.com/books';
const GOOGLE_IMAGE_HOSTS = new Set([
  'books.google.com',
  'books.googleusercontent.com',
]);
const MAX_RESULTS_PER_QUERY = 12;

export type GoogleCoverSource = 'google-books-isbn' | 'google-books-search';

export interface GoogleCoverCandidate {
  url: string;
  source: GoogleCoverSource;
  title?: string;
  author?: string;
  exactIsbn: boolean;
}

export interface GoogleCoverSearchInput {
  isbn?: string;
  title?: string;
  author?: string;
}

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeIsbn(value: unknown): string | undefined {
  const normalized = clean(value)?.replace(/[^0-9X]/gi, '').toUpperCase();
  return normalized && (normalized.length === 10 || normalized.length === 13)
    ? normalized
    : undefined;
}

/** Google Booksが返すhttp URLをhttpsへ固定し、画像配信ホスト以外を拒否する。 */
export function normalizeGoogleCoverUrl(value: unknown): string | undefined {
  const raw = clean(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || !GOOGLE_IMAGE_HOSTS.has(url.hostname.toLowerCase())) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(clean).filter((item): item is string => Boolean(item));
}

/** Google Books Volume APIの生レスポンスから、書影がある安全な候補だけを抜き出す。 */
export function shapeGoogleBookCovers(
  payload: unknown,
  targetIsbn: string | undefined,
  source: GoogleCoverSource,
): GoogleCoverCandidate[] {
  if (!payload || typeof payload !== 'object') return [];
  const items = (payload as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  const target = normalizeIsbn(targetIsbn);

  return items.flatMap((raw): GoogleCoverCandidate[] => {
    if (!raw || typeof raw !== 'object') return [];
    const volumeInfo = (raw as Record<string, unknown>).volumeInfo;
    if (!volumeInfo || typeof volumeInfo !== 'object') return [];
    const info = volumeInfo as Record<string, unknown>;
    const imageLinks = info.imageLinks;
    if (!imageLinks || typeof imageLinks !== 'object') return [];
    const links = imageLinks as Record<string, unknown>;
    const coverUrl = [
      links.extraLarge,
      links.large,
      links.medium,
      links.small,
      links.thumbnail,
      links.smallThumbnail,
    ].map(normalizeGoogleCoverUrl).find(Boolean);
    if (!coverUrl) return [];

    const identifiers = Array.isArray(info.industryIdentifiers)
      ? info.industryIdentifiers.flatMap((identifier): string[] => {
        if (!identifier || typeof identifier !== 'object') return [];
        const normalized = normalizeIsbn(
          (identifier as Record<string, unknown>).identifier,
        );
        return normalized ? [normalized] : [];
      })
      : [];

    const authors = stringArray(info.authors);
    return [{
      url: coverUrl,
      source,
      title: clean(info.title),
      author: authors.length > 0 ? authors.join('、') : undefined,
      exactIsbn: Boolean(target && identifiers.includes(target)),
    }];
  });
}

function googleBooksUrl(query: string, apiKey: string): string {
  const params = new URLSearchParams({
    q: query,
    key: apiKey,
    maxResults: String(MAX_RESULTS_PER_QUERY),
    printType: 'books',
    projection: 'lite',
  });
  return `${GOOGLE_BOOKS_ENDPOINT}?${params.toString()}`;
}

function titleQuery(title: string, author?: string): string {
  return [`intitle:${title}`, author ? `inauthor:${author}` : undefined]
    .filter(Boolean)
    .join(' ');
}

function broadTitleQuery(title: string, author?: string): string {
  return [title, author].filter(Boolean).join(' ');
}

function googleDynamicLinksUrl(isbn: string): string {
  const params = new URLSearchParams({
    jscmd: 'viewapi',
    bibkeys: `ISBN:${isbn}`,
  });
  return `${GOOGLE_DYNAMIC_LINKS_ENDPOINT}?${params.toString()}`;
}

/** Dynamic LinksのJavaScriptラッパーから、ISBN完全一致の書影だけを安全に取り出す。 */
export function shapeGoogleDynamicCover(
  body: unknown,
  isbn: string,
  title?: string,
  author?: string,
): GoogleCoverCandidate[] {
  if (typeof body !== 'string') return [];
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  try {
    const payload = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
    const raw = payload[`ISBN:${isbn}`] ?? Object.values(payload)[0];
    if (!raw || typeof raw !== 'object') return [];
    const record = raw as Record<string, unknown>;
    const bibKey = clean(record.bib_key)?.replace(/[^0-9X]/gi, '').toUpperCase();
    if (bibKey !== isbn) return [];
    const url = normalizeGoogleCoverUrl(record.thumbnail_url);
    if (!url) return [];
    return [{
      url,
      source: 'google-books-isbn',
      title: clean(title),
      author: clean(author),
      exactIsbn: true,
    }];
  } catch {
    return [];
  }
}

async function fetchGoogleDynamicCover(
  isbn: string,
  title?: string,
  author?: string,
  signal?: AbortSignal,
): Promise<GoogleCoverCandidate[]> {
  try {
    const response = await fetch(googleDynamicLinksUrl(isbn), {
      signal,
      headers: { Accept: 'application/javascript,text/javascript,*/*;q=0.1' },
    });
    if (!response.ok) {
      console.error('google_books_dynamic_failed', response.status);
      return [];
    }
    return shapeGoogleDynamicCover(await response.text(), isbn, title, author);
  } catch (error) {
    if (!signal?.aborted) console.error('google_books_dynamic_failed', error);
    return [];
  }
}

function comparable(value: string | undefined): string {
  return value?.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\s]/gu, '') ?? '';
}

function titleMatches(candidate: GoogleCoverCandidate, title: string): boolean {
  const target = comparable(title);
  const actual = comparable(candidate.title);
  if (!target || !actual) return false;
  return actual.includes(target) || (actual.length >= 4 && target.includes(actual));
}

async function fetchGoogleBooks(
  url: string,
  signal?: AbortSignal,
): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      console.error('google_books_failed', response.status);
      return null;
    }
    return await response.json() as unknown;
  } catch (error) {
    if (!signal?.aborted) console.error('google_books_failed', error);
    return null;
  }
}

function dedupe(candidates: GoogleCoverCandidate[]): GoogleCoverCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

/**
 * Google Booksの公開書誌をWorkerから検索する。
 * ISBN完全一致のDynamic Linksを先に使い、不在時だけ専用Books APIキーで検索する。
 * キーはWorker secretのままで、候補URLには含めない。
 */
export async function searchGoogleBookCovers(
  env: Env,
  input: GoogleCoverSearchInput,
  signal?: AbortSignal,
): Promise<GoogleCoverCandidate[]> {
  const isbn = normalizeIsbn(input.isbn);
  const title = clean(input.title);
  const author = clean(input.author);

  if (isbn) {
    const exactDynamic = await fetchGoogleDynamicCover(isbn, title, author, signal);
    if (exactDynamic.length > 0) return exactDynamic;
  }

  const apiKey = env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) return [];

  const requests: Array<Promise<GoogleCoverCandidate[]>> = [];

  if (isbn) {
    requests.push(
      fetchGoogleBooks(googleBooksUrl(`isbn:${isbn}`, apiKey), signal)
        .then((payload) => shapeGoogleBookCovers(payload, isbn, 'google-books-isbn')),
    );
  }
  if (title) {
    requests.push(
      fetchGoogleBooks(googleBooksUrl(titleQuery(title, author), apiKey), signal)
        .then((payload) => shapeGoogleBookCovers(payload, isbn, 'google-books-search')),
    );
  }

  const primary = dedupe((await Promise.all(requests)).flat())
    .sort((left, right) => Number(right.exactIsbn) - Number(left.exactIsbn))
    .slice(0, MAX_RESULTS_PER_QUERY);
  if (primary.length > 0 || !title) return primary;

  const broad = await fetchGoogleBooks(
    googleBooksUrl(broadTitleQuery(title, author), apiKey),
    signal,
  );
  return dedupe(shapeGoogleBookCovers(broad, isbn, 'google-books-search'))
    .filter((candidate) => candidate.exactIsbn || titleMatches(candidate, title))
    .slice(0, MAX_RESULTS_PER_QUERY);
}
