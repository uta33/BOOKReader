/**
 * JANコード（＝書籍の EAN-13 バーコード）の検証と正規化。
 *
 * 日本の書籍はバーコードが2段ある:
 *   上段 = ISBN-13（978 / 979 始まり）… 書籍の識別子
 *   下段 = 日本図書コード／価格コード（192 始まり）… 分類と価格。識別子ではない
 * 下段を読んでしまうのが最頻出の失敗なので `isBookIsbn` で明示的に弾く。
 *
 * このファイルは `react-native` / `expo-*` を **import しない**（`tsx` で直接テストするため）。
 */

/** 数字だけを残す（ハイフン・空白・全角空白を除去。ISBN-10 の X は別途扱う）。 */
function digitsOnly(s: string): string {
  return s.replace(/[^0-9Xx]/g, '');
}

/** EAN-13 / ISBN-13 のチェックディジット検証。 */
export function isValidIsbn13(s: string): boolean {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(s[12]);
}

/** ISBN-10 のチェックディジット検証（末尾 X を許す）。 */
export function isValidIsbn10(s: string): boolean {
  if (!/^\d{9}[\dXx]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i);
  const last = s[9].toUpperCase();
  sum += last === 'X' ? 10 : Number(last);
  return sum % 11 === 0;
}

/** ISBN-10 → ISBN-13（978 プレフィックスを付けてチェックディジットを振り直す）。 */
export function isbn10To13(s: string): string | null {
  if (!isValidIsbn10(s)) return null;
  const core = `978${s.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/**
 * 書籍の識別子として使える ISBN-13 か。
 *
 * 978/979 で始まりチェックディジットが合うものだけを通す。
 * 下段の価格コード（192…）はここで false になる。
 */
export function isBookIsbn(s: string): boolean {
  return /^97[89]\d{10}$/.test(s) && isValidIsbn13(s);
}

/** 価格コード（下段のバーコード）か。専用の案内を出すために判定する。 */
export function isJapaneseBooklandPriceCode(s: string): boolean {
  return /^192\d{10}$/.test(s);
}

/**
 * 入力（スキャン結果・手入力）を書籍の ISBN-13 に正規化する。
 * 書籍として使えない値は null。
 */
export function normalizeIsbn(raw: string): string | null {
  const cleaned = digitsOnly(raw ?? '');
  if (cleaned.length === 13) {
    return isBookIsbn(cleaned) ? cleaned : null;
  }
  if (cleaned.length === 10) {
    const converted = isbn10To13(cleaned);
    return converted && isBookIsbn(converted) ? converted : null;
  }
  return null;
}

/** 表示用にハイフンを補わず、そのまま返す（区切り位置は出版社記号長に依存し一意に決まらない）。 */
export function formatIsbn(isbn13: string): string {
  return isbn13;
}
