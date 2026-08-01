import { File as ExpoFile } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import {
  extractPdfBytes,
  PdfImportError,
  type PageText,
} from './pdfTextExtractor';

export type { PageText } from './pdfTextExtractor';

/**
 * Extract text from a PDF or TXT file.
 * TXT: reads directly as UTF-8.
 * PDF: reads binary bytes and lets PDF.js decode compressed content streams.
 */
export async function extractTextFromFile(
  uri: string,
  filename: string,
): Promise<PageText[]> {
  if (filename.toLowerCase().endsWith('.txt')) return extractTxt(uri);
  return extractPdf(uri);
}

async function extractTxt(uri: string): Promise<PageText[]> {
  const text = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const chunkSize = 800;
  const pages: PageText[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    pages.push({ page: pages.length + 1, text: text.slice(i, i + chunkSize) });
  }
  return pages.length > 0 ? pages : [{ page: 1, text }];
}

async function extractPdf(uri: string): Promise<PageText[]> {
  let bytes: Uint8Array;
  try {
    bytes = await new ExpoFile(uri).bytes();
  } catch (error) {
    throw new PdfImportError('read_failed', error);
  }
  return extractPdfBytes(bytes);
}
