import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

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

// Produce a REAL text-embedded PDF (Japanese included) via Chromium's
// print-to-PDF, so the PDF.js extraction path is exercised end to end.
const pdfPath = `${SHOT}/pdf-book.pdf`;
{
  const gen = await browser.newPage();
  await gen.setContent(`
    <h1>第1章 継続の技術</h1>
    <p>継続は小さな仕組みから生まれます。意志力に頼らないことが大切です。</p>
    <h1>第2章 記録の力</h1>
    <p>記録は行動を変えます。毎日の見える化が習慣を支えます。</p>
  `);
  await gen.pdf({ path: pdfPath, format: 'A4' });
  await gen.close();
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

try {
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  check(
    (await page.locator('.filepick__input').getAttribute('accept'))?.includes('.pdf'),
    'file picker accepts .pdf',
  );

  await page.locator('.filepick__input').setInputFiles(pdfPath);
  // PDF.js lazy-loads and extracts; wait for the preview to appear.
  await page.getByTestId('file-preview').waitFor({ timeout: 20000 });
  const preview = await page.getByTestId('file-preview').textContent();
  check(preview?.includes('継続は小さな仕組みから生まれます'), 'extracted Japanese text in preview', preview?.slice(0, 120));

  const title = await page.locator('input').first().inputValue();
  check(title === 'pdf-book', `title auto-filled from filename (got ${title})`);

  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 15000 });
  check(await page.getByText('継続は小さな仕組みから生まれます。').isVisible(), 'reader shows extracted sentence');
  check(await page.getByText('記録は行動を変えます。').isVisible(), 'second page text present');

  console.log(failures === 0 ? '\nALL PDF IMPORT E2E CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/pdf-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
