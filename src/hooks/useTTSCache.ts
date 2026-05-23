import { useCallback, useRef } from 'react';
import { generateAndCache, audioCachePath } from '../services/googleTTS';
import { useSettingsStore } from '../store/settingsStore';
import { Sentence } from '../types/book';

export function useTTSCache(bookId: string) {
  const { voiceName, speakingRate, pitch } = useSettingsStore();
  const abortRef = useRef(false);

  const getOrGenerate = useCallback(
    async (sentence: Sentence): Promise<string> => {
      const path = audioCachePath(bookId, sentence.id);
      return generateAndCache(sentence.text, { voiceName, speakingRate, pitch }, path);
    },
    [bookId, voiceName, speakingRate, pitch]
  );

  const generateAll = useCallback(
    async (
      sentences: Sentence[],
      onProgress: (done: number, total: number) => void
    ) => {
      abortRef.current = false;
      const total = sentences.length;
      for (let i = 0; i < total; i++) {
        if (abortRef.current) break;
        await getOrGenerate(sentences[i]);
        onProgress(i + 1, total);
      }
    },
    [getOrGenerate]
  );

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { getOrGenerate, generateAll, abort };
}
