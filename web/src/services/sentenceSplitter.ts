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

/** Production labels whose whole line carries no spoken content. */
const PRODUCTION_LABEL_RE = /^(BGM|SE|効果音|音楽|テロップ|字幕|注記?|備考)\s*[:：]/i;

/** Speaker labels from transcripts — the words after them ARE spoken content. */
const SPEAKER_LABEL_RE =
  /^(ナレーション|ナレーター|話者\s*\d*|スピーカー\s*\d*|司会|男性|女性|Speaker\s*\d*)\s*[:：]\s*/i;

/** Inline stage directions that TTS would read out loud verbatim. */
const INLINE_DIRECTION_RE = /[（(](間|笑い?|拍手|ため息|沈黙|ポーズ)[）)]/g;

/** Timestamp tokens typical of transcripts: [00:15], 1:23:45, (12:34). */
const TIMESTAMP_ONLY_RE = /^[[（(]?\d{1,2}:\d{2}(:\d{2})?[\]）)]?$/;
const LEADING_TIMESTAMP_RE = /^[[（(]?\d{1,2}:\d{2}(:\d{2})?[\]）)]?\s+/;

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

  // Transcript/production directives are not narration: timestamps,
  // ※-annotations, bracket-only stage directions, and BGM/効果音 labels.
  if (TIMESTAMP_ONLY_RE.test(line)) return null;
  if (/^※/.test(line)) return null;
  if (/^[（(][^（）()]*[）)]$/.test(line)) return null;
  if (PRODUCTION_LABEL_RE.test(line)) return null;

  // 【…】-only lines: production notes are dropped, otherwise it's a heading.
  const boxed = line.match(/^【([^】]+)】$/);
  if (boxed) {
    if (PRODUCTION_LABEL_RE.test(boxed[1]) || /^(BGM|SE|効果音|音楽|テロップ|字幕)$/i.test(boxed[1]))
      return null;
    const text = stripInlineMarkdown(boxed[1]);
    return text ? { text, isHeading: true } : null;
  }

  // Markdown ATX heading: "# タイトル" … "###### …"
  const atx = line.match(/^#{1,6}\s+(.*)$/);
  if (atx) {
    const text = stripInlineMarkdown(atx[1]);
    return text ? { text, isHeading: true } : null;
  }

  // Strip leading block markers: blockquotes, list bullets, ordered markers.
  line = line.replace(/^>\s?/, '');
  line = line.replace(/^([-*+]|\d+[.)])\s+/, '');
  // Leading timestamps and speaker labels: keep the words, drop the marker
  // (timestamp first — transcripts write "[01:23] 話者1: …").
  line = line.replace(LEADING_TIMESTAMP_RE, '');
  line = line.replace(SPEAKER_LABEL_RE, '');
  line = stripInlineMarkdown(line);
  line = line.replace(INLINE_DIRECTION_RE, '').trim();
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
