/**
 * Client-side PDF text extraction via PDF.js. Runs entirely in the browser
 * (no file upload — consistent with the server-holds-only-API-keys design)
 * and is lazy-loaded, so the ~1MB library is fetched only when the user
 * actually picks a PDF.
 */
export async function extractPdfText(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<string> {
  const [pdfjs, workerUrl] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url').then((m) => m.default),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await loadingTask.promise;
  try {
    let out = '';
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress?.(p, doc.numPages);
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
      out += `${pageText}\n\n`;
    }
    const text = out.replace(/\0/g, '').trim();
    if (!text) {
      throw new Error(
        'このPDFからテキストを抽出できませんでした（画像スキャンのPDFは非対応です）。',
      );
    }
    return text;
  } finally {
    void loadingTask.destroy();
  }
}
