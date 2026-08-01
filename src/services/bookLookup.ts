/**
 * ISBN-13 から書誌情報を引く。
 *
 * openBD（版元ドットコム＋カーリル）を第1候補、国立国会図書館サーチを第2候補にする。
 * 書誌側に表紙が無い場合は Open Library Covers API で補完する。
 * いずれも API キー不要の公開APIなので、アプリから直接叩ける
 * ——つまり書誌照会は自前サーバのデプロイに依存しない。
 *
 * ネットワーク呼び出しとレスポンス整形を分けてあるのは、整形部分を
 * 保存済みサンプルでユニットテストできるようにするため（開発環境からは
 * どちらのAPIもネットワークポリシーで叩けない）。
 */

export interface LookupResult {
  title: string;
  author?: string;
  publisher?: string;
  pubdate?: string;
  coverUrl?: string;
  /** どこから引けたか。UI の出典表示に使う。 */
  source: 'openbd' | 'ndl';
}

export type CoverSource = 'openbd' | 'openlibrary-isbn' | 'openlibrary-search';

/** 表紙選択UIへ渡す候補。画像そのものは選択後に端末へ保存する。 */
export interface CoverCandidate {
  url: string;
  source: CoverSource;
  title?: string;
  author?: string;
  /** 読み取ったISBNと検索結果のISBNが一致した候補。 */
  exactIsbn: boolean;
}

export interface CoverSearchInput {
  isbn?: string;
  title?: string;
  author?: string;
  /** undefined は未照会、null は照会済みで書影なし。 */
  knownOpenBdCoverUrl?: string | null;
}

const OPENBD_ENDPOINT = 'https://api.openbd.jp/v1/get';
const NDL_ENDPOINT = 'https://ndlsearch.ndl.go.jp/api/opensearch';
const OPEN_LIBRARY_COVERS_ENDPOINT = 'https://covers.openlibrary.org/b/isbn';
const OPEN_LIBRARY_SEARCH_ENDPOINT = 'https://openlibrary.org/search.json';

function clean(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** openBD の生レスポンスから必要な項目を取り出す。純関数。 */
export function shapeOpenBd(payload: unknown): LookupResult | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry || typeof entry !== 'object') return null;

  const summary = (entry as Record<string, unknown>).summary;
  if (!summary || typeof summary !== 'object') return null;
  const s = summary as Record<string, unknown>;

  const title = clean(s.title);
  if (!title) return null;

  return {
    title,
    author: clean(s.author),
    publisher: clean(s.publisher),
    pubdate: clean(s.pubdate),
    coverUrl: clean(s.cover),
    source: 'openbd',
  };
}

/**
 * NDLサーチの OpenSearch(RSS) から必要な項目を取り出す。純関数。
 *
 * React Native には DOMParser が無いので、正規表現で最初の <item> を拾う。
 * 書誌1件を引くだけなので、これで足りる。
 */
