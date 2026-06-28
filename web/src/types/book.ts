export interface Sentence {
  id: string;
  text: string;
  /** Section index (1-based) the sentence belongs to. */
  section: number;
}

export type BookSource = 'ai' | 'script';

export interface Book {
  id: string;
  title: string;
  source: BookSource;
  /** Topic/title the user entered when source === 'ai'. */
  topic?: string;
  sentences: Sentence[];
  lastSentenceIdx: number;
  createdAt: number;
  /** Effect #2 — the user's own-words summary + how they'll apply it. */
  recap?: string;
  recapCreatedAt?: number;
}

/** Effect #3 — a spaced-repetition review item generated from a recap. */
export interface ReviewItem {
  id: string;
  bookId: string;
  /** Cue shown to trigger active recall (book title / question). */
  prompt: string;
  /** The user's recap, hidden until they try to recall it. */
  answer: string;
  /** Leitner box index into REVIEW_INTERVALS_MS. */
  stage: number;
  /** Next due time (epoch ms). */
  dueAt: number;
  lastReviewedAt?: number;
  createdAt: number;
}

export type RecallGrade = 'forgot' | 'unsure' | 'recalled';
