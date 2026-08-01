import {
  buildObsidianExport,
  buildObsidianNote,
  sanitizeNoteName,
} from '../../src/services/obsidianExport.js';
import type { Book } from '../../src/types/book.js';

let failures = 0;
const ok = (condition: boolean, message: string, extra?: unknown) => {
  if (condition) console.log(`✅ ${message}`);
  else {
    console.error(`❌ ${message}`, extra ?? '');
    failures++;
  }
};

const now = new Date('2026-08-01T04:00:00.000Z');
const book: Book = {
  id: 'paper_1',
  title: 'エッセンシャル思考: 最少の時間で成果を最大にする',
  kind: 'paper',
  uri: '',
  totalPages: 320,
  sentences: [],
  lastSentenceIdx: 0,
  cachedSentenceIds: [],
  createdAt: Date.UTC(2026, 6, 20),
  dogEars: [
    {
      id: 'd1',
      page: 42,
      line: 3,
      quote: '本当に重要なことだけを選ぶ。\nそれ以外は断る。',
      comment: '明日の予定を一つ減らす。',
      createdAt: Date.UTC(2026, 6, 21),
    },
    {
      id: 'd-deleted',
      page: 99,
      quote: '削除済みの引用',
      createdAt: Date.UTC(2026, 6, 21),
      deletedAt: Date.UTC(2026, 6, 22),
    },
  ],
  links: [
    {
      id: 'l1',
      label: '資料 [PDF]',
      url: 'https://example.com/note',
      kind: 'other',
      createdAt: Date.UTC(2026, 6, 21),
    },
  ],
  purposes: ['record', 'practice'],
  isbn: '9784480020475',
  author: 'グレッグ・マキューン',
  publisher: 'かんき出版',
  pubdate: '2014-11',
  coverUrl: 'https://example.com/cover.jpg',
  bookstore: '町の書店',
  summary: 'より少なく、しかしより良くを選ぶ本。',
  recap: '予定を詰め込まず、選ぶ基準を先に決める。',
  rating: 4,
  finishedAt: Date.UTC(2026, 6, 31),
};

const note = buildObsidianNote(book, now);
ok(
  note.name === 'エッセンシャル思考 最少の時間で成果を最大にする',
  `ファイル名の禁止文字を除く（${note.name}）`,
);
ok(note.content.includes('source: READING NOTE'), 'READING NOTE由来のfrontmatterを入れる');
ok(note.content.includes('exported: 2026-08-01T04:00:00.000Z'), '書き出し日時を入れる');
ok(note.content.includes('isbn: "9784480020475"'), 'ISBNをfrontmatterへ入れる');
ok(note.content.includes('- 評価: ★★★★☆'), '星評価を出力する');
ok(note.content.includes('- 読書を記録する'), '読む目的を人間向けラベルで出力する');
ok(note.content.includes('### P. 42 / L. 3'), 'ドッグイヤーのページと行を出力する');
ok(note.content.includes('> 本当に重要なことだけを選ぶ。\n> それ以外は断る。'), '複数行引用をquote blockにする');
ok(!note.content.includes('削除済みの引用'), '論理削除済みのドッグイヤーを出さない');
ok(note.content.includes('## まとめ\n\nより少なく、しかしより良くを選ぶ本。'), 'まとめを出力する');
ok(note.content.includes('## ふりかえり（自分の言葉）'), 'ふりかえりを出力する');
ok(note.content.includes('[資料 \\[PDF\\]](https://example.com/note)'), 'リンクラベルをエスケープする');
ok(note.content.includes('[画像を開く](https://example.com/cover.jpg)'), '表紙リンクを出力する');

const shortExport = buildObsidianExport(book, 'My Vault', { overwrite: true, now });
const shortUrl = new URL(shortExport.uri);
ok(shortUrl.protocol === 'obsidian:', 'obsidianスキームを使う');
ok(
  shortUrl.searchParams.get('file') === `READING NOTE/${note.name}`,
  'READING NOTEフォルダへ作成する',
);
ok(shortUrl.searchParams.get('vault') === 'My Vault', '任意のVault名を渡す');
ok(shortUrl.searchParams.get('overwrite') === 'true', '確認後の同名ノート更新を指定する');
ok(!shortExport.viaClipboard, '短いノートはURI本文で渡す');
ok(shortUrl.searchParams.get('content') === shortExport.content, 'URI本文がMarkdownと一致する');

const noVault = buildObsidianExport(book, undefined, { now });
ok(!noVault.uri.includes('vault='), 'Vault未指定なら最後に開いたVaultへ倒す');
ok(!noVault.uri.includes('overwrite='), '明示しなければ上書きしない');

const longBook: Book = { ...book, summary: '長い要約です。'.repeat(3_000) };
const longExport = buildObsidianExport(longBook, 'My Vault', { overwrite: true, now });
ok(longExport.viaClipboard, '長いノートはクリップボード方式へ切り替える');
ok(longExport.uri.includes('clipboard=true'), '長文URIにclipboard指定を入れる');
ok(!longExport.uri.includes('content='), '長文URIへ本文を埋め込まない');
ok(longExport.content.includes('長い要約です。'), 'クリップボード用本文を保持する');

const defensiveNote = buildObsidianNote(
  { ...book, rating: 99, createdAt: Number.MAX_VALUE },
  now,
);
ok(defensiveNote.content.includes('- 評価: ★★★★★'), '壊れた星評価を5へ丸める');
ok(defensiveNote.content.includes('created: 2026-08-01'), '壊れた作成日時を出力日時へ倒す');

ok(sanitizeNoteName('a/b\\c:d*e?"f<g>h|i#j[k]^') === 'a b c d e f g h i j k', '禁止文字を除く');
ok(sanitizeNoteName('   ') === 'READING NOTE ノート', '空題名へ既定名を付ける');

console.log(failures === 0 ? '\n全て通過' : `\n${failures}件 失敗`);
process.exit(failures === 0 ? 0 : 1);
