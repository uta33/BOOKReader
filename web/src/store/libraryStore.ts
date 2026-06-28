import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Book } from '../types/book';
import { deleteClipsForBook } from '../services/audioCache';

interface LibraryState {
  books: Book[];
  addBook: (book: Book) => void;
  updateBook: (id: string, partial: Partial<Book>) => void;
  removeBook: (id: string) => void;
  getBook: (id: string) => Book | undefined;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: [],
      addBook: (book) => set((s) => ({ books: [book, ...s.books] })),
      updateBook: (id, partial) =>
        set((s) => ({ books: s.books.map((b) => (b.id === id ? { ...b, ...partial } : b)) })),
      removeBook: (id) => {
        void deleteClipsForBook(id);
        set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
      },
      getBook: (id) => get().books.find((b) => b.id === id),
    }),
    { name: 'bookreader_library' },
  ),
);
