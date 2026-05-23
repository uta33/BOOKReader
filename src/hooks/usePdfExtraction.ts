import { useState, useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { buildSentences } from '../services/sentenceSplitter';
import { useLibraryStore } from '../store/libraryStore';
import { Book } from '../types/book';

export function usePdfExtraction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addBook } = useLibraryStore();

  const pickAndImport = useCallback(async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setLoading(true);
    try {
      const destDir = `${FileSystem.documentDirectory}books/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const bookId = `book_${Date.now()}`;
      const destUri = `${destDir}${bookId}.pdf`;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });

      // Attempt expo-pdf-text-extract (EAS build only)
      let pageTexts: { page: number; text: string }[] = [];
      try {
        const pdfExtract = require('expo-pdf-text-extract');
        const pageCount = await pdfExtract.getPageCount(destUri);
        for (let i = 1; i <= pageCount; i++) {
          const text = await pdfExtract.extractText(destUri, i);
          pageTexts.push({ page: i, text });
        }
      } catch {
        // Fallback: treat filename as single-sentence demo
        pageTexts = [{ page: 1, text: asset.name.replace('.pdf', '') }];
      }

      const sentences = buildSentences(pageTexts);
      const totalPages = pageTexts.length;
      const title = asset.name.replace(/\.pdf$/i, '');

      const book: Book = {
        id: bookId,
        title,
        uri: destUri,
        totalPages,
        sentences,
        lastSentenceIdx: 0,
        cachedSentenceIds: [],
        createdAt: Date.now(),
      };

      addBook(book);
    } catch (e: any) {
      setError(e.message ?? 'PDF import failed');
    } finally {
      setLoading(false);
    }
  }, [addBook]);

  return { pickAndImport, loading, error };
}
