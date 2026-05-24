import { useState, useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { buildSentences } from '../services/sentenceSplitter';
import { extractTextFromFile } from '../services/pdfExtractor';
import { useLibraryStore } from '../store/libraryStore';
import { Book } from '../types/book';

export function usePdfExtraction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addBook } = useLibraryStore();

  const pickAndImport = useCallback(async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setLoading(true);
    try {
      const destDir = `${FileSystem.documentDirectory}books/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const bookId = `book_${Date.now()}`;
      const isTxt = asset.name.toLowerCase().endsWith('.txt');
      const destUri = `${destDir}${bookId}${isTxt ? '.txt' : '.pdf'}`;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });

      const pageTexts = await extractTextFromFile(destUri, asset.name);
      const sentences = buildSentences(pageTexts);
      const title = asset.name.replace(/\.(pdf|txt)$/i, '');

      const book: Book = {
        id: bookId,
        title,
        uri: destUri,
        totalPages: Math.max(pageTexts.length, 1),
        sentences,
        lastSentenceIdx: 0,
        cachedSentenceIds: [],
        createdAt: Date.now(),
      };

      addBook(book);
    } catch (e: any) {
      setError(e.message ?? 'ファイルの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [addBook]);

  return { pickAndImport, loading, error };
}
