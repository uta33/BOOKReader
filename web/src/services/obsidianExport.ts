import type { Book } from '../types/book';

/**
 * Obsidian integration via the obsidian:// URI scheme — zero setup: tapping
 * the button opens the Obsidian app and creates the note in the vault.
 * Notes land in this folder (created automatically by Obsidian).
 */
const FOLDER = 'BOOKReader';

/**
 * Above this URI length the note content travels via the clipboard instead
 * (`obsidian://new?...&clipboard=true` inserts the clipboard as the note
 * body), since very long URIs get truncated on some platforms.
 */
const URI_LENGTH_LIMIT = 15000;

/** Strip characters Obsidian/filesystems reject in note names. */
export function sanitizeNoteName(title: string): string {
  return (
    title
      .replace(/[\\/:*?"<>|#^[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'BOOKReaderノート'
  );
}

/** Reassemble the readable summary: headings + one paragraph per section. */
function summaryMarkdown(book: Book): string {
  const out: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) out.push(paragraph.join(''));
    paragraph = [];
  };
  for (const s of book.sentences) {
    if (s.isHeading) {
      flush();
      out.push(`## ${s.text.replace(/。$/, '')}`);
    } else {
      paragraph.push(s.text);
    }
  }
  flush();
  return out.join('\n\n');
}

export function buildObsidianNote(book: Book): { name: string; content: string } {
  const date = new Date();
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

  const parts: string[] = [
    '---',
    'source: BOOKReader',
    `created: ${ymd}`,
    'tags: [reading, book-summary]',
    '---',
    '',
    '## ふりかえり（自分の言葉）',
    '',
    book.recap?.trim() || '_未記入（アプリの「ふりかえり」を書くとここに入ります）_',
  ];

  if (book.quiz && book.quiz.length > 0) {
    parts.push('', '## 復習クイズ', '');
    book.quiz.forEach((qa, i) => {
      parts.push(`**Q${i + 1}. ${qa.q}**`, '', `A. ${qa.a}`, '');
    });
  }

  parts.push('## 要約', '', summaryMarkdown(book), '');
  return { name: sanitizeNoteName(book.title), content: parts.join('\n') };
}

export interface ObsidianExport {
  uri: string;
  /** True when the note body must be placed on the clipboard first. */
  viaClipboard: boolean;
  content: string;
}

export function buildObsidianExport(book: Book, vault?: string): ObsidianExport {
  const { name, content } = buildObsidianNote(book);
  const base =
    `obsidian://new?file=${encodeURIComponent(`${FOLDER}/${name}`)}` +
    (vault?.trim() ? `&vault=${encodeURIComponent(vault.trim())}` : '');
  const full = `${base}&content=${encodeURIComponent(content)}`;
  if (full.length <= URI_LENGTH_LIMIT) return { uri: full, viaClipboard: false, content };
  return { uri: `${base}&clipboard=true`, viaClipboard: true, content };
}

/** Navigate to a custom-scheme URI (opens the Obsidian app). */
export function openUri(uri: string): void {
  const w = window.open(uri, '_self');
  if (!w) window.location.href = uri;
}