export function shapeNdl(xml: string): LookupResult | null {
  if (typeof xml !== 'string' || xml.length === 0) return null;

  const itemMatch = /<item\b[\s\S]*?<\/item>/i.exec(xml);
  if (!itemMatch) return null;
  const item = itemMatch[0];

  const pick = (tag: string): string | undefined => {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const m = re.exec(item);
    if (!m) return undefined;
    const text = m[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .trim();
    return text.length > 0 ? text : undefined;
  };

  const title = pick('dc:title') ?? pick('title');
  if (!title) return null;

  return {
    title,
    author: pick('dc:creator'),
    publisher: pick('dc:publisher'),
    pubdate: pick('dcterms:issued') ?? pick('dc:date'),
    source: 'ndl',
  };
}

async function fetchJson(
  url: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<unknown | null> {
  try {
    const res = await fetcher(url, { signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Open LibraryのISBN書影URL。表示時の自動フォールバックにも使う。 */
export function openLibraryCoverUrl(isbn13: string): string {
  return `${OPEN_LIBRARY_COVERS_ENDPOINT}/${encodeURIComponent(isbn13)}-M.jpg?default=false`;
}

/** Open Libraryのcover IDから、選択画面向けの大きめの書影URLを作る。 */
export function openLibraryCoverIdUrl(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${Math.trunc(coverId)}-L.jpg?default=false`;
}

function isbnKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/[^0-9X]/gi, '').toUpperCase();
  return normalized.length >= 10 ? normalized : undefined;
}

/** Open Library Search APIのレスポンスから、書影のある候補だけを取り出す。 */
export function shapeOpenLibraryCovers(
  payload: unknown,
  targetIsbn?: string,
): CoverCandidate[] {
  if (!payload || typeof payload !== 'object') return [];
  const docs = (payload as Record<string, unknown>).docs;
  if (!Array.isArray(docs)) return [];
  const target = isbnKey(targetIsbn);

  return docs.flatMap((raw): CoverCandidate[] => {
    if (!raw || typeof raw !== 'object') return [];
    const doc = raw as Record<string, unknown>;
    const coverId = typeof doc.cover_i === 'number' && Number.isFinite(doc.cover_i)
      ? Math.trunc(doc.cover_i)
      : 0;
    if (coverId <= 0) return [];
    const isbns = Array.isArray(doc.isbn)
      ? doc.isbn.map(isbnKey).filter((value): value is string => Boolean(value))
      : [];
    const author = Array.isArray(doc.author_name)
      ? doc.author_name.map(clean).filter((value): value is string => Boolean(value)).join('、')
      : undefined;
    return [{
      url: openLibraryCoverIdUrl(coverId),
      source: 'openlibrary-search',
      title: clean(doc.title),
      author: author || undefined,
      exactIsbn: Boolean(target && isbns.includes(target)),
    }];
  });
}

/** Open Library Search APIのURL。ISBNがある場合は完全一致照会を優先する。 */
export function openLibrarySearchUrl(input: CoverSearchInput): string | undefined {
  const isbn = isbnKey(input.isbn);
  const title = clean(input.title);
  const author = clean(input.author);
  if (!isbn && !title) return undefined;

  const query = isbn ? `isbn:${isbn}` : [title, author].filter(Boolean).join(' ');
  return `${OPEN_LIBRARY_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`
    + '&fields=key,title,author_name,cover_i,isbn&limit=8';
}

/**
 * Open Libraryに実画像があるときだけURLを返す。
 * default=false により未収録時は空画像ではなく404になる。
 */
export async function lookupOpenLibraryCover(
  isbn13: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string | undefined> {
  const url = openLibraryCoverUrl(isbn13);
  try {
    const response = await fetcher(url, { method: 'HEAD', signal });
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    return response.ok && contentType.startsWith('image/') ? url : undefined;
  } catch {
    return undefined;
  }
}

function dedupeCoverCandidates(candidates: CoverCandidate[]): CoverCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

/**
 * ISBN（openBD / Open Library）を優先し、必要なら書名・著者でも候補を探す。
 * 候補の確定はUIで行い、誤った版の表紙を自動保存しない。
 */
export async function searchBookCovers(
  input: CoverSearchInput,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<CoverCandidate[]> {
  const candidates: CoverCandidate[] = [];
  const isbn = isbnKey(input.isbn);

  let openBdCover = input.knownOpenBdCoverUrl;
  if (isbn && openBdCover === undefined) {
    const payload = await fetchJson(
      `${OPENBD_ENDPOINT}?isbn=${encodeURIComponent(isbn)}`,
      signal,
      fetcher,
    );
    openBdCover = shapeOpenBd(payload)?.coverUrl ?? null;
  }
  if (openBdCover) {
    candidates.push({
      url: openBdCover,
      source: 'openbd',
      title: clean(input.title),
      author: clean(input.author),
      exactIsbn: Boolean(isbn),
    });
  }

  const lookups: Promise<CoverCandidate[]>[] = [];
  if (isbn) {
    lookups.push(
      lookupOpenLibraryCover(isbn, signal, fetcher).then((direct) => direct ? [{
        url: direct.replace('-M.jpg', '-L.jpg'),
        source: 'openlibrary-isbn' as const,
        title: clean(input.title),
        author: clean(input.author),
        exactIsbn: true,
      }] : []),
    );
  }

  const searchUrl = openLibrarySearchUrl(input);
  if (searchUrl) {
    lookups.push(
      fetchJson(searchUrl, signal, fetcher)
        .then((payload) => shapeOpenLibraryCovers(payload, isbn)),
    );
  }
  if (isbn && clean(input.title)) {
    const titleSearchUrl = openLibrarySearchUrl({ title: input.title, author: input.author });
    if (titleSearchUrl) {
      lookups.push(
        fetchJson(titleSearchUrl, signal, fetcher)
          .then((payload) => shapeOpenLibraryCovers(payload, isbn)),
      );
    }
  }
  candidates.push(...(await Promise.all(lookups)).flat());

  return dedupeCoverCandidates(candidates)
    .sort((left, right) => Number(right.exactIsbn) - Number(left.exactIsbn))
    .slice(0, 8);
}

/**
 * 書誌を引く。見つからなければ null（手入力へ倒す）。
 * ネットワーク障害でも例外は投げず null を返す。
 */
export async function lookupIsbn(
  isbn13: string,
  signal?: AbortSignal,
): Promise<LookupResult | null> {
  const openbd = await fetchJson(
    `${OPENBD_ENDPOINT}?isbn=${encodeURIComponent(isbn13)}`,
    signal,
  );
  const fromOpenBd = shapeOpenBd(openbd);
  if (fromOpenBd) return fromOpenBd;

  // openBD 未収録（古い本に多い）は NDL で拾う。
  const xml = await fetchText(
    `${NDL_ENDPOINT}?isbn=${encodeURIComponent(isbn13)}&cnt=1`,
    signal,
  );
  return xml ? shapeNdl(xml) : null;
}
