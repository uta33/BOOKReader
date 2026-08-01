import assert from 'node:assert/strict';
import { normalizeSyncChange } from '../src/sync.ts';

const normalized = normalizeSyncChange({
  entity: 'dogEar',
  id: 'dog_1',
  bookId: 'book_1',
  data: {
    page: 10,
    quote: '引用',
    reviewLevel: 2,
    lastReviewedAt: 100,
    nextReviewAt: 200,
    photoAttachmentId: 'att_1',
    photoUri: 'file:///private/never-sync.jpg',
    photoAttachmentSyncedAt: 300,
  },
  updatedAt: 400,
  originDeviceId: 'device_1',
}, 500);

assert.equal(normalized.data.reviewLevel, 2);
assert.equal(normalized.data.lastReviewedAt, 100);
assert.equal(normalized.data.nextReviewAt, 200);
assert.equal(normalized.data.photoAttachmentId, 'att_1');
assert.equal('photoUri' in normalized.data, false);
assert.equal('photoAttachmentSyncedAt' in normalized.data, false);

console.log('sync.test.mts: passed');
