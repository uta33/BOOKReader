import assert from 'node:assert/strict';
import {
  LIMITS,
  optionalText,
  requireText,
  validateOcrImages,
  validateTtsParts,
} from '../src/limits.ts';
import { readJson, readText } from '../src/errors.ts';

function rejects(label: string, fn: () => unknown) {
  assert.throws(fn, label);
}

assert.equal(requireText('  本  ', 'topic', LIMITS.topic), '本');
rejects('empty topic', () => requireText('', 'topic', LIMITS.topic));
rejects('topic over limit', () => requireText('a'.repeat(201), 'topic', LIMITS.topic));
assert.equal(optionalText(undefined, 'guidance', LIMITS.guidance), undefined);
rejects('guidance over limit', () =>
  optionalText('a'.repeat(1001), 'guidance', LIMITS.guidance),
);

const validParts = validateTtsParts([
  { id: 'one', text: '最初の文。' },
  { id: 'two', text: '次の文。' },
]);
assert.equal(validParts.totalChars, 9);
rejects('too many parts', () =>
  validateTtsParts(
    Array.from({ length: LIMITS.ttsParts + 1 }, (_, index) => ({
      id: String(index),
      text: 'a',
    })),
  ),
);
rejects('parts total over limit', () =>
  validateTtsParts([{ id: 'one', text: 'a'.repeat(LIMITS.ttsText + 1) }]),
);

assert.equal(validateOcrImages(['YQ==']).length, 1);
rejects('too many OCR images', () =>
  validateOcrImages(Array.from({ length: LIMITS.ocrImages + 1 }, () => 'YQ==')),
);
rejects('OCR image over limit', () =>
  validateOcrImages(['a'.repeat(Math.ceil((LIMITS.ocrBase64Bytes + 1) * 4 / 3))]),
);

await assert.rejects(
  () => readText(new Request('https://example.test', { method: 'POST', body: '12345' }), 4),
  /too large/i,
);
await assert.rejects(
  () => readJson(new Request('https://example.test', { method: 'POST', body: '{broken' }), 100),
  /Invalid JSON/,
);

console.log('limits.test.mts: passed');
