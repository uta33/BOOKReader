import assert from 'node:assert/strict';
import {
  DAILY_BUDGET_MICRO_USD,
  MONTHLY_BUDGET_MICRO_USD,
  estimateCharge,
  utcBuckets,
} from '../src/quota.ts';

assert.deepEqual(utcBuckets(new Date('2026-07-28T23:59:59.999Z')), {
  day: '2026-07-28',
  month: '2026-07',
});
assert.deepEqual(utcBuckets(new Date('2026-07-29T00:00:00.000Z')), {
  day: '2026-07-29',
  month: '2026-07',
});
assert.equal(estimateCharge('summary', 1), 100_000);
assert.equal(estimateCharge('quiz', 1), 30_000);
assert.equal(estimateCharge('tts', 5_000), 80_000);
assert.equal(estimateCharge('ocr', 4), 6_000);
assert.equal(DAILY_BUDGET_MICRO_USD, 2_000_000);
assert.equal(MONTHLY_BUDGET_MICRO_USD, 20_000_000);

console.log('quota.test.mts: passed');
