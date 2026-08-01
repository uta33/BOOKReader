import assert from 'node:assert/strict';
import type { Book } from '../../src/types/book.ts';
import {
  applyFullSnapshot,
  applyServerChanges,
  dirtyChanges,
  flattenLibrary,
  replaceWithServerSnapshot,
  type SyncChange,
} from '../../src/services/syncModel.ts';

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: '端末の本',
    uri: 'file:///private/book.txt',
    totalPages: 100,
    sentences: [{ id: 's1', text: '端末だけの本文', pageNumber: 1 }],
    lastSentenceIdx: 8,
    cachedSentenceIds: ['s1'],
    createdAt: 1,
    updatedAt: 100,
    originDeviceId: 'device-a',
    kind: 'content',
    dogEars: [],
    links: [],
    purposes: [],
    ...overrides,
  };
}

const flattened = flattenLibrary(
  [
    book({
      dogEars: [
        {
          id: 'dog-1',
          page: 2,
          quote: '引用',
          createdAt: 2,
          updatedAt: 3,
          originDeviceId: 'device-a',
          photoUri: 'file:///private/photo.jpg',
          reviewLevel: 2,
          lastReviewedAt: 100,
          nextReviewAt: 200,
          photoAttachmentId: 'att-dog-1',
        },
      ],
    }),
  ],
  'device-a',
);
const flattenedBook = flattened.find((change) => change.entity === 'book')!;
assert.equal('sentences' in flattenedBook.data, false);
assert.equal('uri' in flattenedBook.data, false);
assert.equal(
  'photoUri' in flattened.find((change) => change.entity === 'dogEar')!.data,
  false,
);
assert.equal(flattened.find((change) => change.entity === 'dogEar')!.data.reviewLevel, 2);
assert.equal(flattened.find((change) => change.entity === 'dogEar')!.data.nextReviewAt, 200);
assert.equal(
  flattened.find((change) => change.entity === 'dogEar')!.data.photoAttachmentId,
  'att-dog-1',
);

const photoPreserved = applyServerChanges(
  [
    book({
      dogEars: [
        {
          id: 'dog-photo',
          page: 2,
          quote: '端末の引用',
          photoUri: 'file:///private/diagram.png',
          photoAttachmentId: 'att-photo',
          photoAttachmentSyncedAt: 123,
          createdAt: 2,
          updatedAt: 3,
          originDeviceId: 'device-a',
        },
      ],
    }),
  ],
  [
    {
      entity: 'dogEar',
      id: 'dog-photo',
      bookId: 'book-1',
      data: {
        page: 3,
        quote: '別端末で更新',
        createdAt: 2,
        reviewLevel: 3,
        nextReviewAt: 500,
        photoAttachmentId: 'att-photo',
      },
      updatedAt: 4,
      originDeviceId: 'device-b',
    },
  ],
)[0];
assert.equal(photoPreserved.dogEars[0].quote, '別端末で更新');
assert.equal(photoPreserved.dogEars[0].photoUri, 'file:///private/diagram.png');
assert.equal(photoPreserved.dogEars[0].reviewLevel, 3);
assert.equal(photoPreserved.dogEars[0].nextReviewAt, 500);
assert.equal(photoPreserved.dogEars[0].photoAttachmentSyncedAt, 123);

const replacedPhoto = applyServerChanges(
  [photoPreserved],
  [{
    entity: 'dogEar',
    id: 'dog-photo',
    bookId: 'book-1',
    data: { page: 3, quote: '画像を更新', createdAt: 2, photoAttachmentId: 'att-new' },
    updatedAt: 5,
    originDeviceId: 'device-c',
  }],
)[0].dogEars[0];
assert.equal(replacedPhoto.photoAttachmentId, 'att-new');
assert.equal(replacedPhoto.photoUri, undefined);
assert.equal(replacedPhoto.photoAttachmentSyncedAt, undefined);

