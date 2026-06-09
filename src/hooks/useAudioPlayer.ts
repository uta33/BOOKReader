import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { useReaderStore } from '../store/readerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useSettingsStore } from '../store/settingsStore';
import { audioCachePath, generateAndCache } from '../services/googleTTS';
import { Sentence } from '../types/book';

export function useAudioPlayer(bookId: string, sentences: Sentence[]) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const { currentSentenceIdx, isPlaying, setCurrentSentenceIdx, setPlaying } = useReaderStore();
  const { updateBook } = useLibraryStore();
  const { voiceName, speakingRate, pitch } = useSettingsStore();

  const stopCurrent = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  }, []);

  const playSentence = useCallback(
    async (idx: number) => {
      if (idx >= sentences.length) {
        setPlaying(false);
        return;
      }
      await stopCurrent();
      // キャッシュ済みなら即返り、未生成ならその場で生成する
      const options = { voiceName, speakingRate, pitch };
      const path = audioCachePath(bookId, sentences[idx].id, options);
      await generateAndCache(sentences[idx].text, options, path);
      const { sound } = await Audio.Sound.createAsync(
        { uri: path },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          const next = idx + 1;
          setCurrentSentenceIdx(next);
          updateBook(bookId, { lastSentenceIdx: next });
          playSentence(next);
        }
      });
    },
    [bookId, sentences, voiceName, speakingRate, pitch, stopCurrent, setCurrentSentenceIdx, setPlaying, updateBook]
  );

  const play = useCallback(async () => {
    setPlaying(true);
    await playSentence(currentSentenceIdx);
  }, [currentSentenceIdx, playSentence, setPlaying]);

  const pause = useCallback(async () => {
    setPlaying(false);
    if (soundRef.current) await soundRef.current.pauseAsync();
  }, []);

  const skipForward = useCallback(async () => {
    const next = Math.min(currentSentenceIdx + 1, sentences.length - 1);
    setCurrentSentenceIdx(next);
    if (isPlaying) await playSentence(next);
  }, [currentSentenceIdx, isPlaying, sentences.length, playSentence, setCurrentSentenceIdx]);

  const skipBack = useCallback(async () => {
    const prev = Math.max(currentSentenceIdx - 1, 0);
    setCurrentSentenceIdx(prev);
    if (isPlaying) await playSentence(prev);
  }, [currentSentenceIdx, isPlaying, playSentence, setCurrentSentenceIdx]);

  useEffect(() => {
    return () => {
      stopCurrent();
    };
  }, [stopCurrent]);

  return { play, pause, skipForward, skipBack };
}
