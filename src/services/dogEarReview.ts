import type { Book, DogEar } from '../types/book';

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;

export type ReviewGrade = 'again' | 'remembered';

export interface DogEarReviewItem {
  bookId: string;
  bookTitle: string;
  dogEar: DogEar;
}

export function dueDogEars(
  books: Book[],
  now = Date.now(),
  limit = 5,
): DogEarReviewItem[] {
  const endOfToday = startOfLocalDay(now) + DAY_MS;
  const items = books.flatMap((book) =>
    book.dogEars
      .filter((dogEar) => !dogEar.deletedAt && (dogEar.nextReviewAt ?? 0) < endOfToday)
      .map((dogEar) => ({ bookId: book.id, bookTitle: book.title, dogEar })),
  );
  return items
    .sort((left, right) => {
      const leftDue = left.dogEar.nextReviewAt ?? 0;
      const rightDue = right.dogEar.nextReviewAt ?? 0;
      if (leftDue !== rightDue) return leftDue - rightDue;
      return left.dogEar.createdAt - right.dogEar.createdAt;
    })
    .slice(0, Math.max(0, Math.trunc(limit)));
}

export function reviewPatch(
  dogEar: DogEar,
  grade: ReviewGrade,
  now = Date.now(),
): Pick<DogEar, 'reviewLevel' | 'lastReviewedAt' | 'nextReviewAt'> {
  const current = clampLevel(dogEar.reviewLevel);
  if (grade === 'again') {
    return {
      reviewLevel: Math.max(0, current - 1),
      lastReviewedAt: now,
      nextReviewAt: startOfLocalDay(now) + DAY_MS,
    };
  }

  const nextLevel = Math.min(REVIEW_INTERVAL_DAYS.length, current + 1);
  const interval = REVIEW_INTERVAL_DAYS[nextLevel - 1];
  return {
    reviewLevel: nextLevel,
    lastReviewedAt: now,
    nextReviewAt: startOfLocalDay(now) + interval * DAY_MS,
  };
}

function clampLevel(value?: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(REVIEW_INTERVAL_DAYS.length, Math.trunc(value ?? 0)));
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
