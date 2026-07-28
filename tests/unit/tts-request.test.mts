import assert from 'node:assert/strict';
import { buildWorkerTtsRequest } from '../../src/services/ttsRequest.ts';

const request = buildWorkerTtsRequest('本文', {
  voiceName: 'ja-JP-Neural2-B',
  speakingRate: 1.25,
  pitch: -1,
});

assert.deepEqual(request, {
  text: '本文',
  voiceName: 'ja-JP-Neural2-B',
  speakingRate: 1.25,
  pitch: -1,
});
assert.equal('input' in request, false);
assert.equal('audioConfig' in request, false);

console.log('tts-request.test.mts: passed');
