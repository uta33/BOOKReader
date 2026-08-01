import { useState, useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { buildSentences } from '../services/sentenceSplitter';
import { extractTextFromFile } from '../services/pdfExtractor';
import { MAX_PDF_BYTES, PdfImportError } from '../services/pdfTextExtractor';
import {
  detectImportFileKind,
  storedExtensionFor,
  titleFromImportFilename,
} from '../services/contentImport';
import { createContentBook } from '../services/bookFactory';
import { useLibraryStore } from '../store/libraryStore';

export function usePdfExtraction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addBook } = useLibraryStore();

  const pickAndImport = useCallback(async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      // Androidのファイル管理アプリごとにMarkdownのMIME型が異なるため、
      // 選択後に拡張子を厳密に検証する。
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const kind = detectImportFileKind(asset.name);
    if (!kind) {
      setError('対応しているファイルはPDF、TXT、Markdown（.md／.markdown）です。');
      return;
    }
    if (kind === 'pdf' && typeof asset.size === 'number' && asset.size > MAX_PDF_BYTES) {
      setError(new PdfImportError('too_large').message);
      return;
    }

    let destUri: string | undefined;
    setLoading(true);
    try {
      const destDir = `${FileSystem.documentDirectory}books/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const bookId = `book_${Date.now()}`;
      destUri = `${destDir}${bookId}${storedExtensionFor(kind)}`;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });

      const pageTexts = await extractTextFromFile(destUri, asset.name);
      const sentences = buildSentences(pageTexts);
      const title = titleFromImportFilename(asset.name);

      addBook(
        createContentBook({
          id: bookId,
          title,
          uri: destUri,
          totalPages: Math.max(pageTexts.length, 1),
          sentences,
        }),
      );
    } catch (e: unknown) {
      if (destUri) {
        await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => undefined);
      }
      setError(e instanceof Error ? e.message : 'ファイルの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [addBook]);

  return { pickAndImport, loading, error };
}
