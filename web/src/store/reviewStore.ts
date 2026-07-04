import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuizItem, RecallGrade, ReviewItem } from '../types/book';
import { applyGrade, createReviewItem, isDue } from '../services/spacedRepetition';

interface ReviewState {
  items: ReviewItem[];
  /**
   * Register review items when the user saves a recap: one 'recap' item from
   * their own words plus one 'quiz' item per content-specific question.
   * Replaces any previous items for the book (recap was rewritten).
   */
  addFromRecap: (bookId: string, title: string, recap: string, quiz?: QuizItem[]) => void;
  grade: (id: string, grade: RecallGrade) => void;
  removeForBook: (bookId: string) => void;
  dueItems: (now?: number) => ReviewItem[];
  dueCount: (now?: number) => number;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      items: [],
      addFromRecap: (bookId, title, recap, quiz = []) => {
        const now = Date.now();
        const recapItem: ReviewItem = {
          ...createReviewItem(
            bookId,
            `「${title}」で学んだ最も重要なことは何でしたか？自分の言葉で思い出してみましょう。`,
            recap,
            now,
          ),
          kind: 'recap',
        };
        const quizItems: ReviewItem[] = quiz.map((qa, i) => ({
          ...createReviewItem(bookId, qa.q, qa.a, now + i + 1),
          kind: 'quiz',
        }));
        set((s) => ({
          items: [recapItem, ...quizItems, ...s.items.filter((it) => it.bookId !== bookId)],
        }));
      },
      grade: (id, g) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? applyGrade(i, g) : i)),
        })),
      removeForBook: (bookId) =>
        set((s) => ({ items: s.items.filter((i) => i.bookId !== bookId) })),
      dueItems: (now = Date.now()) => get().items.filter((i) => isDue(i, now)),
      dueCount: (now = Date.now()) => get().items.filter((i) => isDue(i, now)).length,
    }),
    { name: 'bookreader_reviews' },
  ),
);
