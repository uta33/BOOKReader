/**
 * 100冊ゲームの集計。すべて蔵書配列の純関数で、保存する状態はない。
 *
 * このファイルは `react-native` / `expo-*` を **import しない**（`tsx` で直接テストするため）。
 */
import { PURPOSES, type PurposeId } from '../constants/purposes';
import { BOOKS_PER_PURPOSE, BOOKS_PER_VOLUME } from '../constants/readingNote';
import type { Book } from '../types/book';

/**
 * 読了の通し番号（0始まり）から、ノートの冊目と見開きページを導く。
 *
 * 保存せず毎回導出するので、読了を取り消しても番号が詰まって自己修復する。
 */
export function notePosition(seq: number): { volume: number; page: number } {
  const n = Math.max(0, Math.trunc(seq));
  return {
    volume: Math.floor(n / BOOKS_PER_VOLUME) + 1,
    page: (n % BOOKS_PER_VOLUME) + 1,
  };
}

/** 読了済みの本を finishedAt の昇順で返す。 */
export function finishedBooks(books: Book[]): Book[] {
  return books
    .filter((b) => typeof b.finishedAt === 'number')
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
}

/** ある本が何冊目の読了かを返す。未読了なら null。 */
export function finishedSeq(books: Book[], bookId: string): number | null {
  const idx = finishedBooks(books).findIndex((b) => b.id === bookId);
  return idx === -1 ? null : idx;
}

/** `now` の属する暦月に読了した冊数。時計は読まず引数で受ける。 */
export function finishedThisMonth(books: Book[], now: Date): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  return books.filter((b) => {
    if (typeof b.finishedAt !== 'number') return false;
    const d = new Date(b.finishedAt);
    return d.getFullYear() === y && d.getMonth() === m;
  }).length;
}

/** 目的ごとの読了冊数。10の目的すべてのキーを必ず含む。 */
export function purposeProgress(books: Book[]): Record<PurposeId, number> {
  const out = {} as Record<PurposeId, number>;
  for (const p of PURPOSES) out[p.id] = 0;
  for (const b of finishedBooks(books)) {
    // 同じ本が同じ目的を重複して持っていても1回だけ数える。
    for (const id of new Set(b.purposes)) out[id] += 1;
  }
  return out;
}

/** ノート1冊（48冊）ぶんの読了本。`volume` は1始まり。 */
export function volumeBooks(books: Book[], volume: number): Book[] {
  const v = Math.max(1, Math.trunc(volume));
  const start = (v - 1) * BOOKS_PER_VOLUME;
  return finishedBooks(books).slice(start, start + BOOKS_PER_VOLUME);
}

/** いま何冊目のノートを使っているか。0冊でも1冊目とする。 */
export function currentVolume(books: Book[]): number {
  return notePosition(finishedBooks(books).length).volume;
}

export interface MonthlyCount {
  /** 'YYYY-MM'。表示用にそのまま使える。 */
  month: string;
  count: number;
}

/**
 * 直近 `months` ヶ月の月別読了数を、古い順に返す。
 * 読了が無い月も 0 で埋める——歯抜けだとペースが読めないため。
 */
export function monthlyPace(books: Book[], now: Date, months = 6): MonthlyCount[] {
  const n = Math.max(1, Math.trunc(months));
  const counts = new Map<string, number>();
  for (const book of finishedBooks(books)) {
    const key = monthKey(new Date(book.finishedAt ?? 0));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: MonthlyCount[] = [];
  for (let back = n - 1; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const month = monthKey(d);
    out.push({ month, count: counts.get(month) ?? 0 });
  }
  return out;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface PurposeBalance {
  id: PurposeId;
  count: number;
  /** 目的あたり10冊に対する不足数。満たしていれば0。 */
  short: number;
}

/**
 * 目的別の過不足。冊数の少ない順に返すので、先頭が「手薄な目的」になる。
 * 10の目的 × 10冊 = 100冊 という設計値に対する偏りを見るためのもの。
 */
export function purposeBalance(books: Book[]): PurposeBalance[] {
  const counts = purposeProgress(books);
  return PURPOSES.map((p) => ({
    id: p.id,
    count: counts[p.id],
    short: Math.max(0, BOOKS_PER_PURPOSE - counts[p.id]),
  })).sort((a, b) => a.count - b.count || PURPOSES.findIndex((p) => p.id === a.id) - PURPOSES.findIndex((p) => p.id === b.id));
}
