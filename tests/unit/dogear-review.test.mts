import assert from 'node:assert/strict';
import { dueDogEars, reviewPatch } from '../../src/services/dogEarReview.ts';
import type { Book, DogEar } from '../../src/types/book.ts';

const now = new Date(2026, 7, 1, 12).getTime();
const dogEar = (id: string, nextReviewAt?: number): DogEar => ({
  id,
  page: 1,
  quote: id,
  createdAt: id.charCodeAt(0),
  nextReviewAt,
});
const book: Book = {
  id: 'b1', title: '本', uri: '', totalPages: 1, sentences: [], lastSentenceIdx: 0,
  cachedSentenceIds: [], createdAt: 1, kind: 'paper', links: [], purposes: [],
  dogEars: [dogEar('a'), dogEar('b', now - 1), dogEar('c', now + 2 * 86_400_000)],
};

assert.deepEqual(dueDogEars([book], now).map((item) => item.dogEar.id), ['a', 'b']);
assert.equal(dueDogEars([book], now, 1).length, 1);

const remembered = reviewPatch(dogEar('a'), 'remembered', now);
assert.equal(remembered.reviewLevel, 1);
assert.equal(remembered.lastReviewedAt, now);
assert.equal(dueDogEars([{ ...book, dogEars: [{ ...dogEar('a'), ...remembered }] }], now).length, 0);

const levelTwo = reviewPatch({ ...dogEar('a'), reviewLevel: 1 }, 'remembered', now);
assert.equal(levelTwo.reviewLevel, 2);
assert.equal(levelTwo.nextReviewAt! - remembered.nextReviewAt!, 2 * 86_400_000);

const again = reviewPatch({ ...dogEar('a'), reviewLevel: 4 }, 'again', now);
assert.equal(again.reviewLevel, 3);
assert.equal(again.nextReviewAt, remembered.nextReviewAt);

console.log('dogear-review.test.mts: passed');
