import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

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
page.on('dialog', (d) => d.accept()); // confirm overwrite + restored alert

try {
  // Seed: import a book and write a recap.
  const md = `${SHOT}/backup-book.md`;
  writeFileSync(md, '# 第1章 資産\n一文目です。二文目です。');
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  await page.locator('.filepick__input').setInputFiles(md);
  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 10000 });
  const bookId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('bookreader_library')).state.books[0].id,
  );
  await page.goto(`${BASE}/recap/${bookId}`, { waitUntil: 'networkidle' });
  await page.locator('textarea').fill('積み上げは資産。');
  await page.getByRole('button', { name: '保存して復習に登録' }).click();

  // Export from settings.
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  const dlPromise = page.waitForEvent('download', { timeout: 10000 });
  await page.getByRole('button', { name: 'データを書き出す（JSON）' }).click();
  const dl = await dlPromise;
  check(/^bookreader-backup-\d{8}\.json$/.test(dl.suggestedFilename()), `filename (${dl.suggestedFilename()})`);
  const file = `${SHOT}/exported-backup.json`;
  await dl.saveAs(file);
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  check(backup.app === 'bookreader-backup', 'envelope present');
  check(backup.stores.bookreader_library.state.books.length === 1, 'book included');
  check(
    backup.stores.bookreader_library.state.books[0].recap === '積み上げは資産。',
    'recap included',
  );
  check(backup.stores.bookreader_reviews.state.items.length >= 1, 'review items included');
  check(await page.getByText(/書き出しました（本 1冊/).isVisible(), 'export success message');

  // Wipe everything → app is empty again.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check(await page.getByText('まだ本がありません').isVisible(), 'wiped app shows empty state');

  // Restore from the exported file (confirm dialog auto-accepted; app reloads).
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  const reloaded = page.waitForEvent('load', { timeout: 10000 }); // restore triggers location.reload()
  await page.locator('.backup__file').setInputFiles(file);
  await reloaded;
  await page.waitForTimeout(300);
  await page.goto(`${BASE}/library`, { waitUntil: 'networkidle' });
  check(await page.getByText('backup-book').first().isVisible(), 'book restored after import');
  check(await page.getByText('✅ ふりかえり済').isVisible(), 'recap flag restored');

  console.log(failures === 0 ? '\nALL BACKUP E2E CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/backup-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
