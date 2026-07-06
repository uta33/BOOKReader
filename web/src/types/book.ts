export interface Sentence {
  id: string;
  text: string;
  /** Section index (1-based) the sentence belongs to. */
  section: number;
  /** True when the sentence is a section heading line (第N章 / まとめ …). */
  isHeading?: boolean;
}

export type BookSource = 'ai' | 'script';

export interface QuizItem {
  q: string;
  a: string;
}

export interface Book {
  id: string;
  title: string;
  source: BookSource;
  /** Topic/title the user entered when source === 'ai'. */
  topic?: string;
  sentences: Sentence[];
  lastSentenceIdx: number;
  createdAt: number;
  /** Last time the reader was opened — drives Home's "continue" card. */
  lastOpenedAt?: number;
  /** Content-specific review questions (AI-generated). */
  quiz?: QuizItem[];
  /** Effect #2 — the user's own-words summary + how they'll apply it. */
  recap?: string;
  recapCreatedAt?: number;
}

/** Effect #3 — a spaced-repetition review item. */
export interface ReviewItem {
  id: string;
  bookId: string;
  /** 'recap' = the user's own summary; 'quiz' = content-specific question. */
  kind?: 'recap' | 'quiz';
  /** Cue shown to trigger active recall (question / prompt). */
  prompt: string;
  /** Hidden until the user tries to recall it. */
  answer: string;
  /** Leitner box index into REVIEW_INTERVALS_MS. */
  stage: number;
  /** Next due time (epoch ms). */
  dueAt: number;
  lastReviewedAt?: number;
  createdAt: number;
}

export type RecallGrade = 'forgot' | 'unsure' | 'recalled';
