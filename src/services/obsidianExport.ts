import { purposeLabel } from '../constants/purposes';
import type { Book } from '../types/book';

/** Obsidian側に作るアプリ専用フォルダ。 */
export const OBSIDIAN_FOLDER = 'READING NOTE';

/** 長いURIがOSやブラウザで切られないよう、本文をクリップボードへ切り替える境界。 */
const URI_LENGTH_LIMIT = 15_000;

export interface ObsidianNote {
  name: string;
  content: string;
}

export interface ObsidianExport {
  uri: string;
  viaClipboard: boolean;
  content: string;
}

export interface ObsidianExportOptions {
  /** 同名ノートがある場合に置き換える。UI側で確認を取ってから指定する。 */
  overwrite?: boolean;
  /** テストで日時を固定するために注入可能。 */
  now?: Date;
}

/** Obsidianと端末のファイル名で使えない文字を取り除く。 */
export function sanitizeNoteName(title: string): string {
  return (
    title
      .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'READING NOTE ノート'
  );
}

function inline(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function yamlString(value: string): string {
  // JSONの文字列リテラルはYAMLでも有効で、引用符や改行を安全に保持できる。
  return JSON.stringify(value);
}

function localYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function timestampYmd(timestamp?: number): string | undefined {
  if (timestamp == null || !Number.isFinite(timestamp)) return undefined;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function quoteBlock(value: string): string {
  return value
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');
}

function markdownLinkLabel(value: string): string {
  return inline(value).replace(/([\\\[\]])/g, '\\$1');
}

/** Android版のBookを、Obsidianへ保存する1冊分のMarkdownへ変換する。 */
export function buildObsidianNote(book: Book, now = new Date()): ObsidianNote {
  const created = timestampYmd(book.createdAt) ?? localYmd(now);
  const rating = Math.max(0, Math.min(5, Math.trunc(book.rating ?? 0)));
  const parts: string[] = [
    '---',
    'source: READING NOTE',
    `created: ${created}`,
    `exported: ${now.toISOString()}`,
    `book_id: ${yamlString(book.id)}`,
    `kind: ${book.kind}`,
  ];

  if (book.isbn) parts.push(`isbn: ${yamlString(book.isbn)}`);
  parts.push('tags: [reading, reading-note]', '---', '', `# ${inline(book.title)}`, '');

  const details = [
    `- 種別: ${book.kind === 'paper' ? '紙の本' : '取り込みコンテンツ'}`,
    book.author ? `- 著者: ${inline(book.author)}` : undefined,
    book.publisher ? `- 出版社: ${inline(book.publisher)}` : undefined,
    book.pubdate ? `- 出版日: ${inline(book.pubdate)}` : undefined,
    book.isbn ? `- ISBN: ${book.isbn}` : undefined,
    book.totalPages > 0 ? `- ページ数: ${book.totalPages}` : undefined,
    book.bookstore ? `- 出会った書店: ${inline(book.bookstore)}` : undefined,
    rating > 0 ? `- 評価: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : undefined,
    book.finishedAt ? `- 読了日: ${timestampYmd(book.finishedAt)}` : '- 状態: 読書中',
    book.coverUrl ? `- 表紙: [画像を開く](${book.coverUrl})` : undefined,
  ].filter((line): line is string => Boolean(line));
  parts.push('## 書誌情報', '', ...details, '');

  parts.push('## 読む目的', '');
  if (book.purposes.length > 0) {
    parts.push(...book.purposes.map((purpose) => `- ${purposeLabel(purpose)}`));
  } else {
    parts.push('_未記入_');
  }
  parts.push('');

  parts.push('## ドッグイヤー', '');
  const dogEars = book.dogEars.filter((dogEar) => !dogEar.deletedAt);
  if (dogEars.length === 0) {
    parts.push('_未記入_');
  } else {
    dogEars.forEach((dogEar) => {
      const location = [
        dogEar.page > 0 ? `P. ${dogEar.page}` : 'ページ未指定',
        dogEar.line ? `L. ${dogEar.line}` : null,
      ]
        .filter(Boolean)
        .join(' / ');
      parts.push(`### ${location}`, '', quoteBlock(dogEar.quote), '');
      if (dogEar.comment?.trim()) parts.push(dogEar.comment.trim(), '');
    });
  }
  parts.push('');

  parts.push(
    '## まとめ',
    '',
    book.summary?.trim() || '_未記入_',
    '',
    '## ふりかえり（自分の言葉）',
    '',
    book.recap?.trim() || '_未記入_',
    '',
    '## デジタルリンク',
    '',
  );

  const links = book.links.filter((link) => !link.deletedAt);
  if (links.length === 0) {
    parts.push('_未登録_');
  } else {
    parts.push(...links.map((link) => `- [${markdownLinkLabel(link.label)}](${link.url})`));
  }
  parts.push('');

  return {
    name: sanitizeNoteName(book.title),
    content: parts.join('\n'),
  };
}

/**
 * Obsidian公式URIを組み立てる。短い本文はcontent、長い本文はclipboardで渡す。
 * clipboardへ実際に書く処理とURIを開く処理は、React NativeのUI層で行う。
 */
export function buildObsidianExport(
  book: Book,
  vault?: string,
  options: ObsidianExportOptions = {},
): ObsidianExport {
  const { name, content } = buildObsidianNote(book, options.now);
  const base =
    `obsidian://new?file=${encodeURIComponent(`${OBSIDIAN_FOLDER}/${name}`)}` +
    (vault?.trim() ? `&vault=${encodeURIComponent(vault.trim())}` : '') +
    (options.overwrite ? '&overwrite=true' : '');
  const full = `${base}&content=${encodeURIComponent(content)}`;

  if (full.length <= URI_LENGTH_LIMIT) {
    return { uri: full, viaClipboard: false, content };
  }
  return { uri: `${base}&clipboard=true`, viaClipboard: true, content };
}
