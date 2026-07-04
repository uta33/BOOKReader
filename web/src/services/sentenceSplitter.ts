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

/**
 * Build sentence objects from a summary script. Each line that starts a new
 * section ("第1章 …", "まとめ", …) increments the section counter, which the
 * reader uses to show progress and to scope recaps.
 */
export function buildSentences(script: string): Sentence[] {
  const lines = script.split('\n');
  const sentences: Sentence[] = [];
  let section = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isHeadingLine = SECTION_RE.test(trimmed) && trimmed.length <= 40;
    if (isHeadingLine && sentences.length > 0) section += 1;

    for (const part of splitIntoSentences(trimmed)) {
      sentences.push({
        id: `s${sentences.length}`,
        text: part,
        section,
        ...(isHeadingLine ? { isHeading: true } : {}),
      });
    }
  }
  return sentences;
}
