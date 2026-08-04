import assert from 'node:assert/strict';
import { privacyPage } from '../src/account.ts';

const response = privacyPage();
const html = await response.text();

assert.equal(response.status, 200);
assert.match(html, /2026年8月4日/);
assert.match(html, /ドッグイヤーの音声入力/);
assert.match(html, /録音を保存しません/);
assert.match(html, /端末が選択している音声認識サービス/);
assert.match(html, /「保存する」を押した場合だけ/);

console.log('privacy.test.mts: passed');
