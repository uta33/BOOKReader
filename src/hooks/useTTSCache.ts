import { useCallback, useRef } from 'react';
import { generateAndCache, audioCachePath } from '../services/googleTTS';
import { useSettingsStore } from '../store/settingsStore';
import { Sentence } from '../types/book';

// Google TTS のレート制限と生成速度のバランス
const CONCURRENCY = 3;

export function useTTSCache(bookId: string) {
  const { voiceName, speakingRate, pitch } = useSettingsStore();
  const abortRef = useRef(false);

  const getOrGenerate = useCallback(
    async (sentence: Sentence): Promise<string> => {
      const options = { voiceName, speakingRate, pitch };
      const path = audioCachePath(bookId, sentence.id, options);
      return generateAndCache(sentence.text, options, path);
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
      let done = 0;

      for (let i = 0; i < total; i += CONCURRENCY) {
        if (abortRef.current) break;
        const batch = sentences.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (s) => {
            await getOrGenerate(s);
            done++;
            onProgress(done, total);
          })
        );
      }
    },
    [getOrGenerate]
  );

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { getOrGenerate, generateAll, abort };
}
