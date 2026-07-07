import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const EXEC = process.env.CHROMIUM_PATH;
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const SHOT = new URL('.artifacts/', import.meta.url).pathname;
mkdirSync(SHOT, { recursive: true });
const log = (...a) => console.log('•', ...a);

let failures = 0;
const check = (cond, msg) => {
  if (cond) log(`✅ ${msg}`);
  else { console.error(`❌ ${msg}`); failures++; }
};

const browser = await chromium.launch({
  ...(EXEC ? { executablePath: EXEC } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLEERR:', m.text()); });

let bgmRequested = false;
page.on('request', (req) => {
  if (req.url().includes('/bgm/focus.mp3')) bgmRequested = true;
});

try {
  // Enable BGM in settings.
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.locator('.field', { hasText: 'バックグラウンド音' }).first()
    .getByRole('button', { name: 'オン' }).click();
  await page.waitForTimeout(400);
  check(!bgmRequested, 'BGM does NOT play just from enabling it (idle, no narration)');

  // Import a book and open the reader.
  const md = `${SHOT}/bgm2.md`;
  writeFileSync(md, 'これは一文目です。これは二文目です。これは三文目です。');
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  await page.locator('.filepick__input').setInputFiles(md);
  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 10000 });
  await page.getByText('これは一文目です。').waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  check(!bgmRequested, 'BGM still silent while sitting in the reader (not playing)');

  // Press play → narration starts → BGM should start.
  await page.getByRole('button', { name: '再生', exact: true }).click();
  await page.waitForTimeout(800);
  check(bgmRequested, 'BGM starts when narration starts (▶ pressed)');

  // Confirm the reader is actually in playing state (pause button shown).
  const pauseVisible = await page.getByRole('button', { name: '一時停止', exact: true }).isVisible();
  check(pauseVisible, 'reader is narrating (pause button visible)');
  await page.screenshot({ path: `${SHOT}/bgm2-playing.png` });

  // Verify global narration flag drives the intended shouldPlay state.
  const narrating = await page.evaluate(() => {
    // playbackStore is not persisted; assert via the pause button existing.
    return !!document.querySelector('button[aria-label="一時停止"]');
  });
  check(narrating, 'narration flag is true during playback');

  console.log(failures === 0 ? '\nALL BGM-GATING CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/bgm2-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
