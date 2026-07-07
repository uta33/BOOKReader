import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const EXEC = process.env.CHROMIUM_PATH;
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const SHOT = new URL('.artifacts/', import.meta.url).pathname;
mkdirSync(SHOT, { recursive: true });

let failures = 0;
const check = (cond, msg, extra) => {
  if (cond) console.log(`✅ ${msg}`);
  else { console.error(`❌ ${msg}`, extra ?? ''); failures++; }
};

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

// Capture custom-scheme launches instead of navigating away.
await page.addInitScript(() => {
  window.__uris = [];
  const orig = window.open.bind(window);
  window.open = (url, target, feat) => {
    if (typeof url === 'string' && url.startsWith('obsidian://')) {
      window.__uris.push(url);
      return window; // truthy → no location.href fallback
    }
    return orig(url, target, feat);
  };
});

try {
  const md = `${SHOT}/obsidian-book.md`;
  writeFileSync(md, '# 第1章 学び\n一文目です。二文目です。\n# まとめ\n三文目です。');
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  await page.locator('.filepick__input').setInputFiles(md);
  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 10000 });
  await page.getByText('一文目です。').waitFor();

  // Export from the ⋯ menu (no vault set → no vault param).
  await page.getByRole('button', { name: 'オプションメニュー' }).click();
  await page.getByRole('menuitem', { name: /Obsidianにノート作成/ }).click();
  let uris = await page.evaluate(() => window.__uris);
  check(uris.length === 1, 'obsidian:// launched from reader menu');
  check(uris[0].startsWith('obsidian://new?file=BOOKReader%2Fobsidian-book'), 'note path = BOOKReader/<title>', uris[0].slice(0, 80));
  check(!uris[0].includes('vault='), 'no vault param when unset');
  const content = decodeURIComponent(uris[0].split('&content=')[1]);
  check(content.includes('## 要約') && content.includes('## 第1章 学び'), 'note contains summary with headings');
  check(content.includes('未記入'), 'recap placeholder when not written yet');

  // Set a vault name in Settings; write a recap; export from the recap alert.
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/最後に開いたVault/).fill('MyVault');
  const bookId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('bookreader_library')).state.books[0].id,
  );
  await page.goto(`${BASE}/recap/${bookId}`, { waitUntil: 'networkidle' });
  await page.locator('textarea').fill('学びは実践してこそ。明日試す。');
  await page.getByRole('button', { name: '保存して復習に登録' }).click();
  await page.getByRole('button', { name: /Obsidianへ/ }).click();
  // __uris resets on navigation (init script re-runs), so read the last entry.
  uris = await page.evaluate(() => window.__uris);
  check(uris.length === 1, 'obsidian:// launched from recap alert');
  const last = uris[uris.length - 1] ?? '';
  check(last.includes('&vault=MyVault'), 'vault param from settings');
  const content2 = decodeURIComponent(last.split('&content=')[1] ?? '');
  check(content2.includes('学びは実践してこそ。明日試す。'), 'freshly saved recap included in the note');

  console.log(failures === 0 ? '\nALL OBSIDIAN E2E CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/obsidian-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
