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

// Build an IMAGE-ONLY PDF (no text layer): screenshot a text page, embed the
// PNG in a fresh page, print that to PDF.
const pdfPath = `${SHOT}/scan-book.pdf`;
{
  const gen = await browser.newPage({ viewport: { width: 800, height: 1100 } });
  await gen.setContent(
    '<div style="writing-mode:vertical-rl;font-size:28px;height:1000px;padding:40px">第一章 習慣の力 小さな習慣が、人生を変える。まずは一歩、踏み出そう。</div>',
  );
  const png = await gen.screenshot({ fullPage: true });
  await gen.setContent(
    `<img style="width:100%" src="data:image/png;base64,${png.toString('base64')}">`,
  );
  await gen.pdf({ path: pdfPath, format: 'A4' });
  await gen.close();
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

// Mock the OCR endpoint with vertical-scan style line fragments.
const ocrBodies = [];
await page.route('**/api/ocr', async (route) => {
  const body = route.request().postDataJSON();
  ocrBodies.push(body);
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      texts: body.images.map(
        () => '第一章 習慣の力\n小さな習慣が、\n人生を変える。\nまずは一歩、\n踏み出そう。',
      ),
      fallback: false,
    }),
  });
});

try {
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  await page.locator('.filepick__input').setInputFiles(pdfPath);

  // Empty text layer → automatic OCR fallback.
  await page.getByTestId('file-preview').waitFor({ timeout: 30000 });
  check(ocrBodies.length >= 1, 'OCR endpoint called for a scanned PDF');
  check(Array.isArray(ocrBodies[0].images) && ocrBodies[0].images.length >= 1, 'request carries page images');
  check(ocrBodies.every((b) => b.images.length <= 4), 'batches respect the 4-page limit');
  check(
    ocrBodies[0].images[0].length > 5000 && !ocrBodies[0].images[0].startsWith('data:'),
    'images are raw base64 JPEGs (no data: prefix)',
  );

  const preview = await page.getByTestId('file-preview').textContent();
  check(
    preview?.includes('小さな習慣が、人生を変える。'),
    'column fragments reassembled into sentences',
    preview?.slice(0, 120),
  );

  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 15000 });
  check(await page.getByText('小さな習慣が、人生を変える。').first().isVisible(), 'reader shows OCR sentence');
  check(
    await page.locator('.reader__heading', { hasText: '第一章 習慣の力' }).first().isVisible(),
    'OCR heading recognized as a chapter',
  );

  console.log(failures === 0 ? '\nALL OCR E2E CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/ocr-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
