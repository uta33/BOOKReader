import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RecallGrade, ReviewItem } from '../types/book';
import { applyGrade, createReviewItem, isDue } from '../services/spacedRepetition';

interface ReviewState {
  items: ReviewItem[];
  addFromRecap: (bookId: string, title: string, recap: string) => void;
  grade: (id: string, grade: RecallGrade) => void;
  removeForBook: (bookId: string) => void;
  dueItems: (now?: number) => ReviewItem[];
  dueCount: (now?: number) => number;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      items: [],
      addFromRecap: (bookId, title, recap) => {
        const prompt = `「${title}」で学んだ最も重要なことは何でしたか？自分の言葉で思い出してみましょう。`;
        const item = createReviewItem(bookId, prompt, recap);
        // Replace any existing item for this book (recap was rewritten).
        set((s) => ({ items: [item, ...s.items.filter((i) => i.bookId !== bookId)] }));
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
