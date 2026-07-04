import type { RecallGrade, ReviewItem } from '../types/book';

const DAY = 24 * 60 * 60 * 1000;

/** Leitner intervals: 1 day, 3 days, 1 week, 2 weeks, 1 month. */
export const REVIEW_INTERVALS_MS = [1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

export function createReviewItem(
  bookId: string,
  prompt: string,
  answer: string,
  now = Date.now(),
): ReviewItem {
  return {
    id: `r${now}-${Math.random().toString(36).slice(2, 8)}`,
    bookId,
    prompt,
    answer,
    stage: 0,
    dueAt: now + REVIEW_INTERVALS_MS[0],
    createdAt: now,
  };
}

/**
 * Apply a self-graded recall result and return the rescheduled item.
 * - recalled: advance one box (longer interval)
 * - unsure: stay in the same box
 * - forgot: drop back to box 0 (review again tomorrow)
 */
export function applyGrade(item: ReviewItem, grade: RecallGrade, now = Date.now()): ReviewItem {
  let stage = item.stage;
  if (grade === 'recalled') stage = Math.min(stage + 1, REVIEW_INTERVALS_MS.length - 1);
  else if (grade === 'forgot') stage = 0;

  return {
    ...item,
    stage,
    lastReviewedAt: now,
    dueAt: now + REVIEW_INTERVALS_MS[stage],
  };
}

export function isDue(item: ReviewItem, now = Date.now()): boolean {
  return item.dueAt <= now;
}
