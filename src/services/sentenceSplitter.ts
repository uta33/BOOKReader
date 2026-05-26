import { Sentence } from '../types/book';

function splitIntoSentences(text: string): string[] {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const raw = cleaned.split(/(?<=[。．！？!?…]+)/);
  const result: string[] = [];

  for (const s of raw) {
    const t = s.trim();
    if (!t) continue;
    if (t.length > 200) {
      // split long sentences at commas
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

export function buildSentences(pageTexts: { page: number; text: string }[]): Sentence[] {
  const sentences: Sentence[] = [];
  for (const { page, text } of pageTexts) {
    const parts = splitIntoSentences(text);
    for (const part of parts) {
      sentences.push({
        id: `p${page}_${sentences.length}`,
        text: part,
        pageNumber: page,
      });
    }
  }
  return sentences;
}
