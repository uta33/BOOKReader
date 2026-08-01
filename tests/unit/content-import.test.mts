import assert from 'node:assert/strict';
import {
  chunkImportedText,
  detectImportFileKind,
  markdownToReadableText,
  storedExtensionFor,
  titleFromImportFilename,
} from '../../src/services/contentImport.ts';

assert.equal(detectImportFileKind('book.PDF'), 'pdf');
assert.equal(detectImportFileKind('notes.txt'), 'txt');
assert.equal(detectImportFileKind('読書ノート.md'), 'markdown');
assert.equal(detectImportFileKind('long.markdown'), 'markdown');
assert.equal(detectImportFileKind('image.png'), null);
console.log('✅ PDF／TXT／Markdownの拡張子を判定する');

assert.equal(storedExtensionFor('markdown'), '.md');
assert.equal(titleFromImportFilename('読書ノート.markdown'), '読書ノート');
console.log('✅ Markdownを.mdとして保存し、題名から拡張子を除く');

const markdown = `---
title: 内部タイトル
private: true
---
# 第一章

これは **大切な文章** と [参考資料](https://example.com) です。

- [x] 読み終えた項目
- [[本のページ|表示名]]
- ![図の説明](diagram.png)
- ![[chart.png|720]]

| 項目 | 内容 |
| --- | --- |
| A | B |

\`インラインコード\` は本文として残します。

\`\`\`ts
const secret = '読み上げない';
\`\`\`
`;

const readable = markdownToReadableText(markdown);
assert.match(readable, /第一章/);
assert.match(readable, /大切な文章/);
assert.match(readable, /参考資料/);
assert.match(readable, /読み終えた項目/);
assert.match(readable, /表示名/);
assert.match(readable, /図の説明/);
assert.match(readable, /項目、内容/);
assert.match(readable, /インラインコード/);
assert.doesNotMatch(readable, /private: true/);
assert.doesNotMatch(readable, /https:\/\/example\.com/);
assert.doesNotMatch(readable, /chart\.png/);
assert.doesNotMatch(readable, /const secret/);
assert.doesNotMatch(readable, /\*\*|```|\[x\]/);
console.log('✅ Markdown記号・URL・コードを除き、読める本文を保つ');

const pages = chunkImportedText('a'.repeat(1601));
assert.deepEqual(
  pages.map((page) => page.text.length),
  [800, 800, 1],
);
assert.deepEqual(
  pages.map((page) => page.page),
  [1, 2, 3],
);
console.log('✅ 長いMarkdown本文を既存の800文字単位へ分割する');

console.log('content-import.test.mts: passed');
