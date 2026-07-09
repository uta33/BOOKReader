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
  // 6 image-only pages → two OCR batches (4 + 2).
  const img = `<img style="width:100%;page-break-after:always" src="data:image/png;base64,${png.toString('base64')}">`;
  await gen.setContent(img.repeat(6));
  await gen.pdf({ path: pdfPath, format: 'A4' });
  await gen.close();
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

// Mock the OCR endpoint with vertical-scan style line fragments. The very
// first request fails with 500 to prove the per-batch retry recovers.
const ocrBodies = [];
let ocrPage = 0;
let failedOnce = false;
await page.route('**/api/ocr', async (route) => {
  const body = route.request().postDataJSON();
  ocrBodies.push(body);
  if (!failedOnce) {
    failedOnce = true;
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'transient' }) });
    return;
  }
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      texts: body.images.map(() => {
        ocrPage++;
        return ocrPage === 1
          ? '第一章 習慣の力\n小さな習慣が、\n人生を変える。'
          : `ページ${ocrPage}の、\n内容です。`;
      }),
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
  check(ocrBodies.length === 3, `failed batch + retry + second batch = 3 requests (got ${ocrBodies.length})`);
  check(
    ocrBodies.map((b) => b.images.length).join(',') === '4,4,2',
    'six pages split into 4+2 batches (first batch retried)',
    ocrBodies.map((b) => b.images.length),
  );
  check(Array.isArray(ocrBodies[0].images) && ocrBodies[0].images.length >= 1, 'request carries page images');
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
  check(
    preview?.includes('ページ2の、内容です。'),
    'later pages present in order after the retried batch',
  );

  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 15000 });
  check(await page.getByText('小さな習慣が、人生を変える。').first().isVisible(), 'reader shows OCR sentence');
  check(
    await page.locator('.reader__heading', { hasText: '第一章 習慣の力' }).first().isVisible(),
    'OCR heading recognized as a chapter',
  );

  // ---- Force-OCR checkbox: text-layer PDF, OCR anyway. ----
  const textPdfPath = `${SHOT}/text-book.pdf`;
  {
    const gen = await browser.newPage();
    await gen.setContent('<p>埋め込みテキストの本文です。壊れている想定。</p>');
    await gen.pdf({ path: textPdfPath, format: 'A4' });
    await gen.close();
  }
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  const callsBefore = ocrBodies.length;

  // Unchecked: text layer wins, no OCR call.
  await page.locator('.filepick__input').setInputFiles(textPdfPath);
  await page.getByTestId('file-preview').waitFor({ timeout: 20000 });
  let preview2 = await page.getByTestId('file-preview').textContent();
  check(ocrBodies.length === callsBefore, 'text-layer PDF: no OCR call by default');
  check(preview2?.includes('埋め込みテキストの本文です'), 'text layer extracted by default');

  // Check the box: the already-selected PDF is re-extracted via OCR.
  await page.getByRole('checkbox').check();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="file-preview"]')?.textContent?.includes('内容です。'),
    undefined,
    { timeout: 20000 },
  );
  preview2 = await page.getByTestId('file-preview').textContent();
  check(ocrBodies.length > callsBefore, 'force-OCR checkbox triggers OCR on the selected PDF');
  check(preview2?.includes('の、内容です。'), 'preview replaced with OCR text', preview2?.slice(0, 80));

  console.log(failures === 0 ? '\nALL OCR E2E CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/ocr-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
