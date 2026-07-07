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

// Serve a fake chunk-TTS response so the download path can be tested
// end-to-end (local dev server has no Google key). "MP3" bytes are fake but
// blob assembly/anchor download don't care.
const FAKE_MP3_B64 = Buffer.from('FAKEMP3DATA-CHUNK').toString('base64');

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

let mockTts = false;
await page.route('**/api/tts', async (route) => {
  if (!mockTts) return route.continue();
  const body = route.request().postDataJSON();
  const timepoints = (body.parts ?? []).map((p, i) => ({ markName: p.id, timeSeconds: i * 2 }));
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ audioContent: FAKE_MP3_B64, timepoints, fallback: false }),
  });
});

try {
  const md = `${SHOT}/menu-book.md`;
  writeFileSync(md, '# 第1章 テスト\n一文目です。二文目です。\n# 第2章 続き\n三文目です。');
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  await page.locator('.filepick__input').setInputFiles(md);
  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 10000 });
  await page.getByText('一文目です。').waitFor();

  // Old appbar buttons are gone; ⋯ menu replaces them.
  check(!(await page.getByRole('button', { name: '音声を保存' }).isVisible().catch(() => false)),
    'appbar no longer shows raw 音声を保存 button');
  const menuBtn = page.getByRole('button', { name: 'オプションメニュー' });
  check(await menuBtn.isVisible(), '⋯ menu button present');

  await menuBtn.click();
  check(await page.getByRole('menuitem', { name: /ふりかえりを書く/ }).isVisible(), 'menu: ふりかえり item');
  check(await page.getByRole('menuitem', { name: /音声を保存/ }).isVisible(), 'menu: 保存 item');
  check(await page.getByRole('menuitem', { name: /音声データをダウンロード（MP3）/ }).isVisible(), 'menu: MP3 download item');
  await page.screenshot({ path: `${SHOT}/menu-open.png` });

  // Backdrop click closes the menu.
  await page.locator('.menu-backdrop').click({ position: { x: 10, y: 500 } });
  check(!(await page.getByRole('menuitem', { name: /MP3/ }).isVisible().catch(() => false)), 'backdrop closes menu');

  // Without a TTS key: download surfaces a clear error.
  await menuBtn.click();
  await page.getByRole('menuitem', { name: /音声データをダウンロード/ }).click();
  await page.getByText(/Google TTS）が未設定のためダウンロードできません/).waitFor({ timeout: 5000 });
  check(true, 'no-key download shows a clear error');

  // With (mocked) TTS: download produces a real .mp3 file.
  mockTts = true;
  await page.reload({ waitUntil: 'networkidle' });
  await menuBtn.click();
  const dlPromise = page.waitForEvent('download', { timeout: 10000 });
  await page.getByRole('menuitem', { name: /音声データをダウンロード/ }).click();
  const download = await dlPromise;
  const filename = download.suggestedFilename();
  check(filename === 'menu-book.mp3', `downloads as <title>.mp3 (got ${filename})`);
  const path = `${SHOT}/dl-${Date.now()}.mp3`;
  await download.saveAs(path);
  const { readFileSync } = await import('fs');
  const content = readFileSync(path);
  // 2 chunks (第1章+2文 / 第2章+1文) × 17-byte fake payload, concatenated.
  check(content.length === 'FAKEMP3DATA-CHUNK'.length * 2, `blob concatenates all chunks (${content.length} bytes)`);
  check(content.toString().startsWith('FAKEMP3DATA-CHUNK'), 'chunk bytes decoded from base64 correctly');

  console.log(failures === 0 ? '\nALL MENU/DOWNLOAD E2E CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/menu-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
