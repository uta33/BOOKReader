import assert from 'node:assert/strict';
import { ATTACHMENT_LIMITS, validateAttachmentMetadata } from '../src/attachments.ts';
import { ApiError } from '../src/errors.ts';

const valid = validateAttachmentMetadata('att_1', 'dog_1', 'image/jpeg; charset=binary', 123);
assert.deepEqual(valid, {
  attachmentId: 'att_1',
  dogEarId: 'dog_1',
  contentType: 'image/jpeg',
  sizeBytes: 123,
});

for (const invalid of [
  () => validateAttachmentMetadata('../bad', 'dog_1', 'image/jpeg', 1),
  () => validateAttachmentMetadata('att_1', 'dog 1', 'image/jpeg', 1),
  () => validateAttachmentMetadata('att_1', 'dog_1', 'image/svg+xml', 1),
  () => validateAttachmentMetadata('att_1', 'dog_1', 'image/png', 0),
  () => validateAttachmentMetadata('att_1', 'dog_1', 'image/png', ATTACHMENT_LIMITS.maxBytes + 1),
]) {
  assert.throws(invalid, ApiError);
}

console.log('attachments.test.mts: passed');
