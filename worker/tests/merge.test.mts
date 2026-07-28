import assert from 'node:assert/strict';
import {
  deterministicMergedId,
  mergeBookPayload,
  planAccountMerge,
  type DomainRow,
} from '../src/merge.ts';

const target = {
  id: 'target-book',
  isbn: '9780000000002',
  payload_json: JSON.stringify({
    title: 'クラウド側',
    purposes: ['thinking'],
    lastSentenceIdx: 4,
    recap: '古い振り返り',
  }),
  updated_at: 100,
  deleted_at: null,
  origin_device_id: 'device-a',
};
const source = {
  id: 'source-book',
  isbn: '9780000000002',
  payload_json: JSON.stringify({
    title: '端末側',
    purposes: ['practice'],
    lastSentenceIdx: 9,
    recap: '新しい振り返り',
  }),
  updated_at: 200,
  deleted_at: null,
  origin_device_id: 'device-b',
};

const merged = mergeBookPayload(target, source);
assert.equal(merged.payload.title, '端末側');
assert.equal(merged.payload.recap, '新しい振り返り');
assert.equal(merged.payload.lastSentenceIdx, 9);
assert.deepEqual(new Set(merged.payload.purposes as string[]), new Set(['thinking', 'practice']));

const deleted = {
  ...target,
  updated_at: 200,
  deleted_at: 200,
  origin_device_id: 'device-z',
};
assert.equal(mergeBookPayload(deleted, source).winner, deleted);
assert.equal(
  deterministicMergedId('same-id', 'source-user'),
  deterministicMergedId('same-id', 'source-user'),
);

const noIsbnSource: DomainRow = {
  ...source,
  id: 'source-no-isbn',
  isbn: null,
  payload_json: JSON.stringify({ title: 'ISBNなし' }),
};
const targetDogEar: DomainRow = {
  id: 'dog-cloud',
  book_id: target.id,
  payload_json: JSON.stringify({ quote: 'クラウドの抜き書き' }),
  updated_at: 100,
  deleted_at: null,
  origin_device_id: 'device-a',
};
const sourceDogEar: DomainRow = {
  id: 'dog-device',
  book_id: source.id,
  payload_json: JSON.stringify({ quote: '端末の抜き書き' }),
  updated_at: 200,
  deleted_at: null,
  origin_device_id: 'device-b',
};
const plan = planAccountMerge(
  'source-user',
  [source, noIsbnSource],
  [target],
  [sourceDogEar],
  [targetDogEar],
  [],
  [],
);
assert.equal(plan.bookIdMap.get(source.id), target.id);
assert.equal(plan.bookIdMap.get(noIsbnSource.id), noIsbnSource.id);
assert.equal(
  plan.writes.find((row) => row.entity === 'dogEar' && row.id === sourceDogEar.id)?.book_id,
  target.id,
);
assert.deepEqual(
  new Set([
    targetDogEar.id,
    ...plan.writes.filter((row) => row.entity === 'dogEar').map((row) => row.id),
  ]),
  new Set(['dog-cloud', 'dog-device']),
);

console.log('merge.test.mts: passed');
