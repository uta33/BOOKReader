import assert from 'node:assert/strict';
import { buildDiagnostics, QUOTA_LIMITS } from '../src/diagnostics.ts';
import type { Env } from '../src/types.ts';

const configured = buildDiagnostics(
  {
    ANTHROPIC_API_KEY: 'configured',
    GOOGLE_TTS_API_KEY: 'configured',
    GOOGLE_OAUTH_CLIENT_ID: 'configured',
    GOOGLE_OAUTH_CLIENT_SECRET: 'configured',
  } as Env,
  {
    day: '2026-08-01',
    summary_count: 3,
    quiz_count: 4,
    tts_chars: 500,
    ocr_pages: 6,
    spend_microusd: 123_000,
  },
  '2026-08-01',
);

assert.equal(configured.services.summary, true);
assert.equal(configured.services.tts, true);
assert.equal(configured.services.ocr, true);
assert.equal(configured.services.googleAuth, true);
assert.deepEqual(configured.quota.limits, QUOTA_LIMITS);
assert.equal(configured.quota.used.ttsChars, 500);
assert.equal(configured.quota.estimatedUsd, 0.123);

const missing = buildDiagnostics({} as Env, { summary_count: -1 }, '2026-08-02');
assert.equal(missing.services.summary, false);
assert.equal(missing.services.googleAuth, false);
assert.equal(missing.quota.used.summary, 0);
assert.equal(missing.quota.day, '2026-08-02');

console.log('diagnostics.test.mts: passed');
