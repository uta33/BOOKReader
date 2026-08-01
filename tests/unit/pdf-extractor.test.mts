import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import {
  extractPdfBytes,
  PdfImportError,
  validatePdfBytes,
} from '../../src/services/pdfTextExtractor.ts';

function buildPdf(text?: string): Uint8Array {
  const content = text
    ? Buffer.from(`BT\n/F1 18 Tf\n72 720 Td\n(${text}) Tj\nET\n`, 'ascii')
    : Buffer.alloc(0);
  const compressed = deflateSync(content);
  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'ascii'),
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      'ascii',
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`, 'ascii'),
      compressed,
      Buffer.from('\nendstream', 'ascii'),
    ]),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'ascii'),
  ];

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [0];
  let size = chunks[0].length;
  objects.forEach((body, index) => {
    offsets[index + 1] = size;
    const object = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, 'ascii'),
      body,
      Buffer.from('\nendobj\n', 'ascii'),
    ]);
    chunks.push(object);
    size += object.length;
  });

  const xrefOffset = size;
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');
  chunks.push(Buffer.from(xref, 'ascii'));
  return new Uint8Array(Buffer.concat(chunks));
}

const compressedPdf = buildPdf('Compressed PDF works');
const pages = await extractPdfBytes(compressedPdf);
assert.equal(pages.length, 1);
assert.match(pages[0].text, /Compressed PDF works/);
console.log('✅ 圧縮されたバイナリPDFから本文を抽出できる');

assert.throws(
  () => validatePdfBytes(new TextEncoder().encode('not a pdf')),
  (error: unknown) => error instanceof PdfImportError && error.code === 'invalid',
);
console.log('✅ PDF以外を明確に拒否する');

await assert.rejects(
  () => extractPdfBytes(buildPdf()),
  (error: unknown) => error instanceof PdfImportError && error.code === 'no_text',
);
console.log('✅ 文字層のないPDFを画像PDFとして案内する');

console.log('pdf-extractor.test.mts: passed');
