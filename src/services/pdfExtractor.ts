import * as FileSystem from 'expo-file-system';

export type PageText = { page: number; text: string };

/**
 * Extract text from a PDF or TXT file.
 * TXT: reads directly as UTF-8.
 * PDF: parses Tj/TJ text operators from the raw byte stream.
 *      Works for digitally-created PDFs (not scanned images).
 */
export async function extractTextFromFile(
  uri: string,
  filename: string
): Promise<PageText[]> {
  if (filename.toLowerCase().endsWith('.txt')) {
    return extractTxt(uri);
  }
  return extractPdf(uri);
}

async function extractTxt(uri: string): Promise<PageText[]> {
  const text = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  // Split into ~800-char chunks so long texts show progress
  const CHUNK = 800;
  const pages: PageText[] = [];
  for (let i = 0; i < text.length; i += CHUNK) {
    pages.push({ page: pages.length + 1, text: text.slice(i, i + CHUNK) });
  }
  return pages.length > 0 ? pages : [{ page: 1, text }];
}

async function extractPdf(uri: string): Promise<PageText[]> {
  let raw: string;
  try {
    raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    throw new Error('PDFファイルの読み込みに失敗しました。');
  }

  if (!raw.startsWith('%PDF')) {
    throw new Error('有効なPDFファイルではありません。');
  }

  // Try to extract text per page by splitting on /Type /Page (not /Pages)
  const pagePattern = /\/Type\s*\/Page[^s]/g;
  const pageStarts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = pagePattern.exec(raw)) !== null) {
    pageStarts.push(m.index);
  }

  const pages: PageText[] = [];

  if (pageStarts.length > 0) {
    for (let i = 0; i < pageStarts.length; i++) {
      const start = pageStarts[i];
      const end = pageStarts[i + 1] ?? raw.length;
      const text = extractTextOps(raw.slice(start, end));
      if (text.trim()) pages.push({ page: i + 1, text });
    }
  }

  // Fallback: extract from the whole document as page 1
  if (pages.length === 0) {
    const text = extractTextOps(raw);
    if (text.trim()) pages.push({ page: 1, text });
  }

  if (pages.length === 0) {
    throw new Error(
      'このPDFからテキストを抽出できませんでした。\n\n' +
        '対応しているPDF：\n' +
        '・テキストが選択できるPDF（デジタル作成）\n\n' +
        '非対応のPDF：\n' +
        '・スキャンされた画像PDF\n\n' +
        '代替案：テキストを .txt ファイルで保存してインポートしてください。'
    );
  }

  return pages;
}

/** Extract text from Tj and TJ PDF operators in a chunk of PDF content. */
function extractTextOps(chunk: string): string {
  const parts: string[] = [];

  // (string)Tj  — single string
  const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRe.exec(chunk)) !== null) {
    const t = decodePdfStr(match[1]);
    if (t.trim()) parts.push(t);
  }

  // [(string -num string ...)...]TJ  — array of strings and kerning numbers
  const tjArrRe = /\[([^\]]*)\]\s*TJ/g;
  while ((match = tjArrRe.exec(chunk)) !== null) {
    const inner = match[1];
    const strRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRe.exec(inner)) !== null) {
      const t = decodePdfStr(sm[1]);
      if (t.trim()) parts.push(t);
    }
  }

  return parts.join('');
}

function decodePdfStr(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')');
}
