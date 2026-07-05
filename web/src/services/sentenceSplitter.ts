import type { Sentence } from '../types/book';

/**
 * Split a block of Japanese text into sentences.
 * Ported from the Expo app's sentenceSplitter; sentence-final punctuation
 * (。．！？…) ends a sentence, and very long sentences are sub-split at commas.
 */
function splitIntoSentences(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const raw = cleaned.split(/(?<=[。．！？!?…]+)/);
  const result: string[] = [];

  for (const s of raw) {
    const t = s.trim();
    if (!t) continue;
    if (t.length > 120) {
      const sub = t.split(/(?<=[、,，]+)/);
      for (const ss of sub) {
        const st = ss.trim();
        if (st) result.push(st);
      }
    } else {
      result.push(t);
    }
  }
  return result.filter((s) => s.length > 0);
}

const SECTION_RE = /^(第[0-9０-９一二三四五六七八九十]+章|まとめ|はじめに|序章|結論)/;

/** Strip inline Markdown so it isn't read aloud verbatim (**, *, _, `, links). */
function stripInlineMarkdown(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → link text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/~~([^~]+)~~/g, '$1') // strikethrough
    .trim();
}

interface NormalizedLine {
  text: string;
  isHeading: boolean;
}

/**
 * Turn one raw (possibly Markdown) line into clean, speakable text.
 * Returns null for lines that carry no spoken content (blank lines, horizontal
 * rules, code-fence markers). Markdown ATX headings (`#`, `##`, …) and the
 * Japanese section patterns (第N章 / まとめ …) are flagged as headings.
 */
function normalizeLine(raw: string): NormalizedLine | null {
  let line = raw.trim();
  if (!line) return null;
  // Horizontal rules and code-fence markers have no spoken content.
  if (/^([-*_])\1{2,}$/.test(line) || /^```/.test(line) || /^~~~/.test(line)) return null;

  // Markdown ATX heading: "# タイトル" … "###### …"
  const atx = line.match(/^#{1,6}\s+(.*)$/);
  if (atx) {
    const text = stripInlineMarkdown(atx[1]);
    return text ? { text, isHeading: true } : null;
  }

  // Strip leading block markers: blockquotes, list bullets, ordered markers.
  line = line.replace(/^>\s?/, '');
  line = line.replace(/^([-*+]|\d+[.)])\s+/, '');
  line = stripInlineMarkdown(line);
  if (!line) return null;

  const isHeading = SECTION_RE.test(line) && line.length <= 40;
  return { text: line, isHeading };
}

/**
 * Build sentence objects from a summary script (plain text or Markdown).
 * Each heading line ("第1章 …", "まとめ", or a Markdown `#` heading) increments
 * the section counter, which the reader uses for chapter navigation.
 */
export function buildSentences(script: string): Sentence[] {
  const lines = script.split('\n');
  const sentences: Sentence[] = [];
  let section = 1;

  for (const raw of lines) {
    const normalized = normalizeLine(raw);
    if (!normalized) continue;
    const { text: lineText, isHeading } = normalized;
    if (isHeading && sentences.length > 0) section += 1;

    for (const part of splitIntoSentences(lineText)) {
      sentences.push({
        id: `s${sentences.length}`,
        text: part,
        section,
        ...(isHeading ? { isHeading: true } : {}),
      });
    }
  }
  return sentences;
}
