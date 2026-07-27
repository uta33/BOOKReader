// 生成結果から本文だけを取り出す部分。
const { extractSummaryBody } = await import('../../src/services/summaryParser.js');

let failures = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}`, extra ?? '');
    failures++;
  }
};

// サーバーが実際に吐く形
const full = `タイトル: 思考を整理する技術
第一章 寝かせる

考えたことは、すぐに形にしない方がよいことがあります。

まとめ

一晩置いてから読み返す。

復習クイズ:
Q: 寝かせるとは何か
A: 時間を置くこと
Q: なぜ有効か
A: 熟成するから`;

const a = extractSummaryBody(full);
ok(a.title === '思考を整理する技術', 'タイトル行を取り出す', a.title);
ok(!a.body.includes('タイトル:'), '本文からタイトル行が除かれる');
ok(!a.body.includes('復習クイズ'), '本文からクイズ以降が除かれる');
ok(!a.body.includes('Q:'), 'クイズの設問が残らない');
ok(a.body.startsWith('第一章'), '本文は第一章から始まる', a.body.slice(0, 20));

// 全角コロン
const zen = extractSummaryBody('タイトル：全角のコロン\n本文です。');
ok(zen.title === '全角のコロン', '全角コロンのタイトルも読む', zen.title);

// タイトル行が無い
const noTitle = extractSummaryBody('第一章 いきなり本文\n\n続き。');
ok(noTitle.title === undefined, 'タイトル行が無ければ undefined');
ok(noTitle.body.startsWith('第一章'), 'タイトルが無くても本文はそのまま');

// クイズが無い
const noQuiz = extractSummaryBody('タイトル: クイズなし\n本文だけ。');
ok(noQuiz.body === '本文だけ。', 'クイズマーカーが無くても本文を返す', noQuiz.body);

// 前後の空白
const padded = extractSummaryBody('タイトル:   余白あり  \n\n  本文  \n\n復習クイズ:\nQ: x');
ok(padded.title === '余白あり', 'タイトルの前後空白を落とす', padded.title);
ok(padded.body === '本文', '本文の前後空白を落とす', JSON.stringify(padded.body));

// 空入力
ok(extractSummaryBody('').body === '', '空文字は空の本文');

console.log(failures === 0 ? '\n全て通過' : `\n${failures}件 失敗`);
process.exit(failures === 0 ? 0 : 1);
