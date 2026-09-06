// 100冊ゲームの集計。境界（48冊でノートが繰り上がる）と月またぎを固定する。
const {
  notePosition,
  finishedBooks,
  finishedSeq,
  finishedThisMonth,
  purposeProgress,
  volumeBooks,
  currentVolume,
  monthlyPace,
  purposeBalance,
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

// ── 棚卸し: ノート1冊（48冊）ぶんの本 ──
// 読了時刻を1msずつずらして通し番号を作る。
const many = Array.from({ length: 100 }, (_, i) => book(`b${i}`, i + 1));

ok(volumeBooks(many, 1).length === 48, '1冊目のノートは48冊');
ok(volumeBooks(many, 1)[0].id === 'b0', '1冊目は先頭から');
ok(volumeBooks(many, 1)[47].id === 'b47', '1冊目は48冊目で終わる');
ok(volumeBooks(many, 2)[0].id === 'b48', '2冊目は49冊目から始まる（境界）');
ok(volumeBooks(many, 3).length === 4, '3冊目は端数の4冊', volumeBooks(many, 3).length);
ok(volumeBooks(many, 9).length === 0, '存在しない冊は空');
ok(volumeBooks(many, 0)[0].id === 'b0', '0以下は1冊目に丸める');
ok(volumeBooks([], 1).length === 0, '蔵書が空でも落ちない');
// 未読了は棚卸しに出さない。
ok(volumeBooks([book('x'), book('y', 5)], 1).map((b) => b.id).join() === 'y', '未読了は含めない');

ok(currentVolume([]) === 1, '0冊でも1冊目');
ok(currentVolume(many.slice(0, 47)) === 1, '47冊なら1冊目');
ok(currentVolume(many.slice(0, 48)) === 2, '48冊で2冊目へ繰り上がる');

// ── 棚卸し: 月ごとのペース ──
const paced = [
  book('p1', new Date(2026, 1, 10).getTime()),
  book('p2', new Date(2026, 3, 2).getTime()),
  book('p3', new Date(2026, 3, 20).getTime()),
];
const pace = monthlyPace(paced, new Date(2026, 3, 25), 3);
ok(eq(pace.map((m) => m.month), ['2026-02', '2026-03', '2026-04']), '古い順に並ぶ', pace);
ok(pace[2].count === 2, '当月は2冊', pace[2].count);
// 読了が無い月も 0 で埋める。歯抜けだとペースが読めない。
ok(pace[1].count === 0, '読了の無い月も0で埋まる');
ok(pace[0].count === 1, '2月は1冊');
ok(monthlyPace([], new Date(2026, 3, 25), 6).length === 6, '蔵書が空でも6ヶ月ぶん返す');
ok(monthlyPace(paced, new Date(2026, 3, 25), 0).length === 1, '0ヶ月指定は1ヶ月に丸める');
// 年をまたいでも月キーが壊れないこと。
ok(
  monthlyPace([], new Date(2026, 0, 15), 3)[0].month === '2025-11',
  '年またぎでも月キーが正しい',
  monthlyPace([], new Date(2026, 0, 15), 3)[0].month,
);

// ── 棚卸し: 目的の偏り ──
const balance = purposeBalance(shelf);
ok(balance.length === 10, '10の目的すべてを返す');
ok(balance[0].count === 0, '冊数の少ない順（手薄な目的が先頭）', balance[0]);
ok(balance[balance.length - 1].count === 2, '多い目的が末尾', balance[balance.length - 1]);
const thinking = balance.find((b) => b.id === 'thinking');
ok(thinking?.count === 2 && thinking?.short === 8, '各目的10冊に対する不足数', thinking);
const full = purposeBalance(Array.from({ length: 12 }, (_, i) => book(`f${i}`, i + 1, ['volume'])));
ok(full.find((b) => b.id === 'volume')?.short === 0, '10冊を超えたら不足は0');

console.log(failures === 0 ? '\n全て通過' : `\n${failures}件 失敗`);
process.exit(failures === 0 ? 0 : 1);
