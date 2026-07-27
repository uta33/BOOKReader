/**
 * 100冊ゲームの集計。すべて蔵書配列の純関数で、保存する状態はない。
 *
 * このファイルは `react-native` / `expo-*` を **import しない**（`tsx` で直接テストするため）。
 */
import { PURPOSES, type PurposeId } from '../constants/purposes';
import { BOOKS_PER_VOLUME } from '../constants/readingNote';
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
