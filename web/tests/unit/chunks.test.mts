import { buildChunks, chunkIndexFor, CHUNK_CHAR_LIMIT } from '../../src/services/chunker.js';
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

console.log(failures === 0 ? '\nALL CHUNK UNIT CHECKS PASSED ✅' : `\n${failures} FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
