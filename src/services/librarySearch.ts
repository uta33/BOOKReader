import { purposeLabel } from '../constants/purposes';
import type { Book } from '../types/book';

/** 表記揺れを吸収し、空白区切りの全単語が含まれるかを検索する。 */
export function bookMatchesQuery(book: Book, query: string): boolean {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;

  const searchable = normalize([
    book.title,
    book.author,
    book.publisher,
    book.pubdate,
    book.isbn,
    book.bookstore,
    book.summary,
    book.recap,
    ...book.purposes.map(purposeLabel),
    ...book.dogEars.flatMap((dogEar) => [dogEar.quote, dogEar.comment]),
    ...book.links.flatMap((link) => [link.label, link.url]),
  ].filter((value): value is string => Boolean(value)).join('\n'));

  return tokens.every((token) => searchable.includes(token));
}

export function normalizeSearchQuery(value: string): string {
  return normalize(value);
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ja-JP')
    .replace(/\s+/g, ' ')
    .trim();
}
