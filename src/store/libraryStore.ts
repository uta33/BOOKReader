import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PurposeId } from '../constants/purposes';
import { getDeviceId } from '../services/deviceIdentity';
import { migrateLibrary } from '../services/libraryMigration';
import { signalSyncNeeded } from '../services/syncTrigger';
import type { Book, DigitalLink, DogEar } from '../types/book';

interface LibraryState {
  /** UI向け。削除済みの本・抜き書き・リンクを除いた派生配列。 */
  books: Book[];
  /** 永続化と同期向け。tombstoneを含む素の配列。 */
  allBooks: Book[];
  deviceId: string;
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
  replaceAllBooks: (books: Book[], notify?: boolean) => void;
  loadLibrary: () => Promise<void>;
  saveLibrary: () => Promise<void>;
  clearLibrary: () => Promise<void>;
}

const STORAGE_KEY = 'bookreader_library';
let saveChain = Promise.resolve();

function visibleBooks(records: Book[]): Book[] {
  return records
    .filter((book) => !book.deletedAt)
    .map((book) => ({
      ...book,
      dogEars: book.dogEars.filter((dogEar) => !dogEar.deletedAt),
      links: book.links.filter((link) => !link.deletedAt),
    }));
}

function withBookMeta(book: Book, deviceId: string, now: number): Book {
  return {
    ...book,
    updatedAt: Math.max(book.updatedAt ?? now, book.deletedAt ?? 0),
    originDeviceId:
      !book.originDeviceId || book.originDeviceId === 'legacy' ? deviceId : book.originDeviceId,
    dogEars: book.dogEars.map((item) => ({
      ...item,
      updatedAt: Math.max(
        item.updatedAt ?? item.createdAt ?? now,
        item.deletedAt ?? 0,
      ),
      originDeviceId:
        !item.originDeviceId || item.originDeviceId === 'legacy'
          ? deviceId
          : item.originDeviceId,
    })),
    links: book.links.map((item) => ({
      ...item,
      updatedAt: Math.max(
        item.updatedAt ?? item.createdAt ?? now,
        item.deletedAt ?? 0,
      ),
      originDeviceId:
        !item.originDeviceId || item.originDeviceId === 'legacy'
          ? deviceId
          : item.originDeviceId,
    })),
  };
}

function nextTimestamp(updatedAt?: number, deletedAt?: number): number {
  return Math.max(Date.now(), (updatedAt ?? 0) + 1, (deletedAt ?? 0) + 1);
}

export const useLibraryStore = create<LibraryState>((set, get) => {
  const commit = (records: Book[], notify = true) => {
    set({ allBooks: records, books: visibleBooks(records) });
    void get().saveLibrary();
    if (notify) signalSyncNeeded();
  };

  const patchBook = (id: string, fn: (book: Book) => Book, touchBook = true) => {
    const records = get().allBooks.map((book) => {
      if (book.id !== id) return book;
      const next = fn(book);
      return touchBook
        ? {
            ...next,
            updatedAt: nextTimestamp(book.updatedAt, book.deletedAt),
            deletedAt: undefined,
            originDeviceId: get().deviceId,
          }
        : next;
    });
    commit(records);
  };

  return {
    books: [],
    allBooks: [],
    deviceId: 'legacy',

    addBook: (book) => {
      const now = Date.now();
      commit([withBookMeta(book, get().deviceId, now), ...get().allBooks]);
    },

    updateBook: (id, partial) => patchBook(id, (book) => ({ ...book, ...partial })),

    removeBook: (id) => {
      const records = get().allBooks.map((book) =>
        book.id === id
          ? (() => {
              const now = nextTimestamp(book.updatedAt, book.deletedAt);
              return {
                ...book,
                updatedAt: now,
                deletedAt: now,
                originDeviceId: get().deviceId,
              };
            })()
          : book,
      );
      commit(records);
    },

    getBook: (id) => get().books.find((book) => book.id === id),

    addDogEar: (bookId, dogEar) =>
      patchBook(
        bookId,
        (book) => {
          const now = Date.now();
          return {
            ...book,
            dogEars: [
              {
                ...dogEar,
                updatedAt: dogEar.updatedAt ?? now,
                originDeviceId: dogEar.originDeviceId ?? get().deviceId,
              },
              ...book.dogEars,
            ],
          };
        },
        false,
      ),

    updateDogEar: (bookId, dogEarId, partial) =>
      patchBook(
        bookId,
        (book) => ({
          ...book,
            dogEars: book.dogEars.map((dogEar) =>
              dogEar.id === dogEarId
                ? {
                    ...dogEar,
                    ...partial,
                    updatedAt: nextTimestamp(dogEar.updatedAt, dogEar.deletedAt),
                    deletedAt: undefined,
                    originDeviceId: get().deviceId,
                  }
                : dogEar,
          ),
        }),
        false,
      ),

    removeDogEar: (bookId, dogEarId) =>
      patchBook(
        bookId,
        (book) => {
          return {
            ...book,
            dogEars: book.dogEars.map((dogEar) =>
              dogEar.id === dogEarId
                ? (() => {
                    const now = nextTimestamp(dogEar.updatedAt, dogEar.deletedAt);
                    return {
                      ...dogEar,
                      updatedAt: now,
                      deletedAt: now,
                      originDeviceId: get().deviceId,
                    };
                  })()
                : dogEar,
            ),
          };
        },
        false,
      ),

    addLink: (bookId, link) =>
      patchBook(
        bookId,
        (book) => {
          const now = Date.now();
          return {
            ...book,
            links: [
              ...book.links,
              {
                ...link,
                updatedAt: link.updatedAt ?? now,
                originDeviceId: link.originDeviceId ?? get().deviceId,
              },
            ],
          };
        },
        false,
      ),

    removeLink: (bookId, linkId) =>
      patchBook(
        bookId,
        (book) => {
          return {
            ...book,
            links: book.links.map((link) =>
              link.id === linkId
                ? (() => {
                    const now = nextTimestamp(link.updatedAt, link.deletedAt);
                    return {
                      ...link,
                      updatedAt: now,
                      deletedAt: now,
                      originDeviceId: get().deviceId,
                    };
                  })()
                : link,
            ),
          };
        },
        false,
      ),

    togglePurpose: (bookId, purpose) =>
      patchBook(bookId, (book) => ({
        ...book,
        purposes: book.purposes.includes(purpose)
          ? book.purposes.filter((value) => value !== purpose)
          : [...book.purposes, purpose],
      })),

    setFinished: (bookId, finished) =>
      patchBook(bookId, (book) => ({
        ...book,
        finishedAt: finished ? (book.finishedAt ?? Date.now()) : undefined,
      })),

    replaceAllBooks: (records, notify = false) => commit(records, notify),

    loadLibrary: async () => {
      try {
        const [raw, deviceId] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          getDeviceId(),
        ]);
        const records = migrateLibrary(raw).map((book) =>
          withBookMeta(book, deviceId, Date.now()),
        );
        set({ allBooks: records, books: visibleBooks(records), deviceId });
      } catch {
        set({ books: [], allBooks: [] });
      }
    },

    saveLibrary: async () => {
      const serialized = JSON.stringify(get().allBooks);
      saveChain = saveChain
        .catch(() => undefined)
        .then(() => AsyncStorage.setItem(STORAGE_KEY, serialized));
      await saveChain;
    },

    clearLibrary: async () => {
      set({ books: [], allBooks: [] });
      saveChain = saveChain
        .catch(() => undefined)
        .then(() => AsyncStorage.removeItem(STORAGE_KEY));
      await saveChain;
    },
  };
});
