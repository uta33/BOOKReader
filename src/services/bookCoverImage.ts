import { Directory, File, Paths } from 'expo-file-system';
import {
  bookCoverExtension,
  exceedsBookCoverLimit,
  isSupportedBookCoverUrl,
} from './bookCoverPolicy';

const BOOK_COVER_FOLDER = 'book-covers';

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'book';
}

function coverDirectory(): Directory {
  const directory = new Directory(Paths.document, BOOK_COVER_FOLDER);
  if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function removeOtherBookCovers(bookId: string, keepUri?: string): void {
  const prefix = `${safeId(bookId)}-`;
  for (const entry of coverDirectory().list()) {
    if (!(entry instanceof File) || !entry.name.startsWith(prefix) || entry.uri === keepUri) continue;
    entry.delete();
  }
}

/**
 * 外部URLの書影を検証し、OSのキャッシュ削除対象ではないdocument領域へ保存する。
 * 同期には公開URLだけを載せ、端末ごとにこのコピーを作り直す。
 */
export async function persistBookCoverFromUrl(
  url: string,
  bookId: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!isSupportedBookCoverUrl(url)) {
    throw new Error('対応していない表紙画像URLです。');
  }

  const ownController = signal ? undefined : new AbortController();
  const effectiveSignal = signal ?? ownController?.signal;
  const timeout = ownController
    ? setTimeout(() => ownController.abort(), 20_000)
    : undefined;
  try {
    const response = await fetcher(url, { signal: effectiveSignal });
    if (!response.ok) throw new Error(`表紙画像を取得できませんでした (${response.status})`);

    const extension = bookCoverExtension(response.headers.get('content-type'));
    if (!extension) throw new Error('取得したデータが対応画像形式ではありません。');

    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (exceedsBookCoverLimit(declaredSize)) {
      throw new Error('表紙画像が大きすぎます（上限5MB）。');
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error('表紙画像が空でした。');
    if (exceedsBookCoverLimit(bytes.byteLength)) throw new Error('表紙画像が大きすぎます（上限5MB）。');

    const target = new File(
      coverDirectory(),
      `${safeId(bookId)}-${Date.now()}.${extension}`,
    );
    target.create({ overwrite: true, intermediates: true });
    target.write(bytes);
    removeOtherBookCovers(bookId, target.uri);
    return target.uri;
  } catch (cause) {
    if (ownController?.signal.aborted) {
      throw new Error('表紙画像の取得がタイムアウトしました。');
    }
    throw cause;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** アプリ自身が保存した書影だけを削除し、外部ファイルには触れない。 */
export function removeManagedBookCover(uri?: string): void {
  if (!uri) return;
  const directory = coverDirectory();
  const prefix = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  if (!uri.startsWith(prefix)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
