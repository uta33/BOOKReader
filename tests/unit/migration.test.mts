// 旧形式の蔵書データが黙って壊れないことを固定する。
// このテストが守っているのは、ユーザーのデータを失う唯一の経路。
const { normalizeBook, migrateLibrary } = await import(
  '../../src/services/libraryMigration.js'
);

let failures = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}`, extra ?? '');
    failures++;
  }
};

// ── 旧形式のフィクスチャ（kind / dogEars / links / purposes がまだ無い） ──
const legacy = [
  {
    id: 'book_1700000000000',
    title: '思考の整理学',
    uri: 'file:///books/book_1700000000000.pdf',
    totalPages: 223,
    sentences: [
      { id: 's1', text: '第一章', pageNumber: 1 },
      { id: 's2', text: 'グライダー人間。', pageNumber: 12 },
    ],
    lastSentenceIdx: 1,
    cachedSentenceIds: ['s1'],
    createdAt: 1700000000000,
  },
];

const migrated = migrateLibrary(JSON.stringify(legacy));

ok(migrated.length === 1, '旧レコードが1件そのまま残る');
ok(migrated[0].kind === 'content', 'kind の無い旧レコードは content に倒れる', migrated[0].kind);
ok(migrated[0].sentences.length === 2, 'sentences が保持される');
ok(migrated[0].lastSentenceIdx === 1, 'lastSentenceIdx が保持される');
ok(migrated[0].cachedSentenceIds.length === 1, 'cachedSentenceIds が保持される');
ok(migrated[0].totalPages === 223, 'totalPages が保持される');
ok(Array.isArray(migrated[0].dogEars) && migrated[0].dogEars.length === 0, 'dogEars が空配列で埋まる');
ok(Array.isArray(migrated[0].links) && migrated[0].links.length === 0, 'links が空配列で埋まる');
ok(Array.isArray(migrated[0].purposes) && migrated[0].purposes.length === 0, 'purposes が空配列で埋まる');

// ── 冪等性: 正規化済みをもう一度通しても変わらない ──
const twice = normalizeBook(migrated[0]);
ok(
  JSON.stringify(twice) === JSON.stringify(migrated[0]),
  'normalizeBook は冪等',
  { once: migrated[0], twice },
);

// ── 壊れた入力 ──
ok(migrateLibrary(null).length === 0, 'null は空配列');
ok(migrateLibrary('').length === 0, '空文字は空配列');
ok(migrateLibrary('{ぐちゃ').length === 0, '壊れたJSONは空配列（例外を投げない）');
ok(migrateLibrary('{"books":[]}').length === 0, '配列でないJSONは空配列');
ok(migrateLibrary('[null, 3, "x"]').length === 0, '非オブジェクト要素は落とす');
ok(
  migrateLibrary(JSON.stringify([{ id: 'a' }, { title: 'b' }])).length === 0,
  'id か title を欠くレコードは落とす',
);

// ── 新形式のフィールドが往復する ──
const modern = normalizeBook({
  id: 'paper_1',
  title: '夜と霧',
  kind: 'paper',
  uri: '',
  totalPages: 169,
  sentences: [],
  lastSentenceIdx: 0,
  cachedSentenceIds: [],
  createdAt: 1,
  isbn: '9784622006015',
  author: 'V.E.フランクル',
  purposes: ['thinking', 'nonexistent-purpose', 'newself'],
  dogEars: [
    { id: 'd1', page: 12, line: 6, quote: '引用', comment: 'メモ', createdAt: 2 },
    { id: 'd2', page: 5, quote: '', createdAt: 3 }, // 引用が空 → 落ちる
    'ごみ',
  ],
  links: [
    { id: 'l1', label: 'NotebookLM', url: 'https://example.com/n', kind: 'notebooklm', createdAt: 4 },
    { id: 'l2', label: 'URLなし', createdAt: 5 }, // url が無い → 落ちる
    { id: 'l3', url: 'https://example.com/x', kind: 'でたらめ', createdAt: 6 },
  ],
  finishedAt: 1700000000001,
});

ok(modern !== null, '紙の本レコードが通る');
ok(modern?.kind === 'paper', 'kind: paper は明示されたときだけ保たれる');
ok(modern?.isbn === '9784622006015', 'isbn が保持される');
ok(
  modern?.purposes.length === 2 && !modern.purposes.includes('nonexistent-purpose' as never),
  '未知の purpose id は捨てられる',
  modern?.purposes,
);
ok(modern?.dogEars.length === 1, '引用の無いドッグイヤーと非オブジェクトは落ちる', modern?.dogEars);
ok(modern?.dogEars[0].line === 6, 'L（行）が保持される');
ok(modern?.links.length === 2, 'url の無いリンクは落ちる', modern?.links);
ok(modern?.links[1].kind === 'other', '未知の LinkKind は other に倒れる');
ok(modern?.links[1].label === 'https://example.com/x', 'label 未指定なら url を使う');
ok(modern?.finishedAt === 1700000000001, 'finishedAt が保持される');

// ── 数値の異常値 ──
const weird = normalizeBook({
  id: 'x', title: 'y',
  totalPages: -5, lastSentenceIdx: NaN, createdAt: 'いつか',
  dogEars: [{ id: 'd', page: -3.7, quote: 'q' }],
});
ok(weird?.totalPages === 0, '負のページ数は 0 にクランプ', weird?.totalPages);
ok(weird?.lastSentenceIdx === 0, 'NaN の lastSentenceIdx は 0');
ok(weird?.createdAt === 0, '数値でない createdAt は 0');
ok(weird?.dogEars[0].page === 0, '負のページは 0 にクランプ', weird?.dogEars[0].page);

console.log(failures === 0 ? '\n全て通過' : `\n${failures}件 失敗`);
process.exit(failures === 0 ? 0 : 1);
