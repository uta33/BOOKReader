import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book } from '../types/book';
import { synthesize } from '../services/api';
import { clipKey, getClip, putClip } from '../services/audioCache';
import { useSettingsStore } from '../store/settingsStore';
import { useLibraryStore } from '../store/libraryStore';

export type AudioMode = 'tts' | 'speech' | 'timed';

interface PlayerApi {
  currentIdx: number;
  isPlaying: boolean;
  mode: AudioMode;
  /** number of clips pre-generated so far (Google TTS mode only). */
  prefetched: number;
  total: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  skipForward: () => void;
  skipBack: () => void;
  jumpTo: (idx: number) => void;
}

/**
 * Drives sentence-by-sentence playback with highlight sync.
 * Audio source preference: Google Cloud TTS (cached mp3) → browser
 * SpeechSynthesis → a timed auto-advance fallback so reading always progresses.
 */
export function useAudioPlayer(book: Book, onReachedEnd?: () => void): PlayerApi {
  const sentences = book.sentences;
  const total = sentences.length;
  const { voiceName, speakingRate, pitch } = useSettingsStore();
  const updateBook = useLibraryStore((s) => s.updateBook);

  const [currentIdx, setCurrentIdx] = useState(book.lastSentenceIdx ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<AudioMode>('tts');
  const [prefetched, setPrefetched] = useState(0);

  const idxRef = useRef(currentIdx);
  const playingRef = useRef(false);
  const tokenRef = useRef(0); // invalidates stale async callbacks
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsAvailableRef = useRef(true);

  const settings = useRef({ voiceName, speakingRate, pitch });
  settings.current = { voiceName, speakingRate, pitch };

  const setIdx = useCallback(
    (i: number) => {
      idxRef.current = i;
      setCurrentIdx(i);
      updateBook(book.id, { lastSentenceIdx: i });
    },
    [book.id, updateBook],
  );

  const stopAudioPrimitives = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Fetch (or generate) one clip; returns base64 mp3, or null when TTS falls back.
  const ensureClip = useCallback(async (idx: number): Promise<string | null> => {
    if (!ttsAvailableRef.current) return null;
    const { voiceName: v, speakingRate: r, pitch: p } = settings.current;
    const key = clipKey(book.id, sentences[idx].id, v, r, p);
    const cached = await getClip(key);
    if (cached) return cached;
    const resp = await synthesize(sentences[idx].text, v, r, p);
    if (resp.fallback) {
      ttsAvailableRef.current = false;
      return null;
    }
    await putClip(key, resp.audioContent);
    return resp.audioContent;
  }, [book.id, sentences]);

  const advance = useCallback(() => {
    const next = idxRef.current + 1;
    if (next >= total) {
      playingRef.current = false;
      setIsPlaying(false);
      onReachedEnd?.();
      return;
    }
    setIdx(next);
    if (playingRef.current) void playFrom(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, setIdx, onReachedEnd]);

  const speakViaSpeech = useCallback(
    (idx: number, token: number) => {
      const text = sentences[idx].text;
      const synth = window.speechSynthesis;
      const estMs = Math.max(1500, (text.length * 90) / settings.current.speakingRate);
      // Watchdog: advance even if onend never fires (e.g. headless browsers).
      timerRef.current = setTimeout(() => {
        if (token === tokenRef.current && playingRef.current) advance();
      }, estMs + 2500);

      if (synth) {
        setMode('speech');
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP';
        u.rate = Math.min(2, Math.max(0.5, settings.current.speakingRate));
        u.pitch = 1 + settings.current.pitch / 10;
        u.onend = () => {
          if (token !== tokenRef.current) return;
          if (timerRef.current) clearTimeout(timerRef.current);
          if (playingRef.current) advance();
        };
        synth.speak(u);
      } else {
        setMode('timed');
      }
    },
    [sentences, advance],
  );

  const playFrom = useCallback(
    async (idx: number) => {
      stopAudioPrimitives();
      const token = ++tokenRef.current;
      const b64 = await ensureClip(idx).catch(() => null);
      if (token !== tokenRef.current || !playingRef.current) return;

      if (b64) {
        setMode('tts');
        const audio = new Audio(`data:audio/mp3;base64,${b64}`);
        audioRef.current = audio;
        audio.onended = () => {
          if (token === tokenRef.current && playingRef.current) advance();
        };
        audio.play().catch(() => {
          if (token === tokenRef.current) speakViaSpeech(idx, token);
        });
      } else {
        speakViaSpeech(idx, token);
      }
    },
    [ensureClip, stopAudioPrimitives, advance, speakViaSpeech],
  );

  const play = useCallback(() => {
    if (playingRef.current || total === 0) return;
    playingRef.current = true;
    setIsPlaying(true);
    void playFrom(idxRef.current);
  }, [playFrom, total]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    tokenRef.current++;
    stopAudioPrimitives();
  }, [stopAudioPrimitives]);

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [play, pause]);

  const jumpTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(total - 1, i));
      setIdx(clamped);
      if (playingRef.current) void playFrom(clamped);
    },
    [total, setIdx, playFrom],
  );

  const skipForward = useCallback(() => jumpTo(idxRef.current + 1), [jumpTo]);
  const skipBack = useCallback(() => jumpTo(idxRef.current - 1), [jumpTo]);

  // Background pre-generation of audio (Google TTS only). Stops on fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < total; i++) {
        if (cancelled || !ttsAvailableRef.current) break;
        try {
          await ensureClip(i);
        } catch {
          break;
        }
        if (!cancelled) setPrefetched((n) => Math.max(n, i + 1));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [total, ensureClip]);

  // Cleanup on unmount.
  useEffect(() => () => {
    playingRef.current = false;
    tokenRef.current++;
    stopAudioPrimitives();
  }, [stopAudioPrimitives]);

  return {
    currentIdx,
    isPlaying,
    mode,
    prefetched,
    total,
    play,
    pause,
    toggle,
    skipForward,
    skipBack,
    jumpTo,
  };
}
