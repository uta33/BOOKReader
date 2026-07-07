import {
  buildObsidianNote,
  buildObsidianExport,
  sanitizeNoteName,
} from '../../src/services/obsidianExport.js';
import type { Book } from '../../src/types/book.js';

let failures = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}`, extra ?? '');
    failures++;
  }
};

const book: Book = {
  id: 'b1',
  title: 'エッセンシャル思考: 最少の時間で成果を最大にする',
  source: 'ai',
  lastSentenceIdx: 0,
  createdAt: Date.now(),
  sentences: [
    { id: 's0', text: '第1章 選択する', section: 1, isHeading: true },
    { id: 's1', text: '一文目です。', section: 1 },
    { id: 's2', text: '二文目です。', section: 1 },
    { id: 's3', text: 'まとめ。', section: 2, isHeading: true },
    { id: 's4', text: '三文目です。', section: 2 },
  ],
  recap: '大事なのは選ぶこと。明日は朝一で優先順位を決める。',
  quiz: [{ q: '何が大事？', a: '選ぶことです。' }],
};

const note = buildObsidianNote(book);
ok(note.name === 'エッセンシャル思考 最少の時間で成果を最大にする', `note name sanitized (got: ${note.name})`);
ok(note.content.startsWith('---\nsource: BOOKReader\ncreated: 2'), 'frontmatter present');
ok(note.content.includes('## ふりかえり（自分の言葉）\n\n大事なのは選ぶこと。'), 'recap section');
ok(note.content.includes('**Q1. 何が大事？**\n\nA. 選ぶことです。'), 'quiz section');
ok(note.content.includes('## 第1章 選択する\n\n一文目です。二文目です。'), 'summary heading + merged paragraph');
ok(note.content.includes('## まとめ\n\n三文目です。'), '。-stripped heading + section paragraph');

// URI mode with vault name
const exp = buildObsidianExport(book, 'MyVault');
ok(exp.uri.startsWith('obsidian://new?file=BOOKReader%2F'), 'file goes into BOOKReader folder');
ok(exp.uri.includes('&vault=MyVault'), 'vault param included when set');
ok(!exp.viaClipboard && exp.uri.includes('&content='), 'short note travels in the URI');
const decoded = decodeURIComponent(exp.uri.split('&content=')[1]);
ok(decoded === exp.content, 'URI content round-trips exactly');

// no vault → param omitted
const exp2 = buildObsidianExport(book);
ok(!exp2.uri.includes('vault='), 'vault param omitted when unset');

// very long book → clipboard mode
const longBook: Book = {
  ...book,
  sentences: Array.from({ length: 300 }, (_, i) => ({
    id: `s${i}`,
    text: `これは長い本文の${i}番目の文で、URIの長さ制限を確実に超えるための文章です。`,
    section: 1,
  })),
};
const exp3 = buildObsidianExport(longBook, 'MyVault');
ok(exp3.viaClipboard, 'long note switches to clipboard mode');
ok(exp3.uri.endsWith('&clipboard=true') && !exp3.uri.includes('&content='), 'clipboard URI has no content param');
ok(exp3.uri.length < 500, `clipboard URI stays short (${exp3.uri.length})`);
ok(exp3.content.includes('これは長い本文の299番目'), 'full content still available for the clipboard');

// pathological title
ok(sanitizeNoteName('a/b\\c:d*e?"f<g>h|i#j[k]^') === 'a b c d e f g h i j k', 'invalid filename chars stripped');
ok(sanitizeNoteName('   ') === 'BOOKReaderノート', 'blank title falls back');

console.log(failures === 0 ? '\nALL OBSIDIAN UNIT CHECKS PASSED ✅' : `\n${failures} FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