const olderRemote: SyncChange = {
  entity: 'book',
  id: 'book-1',
  data: { title: '古いサーバー本', lastSentenceIdx: 12 },
  updatedAt: 90,
  originDeviceId: 'device-b',
};
const positionMerged = applyServerChanges([book()], [olderRemote])[0];
assert.equal(positionMerged.title, '端末の本');
assert.equal(positionMerged.lastSentenceIdx, 12);
assert.equal(positionMerged.uri, 'file:///private/book.txt');
assert.equal(positionMerged.sentences.length, 1);

const tombstone: SyncChange = {
  entity: 'book',
  id: 'book-1',
  data: { title: '削除済み' },
  updatedAt: 100,
  deletedAt: 100,
  originDeviceId: 'device-z',
};
assert.equal(applyServerChanges([book()], [tombstone])[0].deletedAt, 100);

const clearedOptional = applyServerChanges(
  [book({ recap: '端末の古い値', updatedAt: 100 })],
  [
    {
      entity: 'book',
      id: 'book-1',
      data: {
        title: 'サーバー正本',
        kind: 'content',
        createdAt: 1,
        lastSentenceIdx: 8,
      },
      updatedAt: 101,
      originDeviceId: 'device-b',
    },
  ],
)[0];
assert.equal(clearedOptional.recap, undefined);
assert.equal(clearedOptional.title, 'サーバー正本');

const clockAdjusted = applyServerChanges(
  [book({ updatedAt: 999_999, title: '時計ずれ端末' })],
  [
    {
      entity: 'book',
      id: 'book-1',
      data: { title: '時計ずれ端末', lastSentenceIdx: 8 },
      updatedAt: 500,
      originDeviceId: 'device-a',
    },
  ],
  new Map([['book:book-1', 999_999]]),
)[0];
assert.equal(clockAdjusted.updatedAt, 500);

const dogA: SyncChange = {
  entity: 'dogEar',
  id: 'dog-a',
  bookId: 'book-1',
  data: { page: 1, quote: 'A', createdAt: 2 },
  updatedAt: 10,
  originDeviceId: 'device-a',
};
const dogB: SyncChange = {
  entity: 'dogEar',
  id: 'dog-b',
  bookId: 'book-1',
  data: { page: 2, quote: 'B', createdAt: 3 },
  updatedAt: 11,
  originDeviceId: 'device-b',
};
assert.deepEqual(
  applyServerChanges([book()], [dogA, dogB])[0].dogEars.map((item) => item.id).sort(),
  ['dog-a', 'dog-b'],
);

const metadata = { cursor: 10, syncedAt: { 'book:book-1': 100, 'book:gone': 50 } };
const full = applyFullSnapshot(
  [book(), book({ id: 'gone', title: '消える本', updatedAt: 50 })],
  [olderRemote],
  metadata,
  'device-a',
);
assert.equal(full.some((item) => item.id === 'gone'), false);
assert.equal(dirtyChanges([book({ updatedAt: 101 })], metadata, 'device-a').length, 1);

const adopted = replaceWithServerSnapshot(
  [
    book({
      id: 'source-local-id',
      isbn: '9780000000002',
      title: '端末コンテンツ',
      sentences: [{ id: 'local-sentence', text: '同期しない本文', pageNumber: 1 }],
      cachedSentenceIds: ['local-sentence'],
    }),
  ],
  [
    {
      entity: 'book',
      id: 'canonical-server-id',
      data: {
        title: '端末コンテンツ',
        isbn: '9780000000002',
        kind: 'content',
        createdAt: 1,
        lastSentenceIdx: 8,
      },
      updatedAt: 200,
      originDeviceId: 'server-device',
      rev: 20,
    },
  ],
  true,
);
assert.equal(adopted[0].id, 'canonical-server-id');
assert.equal(adopted[0].sentences[0].text, '同期しない本文');
assert.equal(
  replaceWithServerSnapshot([book()], [olderRemote], false)[0].sentences.length,
  0,
);

console.log('sync.test.mts: passed');
