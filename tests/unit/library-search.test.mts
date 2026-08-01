import assert from 'node:assert/strict';
import { bookMatchesQuery, normalizeSearchQuery } from '../../src/services/librarySearch.ts';
import type { Book } from '../../src/types/book.ts';

const book: Book = {
  id: 'book-1',
  title: 'エッセンシャル思考',
  author: 'グレッグ・マキューン',
  publisher: 'かんき出版',
  isbn: '9784761270438',
  uri: '',
  totalPages: 320,
  sentences: [],
  lastSentenceIdx: 0,
  cachedSentenceIds: [],
  createdAt: 1,
  kind: 'paper',
  dogEars: [{ id: 'd1', page: 42, quote: 'より少なく、しかしより良く', comment: '予定を減らす', createdAt: 2 }],
  links: [{ id: 'l1', label: '参考資料', url: 'https://example.com', kind: 'other', createdAt: 3 }],
  purposes: ['practice'],
  summary: '本当に重要なことを選ぶ本。',
  recap: '断る基準を先に決める。',
};

assert.equal(bookMatchesQuery(book, 'エッセンシャル'), true);
assert.equal(bookMatchesQuery(book, 'マキューン 予定'), true);
assert.equal(bookMatchesQuery(book, 'より良く 参考資料'), true);
assert.equal(bookMatchesQuery(book, '実践する'), true);
assert.equal(bookMatchesQuery(book, '存在しない語'), false);
assert.equal(bookMatchesQuery(book, '９７８４７６１２７０４３８'), true);
assert.equal(normalizeSearchQuery('  ＡＢＣ\nテスト  '), 'abc テスト');

console.log('library-search.test.mts: passed');
