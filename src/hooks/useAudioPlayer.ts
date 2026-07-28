import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { EventSubscription } from 'expo-modules-core';
import { useReaderStore } from '../store/readerStore';
import { useLibraryStore } from '../store/libraryStore';
import { audioCachePath } from '../services/googleTTS';
import { Sentence } from '../types/book';

export function useAudioPlayer(bookId: string, sentences: Sentence[]) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubscriptionRef = useRef<EventSubscription | null>(null);
  const { currentSentenceIdx, isPlaying, setCurrentSentenceIdx, setPlaying } = useReaderStore();
  const { updateBook } = useLibraryStore();

  const stopCurrent = useCallback(async () => {
    statusSubscriptionRef.current?.remove();
    statusSubscriptionRef.current = null;
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.remove();
      playerRef.current = null;
    }
  }, []);

  const playSentence = useCallback(
    async (idx: number) => {
      if (idx >= sentences.length) {
        setPlaying(false);
        return;
      }
      await stopCurrent();
      const path = audioCachePath(bookId, sentences[idx].id);
      const player = createAudioPlayer({ uri: path }, {
        updateInterval: 250,
        keepAudioSessionActive: true,
      });
      playerRef.current = player;
      statusSubscriptionRef.current = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          statusSubscriptionRef.current?.remove();
          statusSubscriptionRef.current = null;
          player.remove();
          if (playerRef.current === player) playerRef.current = null;
          const next = idx + 1;
          setCurrentSentenceIdx(next);
          updateBook(bookId, { lastSentenceIdx: next });
          void playSentence(next);
        }
      });
      player.play();
    },
    [bookId, sentences, stopCurrent, setCurrentSentenceIdx, setPlaying, updateBook]
  );

  const play = useCallback(async () => {
    setPlaying(true);
    await playSentence(currentSentenceIdx);
  }, [currentSentenceIdx, playSentence, setPlaying]);

  const pause = useCallback(async () => {
    setPlaying(false);
    playerRef.current?.pause();
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
