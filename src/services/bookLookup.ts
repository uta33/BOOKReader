/**
 * ISBN-13 から書誌情報を引く。
 *
 * openBD（版元ドットコム＋カーリル）を第1候補、国立国会図書館サーチを第2候補にする。
 * どちらも API キー不要の公開APIなので、アプリから直接叩ける
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

const OPENBD_ENDPOINT = 'https://api.openbd.jp/v1/get';
const NDL_ENDPOINT = 'https://ndlsearch.ndl.go.jp/api/opensearch';

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

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal });
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
