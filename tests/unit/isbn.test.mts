// JANコードの検証。最重要は「下段の価格コード（192…）を書籍として通さない」こと。
const {
  isValidIsbn13,
  isValidIsbn10,
  isbn10To13,
  isBookIsbn,
  isJapaneseBooklandPriceCode,
  normalizeIsbn,
} = await import('../../src/services/isbn.js');

let failures = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}`, extra ?? '');
    failures++;
  }
};

// チェックディジットが正しい ISBN-13（書誌APIがこの環境から叩けないため、
// 実在の書名との対応は検証していない。ここで固定したいのは形式の判定のみ）。
const SHIKO = '9784480020475';
const YORU = '9784622006015';

// ── チェックディジット ──
ok(isValidIsbn13(SHIKO), '正しい ISBN-13 を通す');
ok(isValidIsbn13(YORU), 'もう一つの正しい ISBN-13 を通す');
ok(!isValidIsbn13('9784480020476'), 'チェックディジットが違えば弾く');
ok(!isValidIsbn13('978448002047'), '12桁は弾く');
ok(!isValidIsbn13('97844800204750'), '14桁は弾く');
ok(!isValidIsbn13('978448002047X'), '非数字を含めば弾く');

// ── 価格コード（下段のバーコード）を書籍として通さない ──
const PRICE = '1920095006809';
ok(isJapaneseBooklandPriceCode(PRICE), '192 始まりを価格コードと判定する');
ok(!isBookIsbn(PRICE), '価格コードは isBookIsbn で false（最重要）');
ok(normalizeIsbn(PRICE) === null, '価格コードは正規化で null になる');
ok(!isJapaneseBooklandPriceCode(SHIKO), '書籍ISBNは価格コードと判定されない');

// ── 978 / 979 だけを書籍として認める ──
ok(isBookIsbn(SHIKO), '978 始まりは書籍');
ok(!isBookIsbn('4901234567890'), '978/979 以外のEAN-13は書籍でない');

// ── ISBN-10 → 13 ──
ok(isValidIsbn10('4480020470'), '正しい ISBN-10 を通す');
ok(!isValidIsbn10('4480020471'), 'チェックディジットが違う ISBN-10 を弾く');
ok(isValidIsbn10('400310109X'), '末尾 X の ISBN-10 を通す');
ok(!isValidIsbn10('400310101X'), 'チェックディジットが X でない番号を X で通さない');
ok(isbn10To13('4480020470') === SHIKO, 'ISBN-10 から ISBN-13 に変換', isbn10To13('4480020470'));
ok(isbn10To13('4480020471') === null, '不正な ISBN-10 は変換しない');

// ── 正規化（ハイフン・空白・大小文字） ──
ok(normalizeIsbn('978-4-480-02047-5') === SHIKO, 'ハイフン入りを正規化', normalizeIsbn('978-4-480-02047-5'));
ok(normalizeIsbn('  9784480020475 ') === SHIKO, '前後の空白を無視');
ok(normalizeIsbn('978 4 480 02047 5') === SHIKO, '途中の空白を無視');
ok(normalizeIsbn('4-480-02047-0') === SHIKO, 'ハイフン入り ISBN-10 も13桁に正規化');
ok(normalizeIsbn('400310109x') === '9784003101094', '小文字 x の ISBN-10 を扱う', normalizeIsbn('400310109x'));

// ── 通らないもの ──
ok(normalizeIsbn('') === null, '空文字は null');
ok(normalizeIsbn('あいうえお') === null, '非数字は null');
ok(normalizeIsbn('12345') === null, '桁数不足は null');
ok(normalizeIsbn('9784480020476') === null, 'チェックディジット不正は null');

console.log(failures === 0 ? '\n全て通過' : `\n${failures}件 失敗`);
process.exit(failures === 0 ? 0 : 1);
