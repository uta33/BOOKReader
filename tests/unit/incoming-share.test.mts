import assert from 'node:assert/strict';
import { normalizeIncomingShare } from '../../src/services/incomingShare.ts';

assert.deepEqual(
  normalizeIncomingShare(
    [{ shareType: 'text', value: '重要な引用 https://example.com/article', mimeType: 'text/plain' }],
    [],
  ),
  { quote: '重要な引用', url: 'https://example.com/article', linkLabel: 'example.com' },
);

assert.deepEqual(
  normalizeIncomingShare([{ shareType: 'url', value: 'https://example.com/path)。' }], []),
  { quote: '', url: 'https://example.com/path', linkLabel: 'example.com' },
);

const image = normalizeIncomingShare(
  [{ shareType: 'image', value: 'content://raw', mimeType: 'image/png' }],
  [{
    shareType: 'image',
    value: 'content://raw',
    mimeType: 'image/png',
    contentUri: 'content://resolved',
    contentType: 'image',
    contentMimeType: 'image/png',
    originalName: 'chart.png',
    contentSize: 100,
  }],
);
assert.equal(image?.image?.uri, 'content://resolved');
assert.equal(image?.image?.fileName, 'chart.png');
assert.equal(normalizeIncomingShare([], []), null);

console.log('incoming-share.test.mts: passed');
