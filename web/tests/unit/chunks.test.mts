import {
  buildChunks,
  chunkIndexFor,
  CHUNK_CHAR_LIMIT,
  estimatedStartSeconds,
  sentenceIndexAtTimeEstimate,
} from '../../src/services/chunker.js';
import { pickVoice, voiceQualityOf } from '../../src/constants/voices.js';
import { synthesizeChunk } from '../../server/lib/tts.js';
import type { Sentence } from '../../src/types/book.js';

let failures = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}`, extra ?? '');
    failures++;
  }
};

// --- buildChunks ---
const mk = (i: number, text: string, isHeading = false): Sentence => ({
  id: `s${i}`,
  text,
  section: 1,
  ...(isHeading ? { isHeading: true } : {}),
});

const sentences: Sentence[] = [
  mk(0, '第1章 集中', true),
  mk(1, 'あ'.repeat(150)),
  mk(2, 'い'.repeat(150)),
  mk(3, 'う'.repeat(150)), // exceeds 400 with s1+s2 → new chunk
  mk(4, '第2章 継続', true), // heading → new chunk
  mk(5, '短い文です。'),
];
const chunks = buildChunks(sentences);
ok(chunks.length === 3, `3 chunks built (got ${chunks.length})`);
ok(chunks[0].startIdx === 0 && chunks[0].endIdx === 2, 'chunk0 spans s0..s2 (heading + 300 chars)');
ok(chunks[1].startIdx === 3 && chunks[1].endIdx === 3, 'chunk1 is the overflowing sentence');
ok(chunks[2].startIdx === 4 && chunks[2].endIdx === 5, 'chunk2 starts at the 第2章 heading');
ok(chunks[0].id === 'c0_2' && chunks[2].id === 'c4_5', 'stable chunk ids');
ok(
  chunks.every((c) => c.sentences.reduce((n, s) => n + s.text.length, 0) <= CHUNK_CHAR_LIMIT + 150),
  'no chunk wildly exceeds the char limit',
);
ok(chunkIndexFor(chunks, 5) === 2 && chunkIndexFor(chunks, 0) === 0, 'chunkIndexFor maps correctly');

// --- synthesizeChunk request shape (fetch mocked) ---
process.env.GOOGLE_TTS_API_KEY = 'test-key';
let captured: { url: string; body: any } | null = null;
(globalThis as any).fetch = async (url: string, init: any) => {
  captured = { url, body: JSON.parse(init.body) };
  return {
    ok: true,
    json: async () => ({
      audioContent: 'QUJD',
      timepoints: [
        { markName: 's0', timeSeconds: 0 },
        { markName: 's1', timeSeconds: 2.5 },
      ],
    }),
  } as any;
};

const result = await synthesizeChunk({
  parts: [
    { id: 's0', text: '一文目です。' },
    { id: 's1', text: '二文目 & <テスト> です。（間）' },
  ],
  voiceName: 'ja-JP-Neural2-B',
  pitch: 0,
});

ok(captured !== null && captured.url.includes('/v1beta1/'), 'uses the v1beta1 endpoint');
ok(
  JSON.stringify(captured!.body.enableTimePointing) === '["SSML_MARK"]',
  'requests SSML_MARK timepoints',
);
const ssml: string = captured!.body.input.ssml;
ok(
  ssml === '<speak><mark name="s0"/>一文目です。<mark name="s1"/>二文目 &amp; テスト です。</speak>',
  'SSML has a mark per sentence, XML-escaped, stage direction（間）sanitized out',
  ssml,
);
ok(captured!.body.audioConfig.speakingRate === 1.0, 'always synthesizes at 1.0x (speed is client-side)');
ok(
  !result.fallback && result.timepoints.length === 2 && result.audioContent === 'QUJD',
  'returns audio + timepoints',
);

// fallback without key
delete process.env.GOOGLE_TTS_API_KEY;
const fb = await synthesizeChunk({ parts: [{ id: 's0', text: 'テスト。' }], voiceName: 'x', pitch: 0 });
ok(fb.fallback === true, 'no key → fallback:true');

// empty parts throws
let threw = false;
try {
  await synthesizeChunk({ parts: [], voiceName: 'x', pitch: 0 });
} catch {
  threw = true;
}
ok(threw, 'empty parts → throws');

// --- Chirp3-HD (最高音質): plain-text request, no SSML/pitch/rate, v1 ---
process.env.GOOGLE_TTS_API_KEY = 'test-key';
captured = null;
const chirpRes = await synthesizeChunk({
  parts: [
    { id: 's0', text: '一文目です。' },
    { id: 's1', text: '二文目です。' },
  ],
  voiceName: 'ja-JP-Chirp3-HD-Aoede',
  pitch: 5,
});
ok(captured !== null && captured.url.includes('/v1/') && !captured.url.includes('v1beta1'), 'chirp uses v1 endpoint');
ok(captured!.body.input.text === '一文目です。二文目です。' && !captured!.body.input.ssml, 'chirp sends plain joined text, no SSML');
ok(captured!.body.enableTimePointing === undefined, 'chirp: no timepointing requested');
ok(
  captured!.body.audioConfig.pitch === undefined && captured!.body.audioConfig.speakingRate === undefined,
  'chirp: pitch/speakingRate omitted',
);
ok(!chirpRes.fallback && chirpRes.timepoints.length === 0, 'chirp result has empty timepoints');

// Conversational scripts: comma-bounded fragments and quote/ellipsis-only
// lines must not merge into one endless "sentence" (Chirp3 rejects those).
captured = null;
await synthesizeChunk({
  parts: [
    { id: 's0', text: 'だから長い断片、' },
    { id: 's1', text: '句点なしの断片' },
    { id: 's2', text: '…' },
    { id: 's3', text: '」' },
    { id: 's4', text: '「うわ、出た。' },
  ],
  voiceName: 'ja-JP-Chirp3-HD-Aoede',
  pitch: 0,
});
ok(
  captured!.body.input.text === 'だから長い断片。句点なしの断片。「うわ、出た。',
  'chirp: fragments get sentence ends; punctuation-only parts dropped',
  captured!.body.input.text,
);

// SSML path also drops punctuation-only parts (no mark, nothing spoken).
captured = null;
await synthesizeChunk({
  parts: [
    { id: 's0', text: '…' },
    { id: 's1', text: '本文です。' },
  ],
  voiceName: 'ja-JP-Neural2-B',
  pitch: 0,
});
ok(
  !captured!.body.input.ssml.includes('"s0"') &&
    captured!.body.input.ssml.includes('<mark name="s1"/>本文です。'),
  'ssml: punctuation-only part carries no mark',
  captured!.body.input.ssml,
);
delete process.env.GOOGLE_TTS_API_KEY;

// --- character-proportional estimation (Chirp3 highlight fallback) ---
const estChunk = buildChunks([
  mk(0, 'あ'.repeat(10)),
  mk(1, 'い'.repeat(20)),
  mk(2, 'う'.repeat(10)),
])[0];
ok(estimatedStartSeconds(estChunk, 0, 8) === 0, 'estimate: first sentence starts at 0');
ok(estimatedStartSeconds(estChunk, 1, 8) === 2, 'estimate: 10/40 chars → 2s of 8s');
ok(estimatedStartSeconds(estChunk, 2, 8) === 6, 'estimate: 30/40 chars → 6s of 8s');
ok(sentenceIndexAtTimeEstimate(estChunk, 1, 8) === 0, 'estimate index @1s → s0');
ok(sentenceIndexAtTimeEstimate(estChunk, 3, 8) === 1, 'estimate index @3s → s1');
ok(sentenceIndexAtTimeEstimate(estChunk, 7.5, 8) === 2, 'estimate index @7.5s → s2');
ok(sentenceIndexAtTimeEstimate(estChunk, 0, NaN) === 0, 'estimate tolerates unknown duration');

// --- voice tiers ---
ok(voiceQualityOf('ja-JP-Chirp3-HD-Charon') === 'chirp3', 'chirp voice detected as chirp3 tier');
ok(pickVoice('chirp3', 'male') === 'ja-JP-Chirp3-HD-Charon', 'pickVoice chirp3 keeps gender');
ok(pickVoice('chirp3', 'female') === 'ja-JP-Chirp3-HD-Aoede', 'pickVoice chirp3 female default');

console.log(failures === 0 ? '\nALL CHUNK UNIT CHECKS PASSED ✅' : `\n${failures} FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
