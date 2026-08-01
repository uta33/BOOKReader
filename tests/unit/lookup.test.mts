// 書誌APIのレスポンス整形。開発環境からは openBD も NDL も
// ネットワークポリシーで叩けないため、保存したサンプル形で固定する。
const {
  shapeOpenBd,
  shapeNdl,
  openLibraryCoverUrl,
  lookupOpenLibraryCover,
} = await import('../../src/services/bookLookup.js');

let failures = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}`, extra ?? '');
    failures++;
  }
};

// ── openBD ──────────────────────────────────────────
const openbdHit = [
  {
    summary: {
      isbn: '9784480020475',
      title: '思考の整理学',
      volume: '',
      series: 'ちくま文庫',
      publisher: '筑摩書房',
      pubdate: '19860424',
      cover: 'https://cover.openbd.jp/9784480020475.jpg',
      author: '外山滋比古／著',
    },
    onix: {},
  },
];

const a = shapeOpenBd(openbdHit);
ok(a?.title === '思考の整理学', 'openBD: title を取り出す', a?.title);
ok(a?.author === '外山滋比古／著', 'openBD: author を取り出す');
ok(a?.publisher === '筑摩書房', 'openBD: publisher を取り出す');
ok(a?.pubdate === '19860424', 'openBD: pubdate を取り出す');
ok(a?.coverUrl === 'https://cover.openbd.jp/9784480020475.jpg', 'openBD: 書影URLを取り出す');
ok(a?.source === 'openbd', 'openBD: source を openbd にする');

// 未収録は [null] が返る — これが最頻出の「見つからない」形
ok(shapeOpenBd([null]) === null, 'openBD: [null]（未収録）は null');
ok(shapeOpenBd([]) === null, 'openBD: 空配列は null');
ok(shapeOpenBd(null) === null, 'openBD: null は null');
ok(shapeOpenBd({ summary: {} }) === null, 'openBD: 配列でなければ null');
ok(shapeOpenBd([{ onix: {} }]) === null, 'openBD: summary が無ければ null');
ok(shapeOpenBd([{ summary: { title: '   ' } }]) === null, 'openBD: 空白だけの title は null');

const sparse = shapeOpenBd([{ summary: { title: '題名だけ', author: '', cover: '' } }]);
ok(sparse?.title === '題名だけ', 'openBD: title だけでも成立する');
ok(sparse?.author === undefined, 'openBD: 空文字の author は undefined');
ok(sparse?.coverUrl === undefined, 'openBD: 空文字の書影URLは undefined');

// ── NDL（OpenSearch / RSS） ─────────────────────────
const ndlXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:dcterms="http://purl.org/dc/terms/">
  <channel>
    <title>NDL Search</title>
    <item>
      <title>夜と霧 &lt;新版&gt;</title>
      <dc:title>夜と霧 &lt;新版&gt;</dc:title>
      <dc:creator>ヴィクトール・E・フランクル 著</dc:creator>
      <dc:publisher>みすず書房</dc:publisher>
      <dcterms:issued>2002</dcterms:issued>
    </item>
    <item>
      <dc:title>別の本</dc:title>
    </item>
  </channel>
</rss>`;

const n = shapeNdl(ndlXml);
ok(n?.title === '夜と霧 <新版>', 'NDL: dc:title を取り出し実体参照を戻す', n?.title);
ok(n?.author === 'ヴィクトール・E・フランクル 著', 'NDL: dc:creator を取り出す');
ok(n?.publisher === 'みすず書房', 'NDL: dc:publisher を取り出す');
ok(n?.pubdate === '2002', 'NDL: dcterms:issued を取り出す');
ok(n?.source === 'ndl', 'NDL: source を ndl にする');
ok(n?.coverUrl === undefined, 'NDL: 書影は持たない');

const cdata = shapeNdl('<item><dc:title><![CDATA[CDATAの題名]]></dc:title></item>');
ok(cdata?.title === 'CDATAの題名', 'NDL: CDATA を剥がす', cdata?.title);

const titleOnly = shapeNdl('<item><title>タイトル要素のみ</title></item>');
ok(titleOnly?.title === 'タイトル要素のみ', 'NDL: dc:title が無ければ title で代替');

ok(shapeNdl('') === null, 'NDL: 空文字は null');
ok(shapeNdl('<rss><channel><title>結果なし</title></channel></rss>') === null,
  'NDL: item が無ければ null（channel の title を拾わない）');
ok(shapeNdl('<item><dc:creator>著者だけ</dc:creator></item>') === null,
  'NDL: title が無ければ null');

// ── Open Library Covers ────────────────────────────
const expectedCover = 'https://covers.openlibrary.org/b/isbn/9784480020475-M.jpg?default=false';
ok(
  openLibraryCoverUrl('9784480020475') === expectedCover,
  'Open Library: ISBNから書影URLを組み立てる',
);

let requestedMethod: string | undefined;
const foundCover = await lookupOpenLibraryCover(
  '9784480020475',
  undefined,
  async (_input, init) => {
    requestedMethod = init?.method;
    return new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg' },
    });
  },
);
ok(requestedMethod === 'HEAD', 'Open Library: 画像本体を落とさず存在確認する');
ok(foundCover === expectedCover, 'Open Library: 画像レスポンスならURLを返す');

const missingCover = await lookupOpenLibraryCover(
  '9784999999996',
  undefined,
  async () => new Response(null, { status: 404 }),
);
ok(missingCover === undefined, 'Open Library: 未収録404は表紙なしへ倒す');

const htmlInsteadOfImage = await lookupOpenLibraryCover(
  '9784999999996',
  undefined,
  async () => new Response(null, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  }),
);
ok(htmlInsteadOfImage === undefined, 'Open Library: 画像以外のレスポンスを採用しない');

console.log(failures === 0 ? '\n全て通過' : `\n${failures}件 失敗`);
process.exit(failures === 0 ? 0 : 1);
