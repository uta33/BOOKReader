import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import {
  extractPdfBytes,
  extractPdfFromRangeSource,
  LARGE_PDF_THRESHOLD_BYTES,
  MAX_PDF_BYTES,
  PDF_RANGE_CHUNK_BYTES,
  PdfImportError,
  shouldUsePdfRange,
  validatePdfBytes,
  validatePdfSize,
  type PdfRangeSource,
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

class SparseLargePdfSource implements PdfRangeSource {
  readonly size: number;
  readonly reads: { begin: number; end: number }[] = [];
  closed = false;

  private readonly suffixOffset: number;

  constructor(
    private readonly prefix: Uint8Array,
    private readonly suffix: Uint8Array,
    gapBytes: number,
  ) {
    this.suffixOffset = prefix.byteLength + gapBytes;
    this.size = this.suffixOffset + suffix.byteLength;
  }

  read(begin: number, end: number): Uint8Array {
    this.reads.push({ begin, end });
    const result = new Uint8Array(end - begin);
    result.fill(0x20);
    this.copyOverlap(result, begin, end, this.prefix, 0);
    this.copyOverlap(result, begin, end, this.suffix, this.suffixOffset);
    return result;
  }

  close(): void {
    this.closed = true;
  }

  private copyOverlap(
    target: Uint8Array,
    begin: number,
    end: number,
    segment: Uint8Array,
    segmentOffset: number,
  ): void {
    const overlapBegin = Math.max(begin, segmentOffset);
    const overlapEnd = Math.min(end, segmentOffset + segment.byteLength);
    if (overlapBegin >= overlapEnd) return;
    target.set(
      segment.subarray(overlapBegin - segmentOffset, overlapEnd - segmentOffset),
      overlapBegin - begin,
    );
  }
}

function buildSparsePdfSource(text: string, gapBytes: number): SparseLargePdfSource {
  const small = Buffer.from(buildPdf(text));
  const xrefIndex = small.indexOf(Buffer.from('xref\n', 'ascii'));
  assert.ok(xrefIndex > 0, 'xref table should exist');

  const prefix = small.subarray(0, xrefIndex);
  const xrefOffset = prefix.byteLength + gapBytes;
  const suffix = Buffer.from(
    small
      .subarray(xrefIndex)
      .toString('ascii')
      .replace(/startxref\n\d+/, `startxref\n${xrefOffset}`),
    'ascii',
  );
  return new SparseLargePdfSource(prefix, suffix, gapBytes);
}

const rangeSource = buildSparsePdfSource(
  'PDF range works',
  PDF_RANGE_CHUNK_BYTES * 2 + 1024,
);
const rangePages = await extractPdfFromRangeSource(rangeSource);
assert.match(rangePages[0].text, /PDF range works/);
assert.equal(rangeSource.closed, true);
assert.ok(rangeSource.reads.length >= 3);
assert.ok(rangeSource.reads.every(({ begin, end }) => end - begin <= PDF_RANGE_CHUNK_BYTES));
console.log('✅ PDFを1MB単位の範囲読み込みで解析する');

assert.equal(shouldUsePdfRange(LARGE_PDF_THRESHOLD_BYTES), false);
assert.equal(shouldUsePdfRange(LARGE_PDF_THRESHOLD_BYTES + 1), true);
console.log('✅ 50MBを超えるPDFで範囲読み込みへ切り替える');

assert.throws(
  () => validatePdfSize(MAX_PDF_BYTES + 1),
  (error: unknown) => error instanceof PdfImportError && error.code === 'too_large',
);
console.log('✅ 200MBを超えるPDFは端末保護のため拒否する');

console.log('pdf-extractor.test.mts: passed');
