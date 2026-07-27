// 100冊ゲームの集計。境界（48冊でノートが繰り上がる）と月またぎを固定する。
const {
  notePosition,
  finishedBooks,
  finishedSeq,
  finishedThisMonth,
  purposeProgress,
} = await import('../../src/services/readingProgress.js');

let failures = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}`, extra ?? '');
    failures++;
  }
};

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── ノートの冊目とページ（48冊で1冊分） ──
ok(eq(notePosition(0), { volume: 1, page: 1 }), '0冊目 → 1冊目の1ページ');
ok(eq(notePosition(47), { volume: 1, page: 48 }), '47 → 1冊目の48ページ');
ok(eq(notePosition(48), { volume: 2, page: 1 }), '48 → 2冊目の1ページ（繰り上がり）');
ok(eq(notePosition(95), { volume: 2, page: 48 }), '95 → 2冊目の48ページ');
ok(eq(notePosition(96), { volume: 3, page: 1 }), '96 → 3冊目の1ページ');
ok(eq(notePosition(-5), { volume: 1, page: 1 }), '負の値は 1冊目1ページに丸める');

// ── 読了順 ──
const book = (id: string, finishedAt?: number, purposes: string[] = []) =>
  ({ id, title: id, purposes, finishedAt }) as never;

const shelf = [
  book('c', 300, ['thinking']),
  book('a', 100, ['thinking', 'practice']),
  book('unread', undefined, ['thinking']),
  book('b', 200, ['practice', 'practice']),
];

ok(
  eq(finishedBooks(shelf).map((b) => b.id), ['a', 'b', 'c']),
  'finishedBooks は finishedAt 昇順で未読了を除く',
  finishedBooks(shelf).map((b) => b.id),
);
ok(finishedSeq(shelf, 'b') === 1, 'finishedSeq は 0 始まりの通し番号');
ok(finishedSeq(shelf, 'unread') === null, '未読了の finishedSeq は null');
ok(finishedSeq(shelf, 'いない') === null, '存在しない id は null');

// ── 目的別（未読了は数えない・同一本の重複は1回） ──
const pp = purposeProgress(shelf);
ok(pp.thinking === 2, '読了済みの thinking は2冊（未読了は数えない）', pp.thinking);
ok(pp.practice === 2, 'practice は2冊', pp.practice);
ok(pp.newself === 0, '該当なしの目的も 0 でキーが存在する');
ok(Object.keys(pp).length === 10, '10の目的すべてのキーを含む', Object.keys(pp).length);

const dup = purposeProgress([book('d', 1, ['thinking', 'thinking'])]);
ok(dup.thinking === 1, '同一本が同じ目的を重複して持っても1回だけ数える', dup.thinking);

// ── 月またぎ（時計は読まず now を注入） ──
const mar31 = new Date(2026, 2, 31, 23, 0).getTime();
const apr1 = new Date(2026, 3, 1, 1, 0).getTime();
const apr20 = new Date(2026, 3, 20, 12, 0).getTime();
const monthly = [book('m1', mar31), book('m2', apr1), book('m3', apr20)];

ok(finishedThisMonth(monthly, new Date(2026, 3, 25)) === 2, '4月は2冊');
ok(finishedThisMonth(monthly, new Date(2026, 2, 25)) === 1, '3月は1冊');
ok(finishedThisMonth(monthly, new Date(2026, 4, 25)) === 0, '5月は0冊');
ok(
  finishedThisMonth(monthly, new Date(2025, 3, 25)) === 0,
  '同じ月でも年が違えば数えない',
);

console.log(failures === 0 ? '\n全て通過' : `\n${failures}件 失敗`);
process.exit(failures === 0 ? 0 : 1);
