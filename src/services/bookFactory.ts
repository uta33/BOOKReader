/**
 * Book の生成口。必須配列（dogEars / links / purposes）を確実に埋めるため、
 * 書籍の新規作成は必ずここを通す。
 */
import type { PurposeId } from '../constants/purposes';
import type { Book, Sentence } from '../types/book';

interface PaperInput {
  title: string;
  author?: string;
  publisher?: string;
  pubdate?: string;
  isbn?: string;
  coverUrl?: string;
  bookstore?: string;
  totalPages?: number;
  purposes?: PurposeId[];
}

export function createPaperBook(input: PaperInput): Book {
  return {
    id: `paper_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: input.title,
    kind: 'paper',
    uri: '',
    totalPages: Math.max(0, Math.trunc(input.totalPages ?? 0)),
    sentences: [],
    lastSentenceIdx: 0,
    cachedSentenceIds: [],
    createdAt: Date.now(),

    dogEars: [],
    links: [],
    purposes: input.purposes ?? [],

    isbn: input.isbn,
    author: input.author,
    publisher: input.publisher,
    pubdate: input.pubdate,
    coverUrl: input.coverUrl,
    bookstore: input.bookstore,
  };
}

interface ContentInput {
  id?: string;
  title: string;
  uri: string;
  totalPages: number;
  sentences: Sentence[];
  summary?: string;
  purposes?: PurposeId[];
}

export function createContentBook(input: ContentInput): Book {
  return {
    id: input.id ?? `book_${Date.now()}`,
    title: input.title,
    kind: 'content',
    uri: input.uri,
    totalPages: input.totalPages,
    sentences: input.sentences,
    lastSentenceIdx: 0,
    cachedSentenceIds: [],
    createdAt: Date.now(),

    dogEars: [],
    links: [],
    purposes: input.purposes ?? [],

    summary: input.summary,
  };
}
