import { sanitizeForSpeech } from '../../server/lib/tts.js';
import { buildSentences } from '../../src/services/sentenceSplitter.js';

let failures = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}\n   got:  ${g}\n   want: ${w}`);
    failures++;
  }
};

// --- sanitizeForSpeech (server, protects already-imported books) ---
eq(sanitizeForSpeech('（間）それでは始めます。'), 'それでは始めます。', 'strips （間）');
eq(sanitizeForSpeech('ナレーション: 本日のテーマです。'), '本日のテーマです。', 'strips speaker label');
eq(sanitizeForSpeech('[00:15] 第一のポイントは集中です。'), '第一のポイントは集中です。', 'strips timestamp');
eq(sanitizeForSpeech('**重要** #まとめ です。'), '重要 まとめ です。', 'strips markdown symbols');
eq(sanitizeForSpeech('通常の文はそのままです。'), '通常の文はそのままです。', 'plain text untouched');
eq(sanitizeForSpeech('会議は10時30分からです。'), '会議は10時30分からです。', 'clock-style Japanese times survive');

// --- buildSentences (client, directives never enter the book) ---
const script = [
  '# 第1章 集中する技術',
  '【BGM】',
  '(00:12)',
  '※この部分は編集でカットしてください',
  'ナレーター： 集中とは何でしょうか。（間）それは選択の技術です。',
  'BGM: アップテンポな曲に切り替え',
  '[01:23] 話者1: たとえば朝の30分を確保します。',
  '（効果音：ページをめくる音）',
  '【第2章 継続する仕組み】',
  '継続には仕組みが必要です。',
].join('\n');

const sentences = buildSentences(script);
const texts = sentences.map((s) => s.text);
eq(
  texts,
  [
    '第1章 集中する技術',
    '集中とは何でしょうか。',
    'それは選択の技術です。',
    'たとえば朝の30分を確保します。',
    '第2章 継続する仕組み',
    '継続には仕組みが必要です。',
  ],
  'transcript directives are skipped; speech content kept',
);
eq(
  sentences.filter((s) => s.isHeading).map((s) => s.text),
  ['第1章 集中する技術', '第2章 継続する仕組み'],
  '【…】heading recognized, production 【BGM】 dropped',
);
eq(new Set(sentences.map((s) => s.section)).size, 2, 'two sections detected');

console.log(failures === 0 ? '\nALL SMOOTHNESS UNIT CHECKS PASSED ✅' : `\n${failures} FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
