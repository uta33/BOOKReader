import assert from 'node:assert/strict';
import {
  appendSpeechTranscript,
  speechInputErrorMessage,
} from '../../src/services/speechInput.ts';

assert.equal(appendSpeechTranscript('', ' 声で入力した文章です。 '), '声で入力した文章です。');
assert.equal(
  appendSpeechTranscript('既存の抜き書き', '続けて読み上げた文章'),
  '既存の抜き書き\n続けて読み上げた文章',
);
assert.equal(
  appendSpeechTranscript('既存の抜き書き\n', '続き'),
  '既存の抜き書き\n続き',
);
assert.equal(appendSpeechTranscript('既存の文章', '   '), '既存の文章');
assert.equal(appendSpeechTranscript('   ', '新しい文章'), '新しい文章');

assert.match(speechInputErrorMessage('not-allowed') ?? '', /マイク/);
assert.match(speechInputErrorMessage('network') ?? '', /通信状態/);
assert.match(speechInputErrorMessage('no-speech') ?? '', /聞き取れません/);
assert.match(speechInputErrorMessage('service-not-allowed') ?? '', /音声認識サービス/);
assert.equal(speechInputErrorMessage('aborted'), null);
assert.match(speechInputErrorMessage('unknown') ?? '', /文字にできません/);

console.log('speech-input.test.mts: passed');
