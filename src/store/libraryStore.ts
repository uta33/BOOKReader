import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Book } from '../types/book';

interface LibraryState {
  books: Book[];
  addBook: (book: Book) => void;
  updateBook: (id: string, partial: Partial<Book>) => void;
  removeBook: (id: string) => void;
  loadLibrary: () => Promise<void>;
  saveLibrary: () => Promise<void>;
}

const STORAGE_KEY = 'bookreader_library';

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],

  addBook: (book) => {
    set((s) => ({ books: [book, ...s.books] }));
    get().saveLibrary();
  },

  updateBook: (id, partial) => {
    set((s) => ({ books: s.books.map((b) => (b.id === id ? { ...b, ...partial } : b)) }));
    get().saveLibrary();
  },

  removeBook: (id) => {
    set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
    get().saveLibrary();
  },

  loadLibrary: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) set({ books: JSON.parse(raw) });
  },

  saveLibrary: async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(get().books));
  },
}));
