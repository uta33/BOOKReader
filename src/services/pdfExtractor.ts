import { File as ExpoFile, FileMode, type FileHandle } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import {
  extractPdfBytes,
  extractPdfFromRangeSource,
  PdfImportError,
  shouldUsePdfRange,
  type PageText,
} from './pdfTextExtractor';
import {
  chunkImportedText,
  detectImportFileKind,
  markdownToReadableText,
} from './contentImport';

export type { PageText } from './pdfTextExtractor';

/**
 * Extract text from a PDF, TXT, or Markdown file.
 * TXT/Markdown: reads directly as UTF-8.
 * PDF: small files use binary bytes; large files use local range reads.
 */
export async function extractTextFromFile(
  uri: string,
  filename: string,
): Promise<PageText[]> {
  const kind = detectImportFileKind(filename);
  if (kind === 'txt') return extractText(uri);
  if (kind === 'markdown') return extractMarkdown(uri);
  if (kind !== 'pdf') {
    throw new Error('対応しているファイルはPDF、TXT、Markdown（.md／.markdown）です。');
  }
  return extractPdf(uri);
}

async function extractText(uri: string): Promise<PageText[]> {
  const text = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return chunkImportedText(text);
}

async function extractMarkdown(uri: string): Promise<PageText[]> {
  const markdown = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const text = markdownToReadableText(markdown);
  if (!text) throw new Error('Markdownファイルに読み込める本文がありません。');
  return chunkImportedText(text);
}

async function extractPdf(uri: string): Promise<PageText[]> {
  const file = new ExpoFile(uri);

  if (shouldUsePdfRange(file.size)) {
    let handle: FileHandle;
    try {
      handle = file.open(FileMode.ReadOnly);
    } catch (error) {
      throw new PdfImportError('read_failed', error);
    }

    let closed = false;
    return extractPdfFromRangeSource({
      size: file.size,
      read(begin, end) {
        handle.offset = begin;
        return handle.readBytes(end - begin);
      },
      close() {
        if (closed) return;
        closed = true;
        handle.close();
      },
    });
  }

  try {
    return await extractPdfBytes(await file.bytes());
  } catch (error) {
    if (error instanceof PdfImportError) throw error;
    throw new PdfImportError('read_failed', error);
  }
}
