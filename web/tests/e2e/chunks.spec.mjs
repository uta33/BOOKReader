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

const ttsBodies = [];
await page.route('**/api/tts', async (route) => {
  ttsBodies.push(route.request().postDataJSON());
  await route.continue();
});

try {
  const md = `${SHOT}/chunk-book.md`;
  writeFileSync(
    md,
    ['# 第1章 集中', '一文目です。二文目です。三文目です。', '# 第2章 継続', '四文目です。五文目です。'].join('\n'),
  );
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  await page.locator('.filepick__input').setInputFiles(md);
  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 10000 });
  await page.getByText('一文目です。').waitFor();
  await page.waitForTimeout(600); // prefetch fires

  // Client now requests CHUNKS (parts array), not per-sentence text.
  check(ttsBodies.length > 0, `TTS requested on reader open (prefetch, ${ttsBodies.length} req)`);
  const body = ttsBodies[0];
  check(Array.isArray(body?.parts) && body.parts.length >= 2, 'request is chunk-mode: parts[] with multiple sentences', body);
  check(body?.parts?.every((p) => p.id && p.text), 'each part has sentence id + text');
  check(body?.text === undefined, 'no legacy per-sentence text field');
  check(body?.speakingRate === undefined, 'no speakingRate sent for chunks (client playbackRate)');

  // Chapter chunking: first request should be 第1章 chunk (heading + 3 sentences).
  check(body?.parts?.[0]?.text?.includes('第1章'), 'first chunk starts at the chapter heading');
  check(!body?.parts?.some((p) => p.text.includes('第2章')), 'chapter 2 is in a separate chunk');

  // Playback still works end-to-end on the fallback path (no TTS key locally).
  await page.getByRole('button', { name: '再生', exact: true }).click();
  await page.waitForTimeout(800);
  check(await page.getByRole('button', { name: '一時停止', exact: true }).isVisible(), 'playback starts (fallback mode)');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '一時停止', exact: true }).click();

  // Tap a sentence to jump; cursor updates.
  await page.getByText('四文目です。').click();
  const pos = await page.locator('.player__meta span').first().textContent();
  check(pos?.trim().startsWith('6 /'), `tap-to-jump moves cursor (got "${pos?.trim()}")`);

  // Save-all now lives in the ⋯ options menu.
  await page.getByRole('button', { name: 'オプションメニュー' }).click();
  check(await page.getByRole('menuitem', { name: /音声を保存/ }).isVisible(), 'save-all present in ⋯ menu');

  console.log(failures === 0 ? '\nALL CHUNK E2E CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/chunk-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
