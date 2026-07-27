import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PurposeId } from '../constants/purposes';
import { migrateLibrary } from '../services/libraryMigration';
import { Book, DigitalLink, DogEar } from '../types/book';

interface LibraryState {
  books: Book[];
  addBook: (book: Book) => void;
  updateBook: (id: string, partial: Partial<Book>) => void;
  removeBook: (id: string) => void;
  getBook: (id: string) => Book | undefined;

  addDogEar: (bookId: string, dogEar: DogEar) => void;
  updateDogEar: (bookId: string, dogEarId: string, partial: Partial<DogEar>) => void;
  removeDogEar: (bookId: string, dogEarId: string) => void;

  addLink: (bookId: string, link: DigitalLink) => void;
  removeLink: (bookId: string, linkId: string) => void;

  togglePurpose: (bookId: string, purpose: PurposeId) => void;
  setFinished: (bookId: string, finished: boolean) => void;

  loadLibrary: () => Promise<void>;
  saveLibrary: () => Promise<void>;
}

const STORAGE_KEY = 'bookreader_library';

export const useLibraryStore = create<LibraryState>((set, get) => {
  /**
   * 1冊を差し替えて保存する共通経路。
   *
   * saveLibrary() は全書籍（取り込みPDFの全文を含む）を毎回再シリアライズするので、
   * 入力中に呼んではいけない。編集画面はローカル state で持ち、保存時に1回だけ呼ぶ。
   */
  const patch = (id: string, fn: (book: Book) => Book) => {
    set((s) => ({ books: s.books.map((b) => (b.id === id ? fn(b) : b)) }));
    void get().saveLibrary();
  };

  return {
    books: [],

    addBook: (book) => {
      set((s) => ({ books: [book, ...s.books] }));
      void get().saveLibrary();
    },

    updateBook: (id, partial) => patch(id, (b) => ({ ...b, ...partial })),

    removeBook: (id) => {
      set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
      void get().saveLibrary();
    },

    getBook: (id) => get().books.find((b) => b.id === id),

    addDogEar: (bookId, dogEar) =>
      patch(bookId, (b) => ({ ...b, dogEars: [dogEar, ...b.dogEars] })),

    updateDogEar: (bookId, dogEarId, partial) =>
      patch(bookId, (b) => ({
        ...b,
        dogEars: b.dogEars.map((d) =>
          d.id === dogEarId ? { ...d, ...partial, updatedAt: Date.now() } : d,
        ),
      })),

    removeDogEar: (bookId, dogEarId) =>
      patch(bookId, (b) => ({ ...b, dogEars: b.dogEars.filter((d) => d.id !== dogEarId) })),

    addLink: (bookId, link) => patch(bookId, (b) => ({ ...b, links: [...b.links, link] })),

    removeLink: (bookId, linkId) =>
      patch(bookId, (b) => ({ ...b, links: b.links.filter((l) => l.id !== linkId) })),

    togglePurpose: (bookId, purpose) =>
      patch(bookId, (b) => ({
        ...b,
        purposes: b.purposes.includes(purpose)
          ? b.purposes.filter((p) => p !== purpose)
          : [...b.purposes, purpose],
      })),

    setFinished: (bookId, finished) =>
      patch(bookId, (b) => ({
        ...b,
        finishedAt: finished ? (b.finishedAt ?? Date.now()) : undefined,
      })),

    loadLibrary: async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        set({ books: migrateLibrary(raw) });
      } catch {
        // 読み込めなくてもアプリは起動させる。
        set({ books: [] });
      }
    },

    saveLibrary: async () => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(get().books));
    },
  };
});
