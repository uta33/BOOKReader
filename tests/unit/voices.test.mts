import assert from 'node:assert/strict';
import { DEFAULT_VOICE, VOICES } from '../../src/constants/voices';

assert.ok(VOICES.length > 0, '音声一覧が空でない');
assert.equal(new Set(VOICES.map((voice) => voice.name)).size, VOICES.length, '音声IDが一意');
assert.equal(new Set(VOICES.map((voice) => voice.label)).size, VOICES.length, '表示名が一意');
assert.ok(VOICES.some((voice) => voice.name === DEFAULT_VOICE), '既定音声が一覧に存在');

for (const voice of VOICES) {
  assert.ok(voice.label.trim().length > 0, `${voice.name} の表示名が空でない`);
  const labelVariant = voice.label.match(/^[男女]性([A-D])\s/)?.[1];
  const nameVariant = voice.name.match(/-([A-D])$/)?.[1];
  assert.equal(labelVariant, nameVariant, `${voice.name} と表示名の音声記号が一致`);
}

console.log('voices.test.mts: passed');
