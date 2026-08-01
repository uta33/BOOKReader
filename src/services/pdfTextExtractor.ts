import { getDocumentProxy } from 'unpdf';

export type PageText = { page: number; text: string };

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export type PdfImportErrorCode =
  | 'read_failed'
  | 'too_large'
  | 'invalid'
  | 'password'
  | 'no_text'
  | 'parse_failed';

const ERROR_MESSAGES: Record<PdfImportErrorCode, string> = {
  read_failed:
    'PDFファイルを開けませんでした。端末へダウンロード済みのファイルを選び直してください。',
  too_large: 'PDFファイルが大きすぎます。50MB以下のPDFを選んでください。',
  invalid: '有効なPDFファイルではありません。別のPDFを選んでください。',
  password: 'パスワードで保護されたPDFには対応していません。保護を解除してから取り込んでください。',
  no_text:
    'このPDFには読み上げられる文字データがありません。画像をスキャンしたPDFは、OCRしたPDFまたはTXTへ変換してから取り込んでください。',
  parse_failed:
    'PDFを解析できませんでした。PDFを開き直して保存するか、本文をTXTで保存してから取り込んでください。',
};

export class PdfImportError extends Error {
  readonly code: PdfImportErrorCode;

  constructor(code: PdfImportErrorCode, cause?: unknown) {
    super(ERROR_MESSAGES[code], { cause });
    this.name = 'PdfImportError';
    this.code = code;
  }
}

export function validatePdfBytes(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_PDF_BYTES) throw new PdfImportError('too_large');
  if (bytes.byteLength < 5) throw new PdfImportError('invalid');
  const header = String.fromCharCode(...bytes.subarray(0, 5));
  if (header !== '%PDF-') throw new PdfImportError('invalid');
}

/**
 * PDF.jsのサーバーレス版で、圧縮ストリームや埋め込みフォントの文字対応表を解釈する。
 * ページを直列処理して、本一冊分を同時展開しないようにする。
 */
export async function extractPdfBytes(bytes: Uint8Array): Promise<PageText[]> {
  validatePdfBytes(bytes);

  let pdf;
  try {
    pdf = await getDocumentProxy(bytes, {
      disableFontFace: true,
      useSystemFonts: false,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      useWasm: false,
      verbosity: 0,
    });
  } catch (error) {
    throw mapPdfParseError(error);
  }

  const pages: PageText[] = [];
  let totalChars = 0;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        let text = '';
        for (const item of content.items) {
          if (!('str' in item)) continue;
          text += item.str.replace(/\0/g, '');
          if (item.hasEOL) text += '\n';
        }
        totalChars += text.replace(/\s/g, '').length;
        pages.push({ page: pageNumber, text: text.trim() });
      } finally {
        page.cleanup();
      }

      // 長い本でもUIスレッドへ定期的に制御を返す。
      if (pageNumber % 8 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
  } catch (error) {
    throw mapPdfParseError(error);
  } finally {
    await pdf.loadingTask.destroy();
  }

  if (totalChars === 0) throw new PdfImportError('no_text');
  return pages;
}

function mapPdfParseError(error: unknown): PdfImportError {
  if (error instanceof PdfImportError) return error;
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
  if (name === 'PasswordException') return new PdfImportError('password', error);
  if (name === 'InvalidPDFException') return new PdfImportError('invalid', error);
  return new PdfImportError('parse_failed', error);
}
