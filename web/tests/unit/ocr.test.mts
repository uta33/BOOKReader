import { ocrImages, OCR_BATCH_LIMIT } from '../../server/lib/ocr.js';
import { assembleOcrText } from '../../src/services/pdfExtract.js';

let failures = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}`, extra ?? '');
    failures++;
  }
};

// --- ocrImages request shape (fetch mocked) ---
process.env.GOOGLE_TTS_API_KEY = 'tts-key';
let captured: { url: string; body: any } | null = null;
(globalThis as any).fetch = async (url: string, init: any) => {
  captured = { url, body: JSON.parse(init.body) };
  return {
    ok: true,
    json: async () => ({
      responses: [
        { fullTextAnnotation: { text: '一ページ目。' } },
        { fullTextAnnotation: { text: '二ページ目。' } },
      ],
    }),
  } as any;
};

const res = await ocrImages(['QUJD', 'REVG']);
ok(captured !== null && captured.url.includes('vision.googleapis.com/v1/images:annotate'), 'calls Vision annotate');
ok(captured!.url.includes('key=tts-key'), 'falls back to the TTS key when no Vision key');
ok(captured!.body.requests.length === 2, 'one request per image');
ok(
  captured!.body.requests[0].features[0].type === 'DOCUMENT_TEXT_DETECTION',
  'uses DOCUMENT_TEXT_DETECTION (vertical-JP aware)',
);
ok(captured!.body.requests[0].imageContext.languageHints[0] === 'ja', 'language hint ja');
ok(!res.fallback && res.texts.join('|') === '一ページ目。|二ページ目。', 'texts returned per page');

// dedicated Vision key takes precedence
process.env.GOOGLE_VISION_API_KEY = 'vision-key';
await ocrImages(['QUJD']);
ok(captured!.url.includes('key=vision-key'), 'GOOGLE_VISION_API_KEY wins over TTS key');
delete process.env.GOOGLE_VISION_API_KEY;

// no keys → fallback
delete process.env.GOOGLE_TTS_API_KEY;
const fb = await ocrImages(['QUJD']);
ok(fb.fallback === true, 'no key → fallback:true');

// validation
const throws = async (fn: () => Promise<unknown>, msg: string) => {
  try {
    await fn();
    ok(false, msg, 'did not throw');
  } catch {
    ok(true, msg);
  }
};
await throws(() => ocrImages([]), 'empty images rejected');
await throws(
  () => ocrImages(Array(OCR_BATCH_LIMIT + 1).fill('QUJD')),
  'over-batch-limit rejected',
);

// --- assembleOcrText: vertical-scan line reassembly ---
const assembled = assembleOcrText([
  '第一章 習慣の力\n小さな習慣が、\n人生を変える。\nまずは一歩、',
  '踏み出そう。\nそれが全てだ。',
]);
ok(
  assembled ===
    '第一章 習慣の力\n小さな習慣が、人生を変える。\nまずは一歩、踏み出そう。\nそれが全てだ。',
  'column lines joined into sentences; heading kept on its own line',
  assembled,
);
ok(
  assembleOcrText(['「引用で終わる行」\n次の文。']) === '「引用で終わる行」\n次の文。',
  'closing quote counts as a sentence end',
);
ok(assembleOcrText(['', '   ']) === '', 'blank pages produce nothing');

console.log(failures === 0 ? '\nALL OCR UNIT CHECKS PASSED ✅' : `\n${failures} FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
