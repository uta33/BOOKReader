import assert from 'node:assert/strict';
import {
  MAX_BOOK_COVER_BYTES,
  bookCoverExtension,
  exceedsBookCoverLimit,
  isSupportedBookCoverUrl,
} from '../../src/services/bookCoverPolicy.ts';

assert.equal(isSupportedBookCoverUrl('https://cover.openbd.jp/9784480020475.jpg'), true);
assert.equal(
  isSupportedBookCoverUrl('https://covers.openlibrary.org/b/isbn/9784480020475-L.jpg'),
  true,
);
assert.equal(isSupportedBookCoverUrl('http://cover.openbd.jp/book.jpg'), false);
assert.equal(isSupportedBookCoverUrl('https://cover.openbd.jp.evil.example/book.jpg'), false);
assert.equal(isSupportedBookCoverUrl('file:///private/book.jpg'), false);
assert.equal(isSupportedBookCoverUrl('not-a-url'), false);

assert.equal(bookCoverExtension('image/jpeg; charset=binary'), 'jpg');
assert.equal(bookCoverExtension('IMAGE/WEBP'), 'webp');
assert.equal(bookCoverExtension('text/html'), undefined);
assert.equal(bookCoverExtension(null), undefined);

assert.equal(exceedsBookCoverLimit(MAX_BOOK_COVER_BYTES), false);
assert.equal(exceedsBookCoverLimit(MAX_BOOK_COVER_BYTES + 1), true);
assert.equal(exceedsBookCoverLimit(0), false);

console.log('cover.test.mts: passed');
