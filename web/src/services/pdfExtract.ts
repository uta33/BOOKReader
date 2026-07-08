import type { PDFPageProxy } from 'pdfjs-dist';
import { ocrPages } from './api';

/**
 * PDF text extraction, two passes:
 * 1. The embedded text layer via PDF.js (born-digital PDFs, incl. 縦書き —
 *    the content-stream order is the logical reading order).
 * 2. When the text layer is (almost) empty — a scanned book — each page is
 *    rendered to a JPEG in the browser and sent to the server-side OCR
 *    (Cloud Vision, strong at vertical Japanese).
 * PDF.js is lazy-loaded so its ~1MB bundle is fetched only when a PDF is
 * actually picked.
 */

export interface ExtractProgress {
  phase: 'text' | 'ocr';
  page: number;
  total: number;
}

/** Below this many characters per page on average, treat as a scanned PDF. */
const MIN_CHARS_PER_PAGE = 20;

/** OCR page cap — keeps time/cost sane for one import. */
const MAX_OCR_PAGES = 200;

/** Target render height for OCR input (px). */
const OCR_TARGET_HEIGHT = 1600;

/** Pages per OCR request (mirrors the server's batch limit). */
const OCR_BATCH = 4;

const LINE_END_RE = /[。．！？!?…」』]$/;
const HEADING_LINE_RE =
  /^(第[0-9０-９一二三四五六七八九十百]+[章話部節]|はじめに|おわりに|序章|終章|まとめ|目次)/;

/**
 * Reassemble OCR line fragments into sentences. Vertical book scans come
 * back as short column-lines; join lines that don't end a sentence, keep
 * chapter-heading lines on their own line so the reader detects sections.
 */
export function assembleOcrText(pageTexts: string[]): string {
  const out: string[] = [];
  // The buffer survives page boundaries — book sentences routinely continue
  // onto the next page.
  let buf = '';
  for (const pageText of pageTexts) {
    for (const raw of pageText.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (HEADING_LINE_RE.test(line) && line.length <= 30) {
        if (buf) out.push(buf);
        buf = '';
        out.push(line);
        continue;
      }
      buf += line;
      if (LINE_END_RE.test(line)) {
        out.push(buf);
        buf = '';
      }
    }
  }
  if (buf) out.push(buf);
  return out.join('\n');
}

export async function extractPdfText(
  file: File,
  onProgress?: (info: ExtractProgress) => void,
): Promise<string> {
  // The legacy build ships its own polyfills (main thread AND worker) —
  // the modern build needs bleeding-edge APIs (Map.getOrInsertComputed etc.)
  // that mobile Safari and slightly older Chromium don't have yet.
  const [pdfjs, workerUrl] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url').then((m) => m.default),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await loadingTask.promise;
  try {
    // Pass 1: embedded text layer.
    let out = '';
    let totalChars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress?.({ phase: 'text', page: p, total: doc.numPages });
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let pageText = '';
      for (const item of content.items) {
        if ('str' in item) {
          pageText += item.str;
          if (item.hasEOL) pageText += '\n';
        }
      }
      page.cleanup();
      totalChars += pageText.replace(/\s/g, '').length;
      out += `${pageText}\n\n`;
    }
    if (totalChars >= doc.numPages * MIN_CHARS_PER_PAGE) {
      return out.replace(/\0/g, '').trim();
    }

    // Pass 2: scanned pages → render to JPEG → server-side OCR.
    if (doc.numPages > MAX_OCR_PAGES) {
      throw new Error(
        `スキャンPDFの文字認識は${MAX_OCR_PAGES}ページまでです（このPDFは${doc.numPages}ページ）。分割してお試しください。`,
      );
    }
    const pageTexts: string[] = [];
    for (let start = 1; start <= doc.numPages; start += OCR_BATCH) {
      const end = Math.min(doc.numPages, start + OCR_BATCH - 1);
      const images: string[] = [];
      for (let p = start; p <= end; p++) {
        onProgress?.({ phase: 'ocr', page: p, total: doc.numPages });
        images.push(await renderPageToJpeg(await doc.getPage(p)));
      }
      pageTexts.push(...(await ocrPages(images)));
    }
    const text = assembleOcrText(pageTexts).replace(/\0/g, '').trim();
    if (!text) {
      throw new Error('このPDFからテキストを認識できませんでした。');
    }
    return text;
  } finally {
    void loadingTask.destroy();
  }
}

/** Rasterize one page for OCR; returns raw base64 (no data: prefix). */
async function renderPageToJpeg(page: PDFPageProxy): Promise<string> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, Math.max(1, OCR_TARGET_HEIGHT / base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas is unavailable');
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  page.cleanup();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  canvas.width = 0; // release the bitmap eagerly (mobile memory)
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}
