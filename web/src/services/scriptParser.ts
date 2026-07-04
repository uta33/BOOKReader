import type { QuizItem } from '../types/book';

export interface ParsedScript {
  title: string;
  /** Body text with the title line and quiz section removed. */
  body: string;
  quiz: QuizItem[];
}

const QUIZ_MARKER_RE = /^復習クイズ[:：]?\s*$/;

/** Parse "Q: …" / "A: …" line pairs into quiz items. */
export function parseQuizLines(text: string): QuizItem[] {
  const items: QuizItem[] = [];
  let pendingQ: string | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const qm = line.match(/^Q\d*[:：]\s*(.+)$/);
    const am = line.match(/^A\d*[:：]\s*(.+)$/);
    if (qm) {
      pendingQ = qm[1].trim();
    } else if (am && pendingQ) {
      items.push({ q: pendingQ, a: am[1].trim() });
      pendingQ = null;
    }
  }
  return items;
}

/**
 * Split a generated script into title, readable body, and review quiz.
 * Format produced by the server: "タイトル: …" first line, body, then a
 * "復習クイズ:" marker followed by Q:/A: pairs. All parts are optional —
 * imported scripts without the markers parse as body-only.
 */
export function parseGeneratedScript(raw: string, fallbackTitle: string): ParsedScript {
  const lines = raw.replace(/\r\n/g, '\n').trim().split('\n');

  let title = fallbackTitle;
  let start = 0;
  const first = lines[0]?.trim() ?? '';
  const tm = first.match(/^タイトル[:：]\s*(.+)$/);
  if (tm) {
    title = tm[1].trim();
    start = 1;
  }

  let quizStart = -1;
  for (let i = start; i < lines.length; i++) {
    if (QUIZ_MARKER_RE.test(lines[i].trim())) {
      quizStart = i;
      break;
    }
  }

  const bodyLines = quizStart === -1 ? lines.slice(start) : lines.slice(start, quizStart);
  const quiz = quizStart === -1 ? [] : parseQuizLines(lines.slice(quizStart + 1).join('\n'));

  return { title, body: bodyLines.join('\n').trim(), quiz };
}
