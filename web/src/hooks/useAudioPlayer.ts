import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book } from '../types/book';
import { synthesize } from '../services/api';
import {
  clipKey,
  countClipsForBook,
  ensurePersistentStorage,
  getClip,
  putClip,
} from '../services/audioCache';
import { useSettingsStore } from '../store/settingsStore';
import { useLibraryStore } from '../store/libraryStore';

export type AudioMode = 'tts' | 'speech' | 'timed';

/** How many sentences ahead of the cursor to auto-synthesize during playback. */
const PREFETCH_AHEAD = 5;

export interface SaveProgress {
  done: number;
  total: number;
}

interface PlayerApi {
  currentIdx: number;
  isPlaying: boolean;
  mode: AudioMode;
  total: number;
  /** clips already persisted for this book (any voice). */
  savedCount: number;
  /** non-null while "save all audio" is running. */
  saveProgress: SaveProgress | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  skipForward: () => void;
  skipBack: () => void;
  jumpTo: (idx: number) => void;
  /** Generate & persist every clip so the book plays offline anytime. */
  saveAll: () => Promise<void>;
  /** Generate & persist the current sentence's clip only — does not play it. */
  generateCurrent: () => Promise<void>;
}

/**
 * Sentence-by-sentence playback with highlight sync.
 *
 * Audio clips are synthesized at 1.0x and persisted in IndexedDB keyed by
 * book+sentence+voice; playback speed is applied via `playbackRate`, so a
 * saved book never needs re-synthesis when the speed changes. Source
 * preference: saved/Google TTS clip → browser SpeechSynthesis → timed advance.
 */
export function useAudioPlayer(book: Book, onReachedEnd?: () => void): PlayerApi {
  const sentences = book.sentences;
  const total = sentences.length;
  const { voiceName, speakingRate, pitch } = useSettingsStore();
  const updateBook = useLibraryStore((s) => s.updateBook);

  const [currentIdx, setCurrentIdx] = useState(book.lastSentenceIdx ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<AudioMode>('tts');
  const [savedCount, setSavedCount] = useState(0);
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);

  const idxRef = useRef(currentIdx);
  const playingRef = useRef(false);
  const tokenRef = useRef(0); // invalidates stale async callbacks
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsAvailableRef = useRef(true);
  const savingRef = useRef(false);

  const settings = useRef({ voiceName, speakingRate, pitch });
  settings.current = { voiceName, speakingRate, pitch };

  // Load how many clips are already saved for this book.
  useEffect(() => {
    if (!book.id) return;
    let cancelled = false;
    void countClipsForBook(book.id).then((n) => {
      if (!cancelled) setSavedCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  // Changing the speed mid-sentence applies immediately to the playing clip.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speakingRate;
  }, [speakingRate]);

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

  // Fetch (or synthesize + persist) one clip. Returns base64 mp3, or null
  // when Google TTS is unavailable. Clips are always synthesized at 1.0x.
  const ensureClip = useCallback(
    async (idx: number): Promise<string | null> => {
      const key = clipKey(book.id, sentences[idx].id, settings.current.voiceName);
      const cached = await getClip(key);
      if (cached) return cached;
      if (!ttsAvailableRef.current) return null;
      const resp = await synthesize(
        sentences[idx].text,
        settings.current.voiceName,
        1.0,
        settings.current.pitch,
      );
      if (resp.fallback) {
        ttsAvailableRef.current = false;
        return null;
      }
      await putClip(key, resp.audioContent);
      setSavedCount((n) => n + 1);
      return resp.audioContent;
    },
    [book.id, sentences],
  );

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
        audio.playbackRate = settings.current.speakingRate;
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

  // Windowed prefetch: keep the current sentence plus a few ahead synthesized.
  // Full-book generation is the explicit saveAll() action, so casual listening
  // only pays for what's actually near the cursor.
  useEffect(() => {
    if (!book.id || total === 0) return;
    let cancelled = false;
    (async () => {
      const end = Math.min(total, currentIdx + 1 + PREFETCH_AHEAD);
      for (let i = currentIdx; i < end; i++) {
        if (cancelled || !ttsAvailableRef.current) break;
        try {
          await ensureClip(i);
        } catch {
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book.id, currentIdx, total, ensureClip]);

  // Explicit "save the whole book" — persists every clip for offline replay.
  const saveAll = useCallback(async () => {
    if (savingRef.current || total === 0) return;
    if (!ttsAvailableRef.current) {
      throw new Error('高品質音声（Google TTS）が未設定のため保存できません。');
    }
    savingRef.current = true;
    setSaveProgress({ done: 0, total });
    try {
      await ensurePersistentStorage();
      for (let i = 0; i < total; i++) {
        const clip = await ensureClip(i);
        if (clip === null) {
          throw new Error('高品質音声（Google TTS）が未設定のため保存できません。');
        }
        setSaveProgress({ done: i + 1, total });
      }
      setSavedCount(await countClipsForBook(book.id));
    } finally {
      savingRef.current = false;
      setSaveProgress(null);
    }
  }, [book.id, total, ensureClip]);

  // Explicit "generate this sentence only" — prepares/persists the current
  // clip without starting playback. Useful for pre-warming silently (e.g.
  // before a meeting) or confirming Google TTS is actually configured.
  const generateCurrent = useCallback(async () => {
    const clip = await ensureClip(idxRef.current);
    if (clip === null) {
      throw new Error('高品質音声（Google TTS）が未設定のため生成できません。');
    }
  }, [ensureClip]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      playingRef.current = false;
      tokenRef.current++;
      stopAudioPrimitives();
    },
    [stopAudioPrimitives],
  );

  return {
    currentIdx,
    isPlaying,
    mode,
    total,
    savedCount,
    saveProgress,
    play,
    pause,
    toggle,
    skipForward,
    skipBack,
    jumpTo,
    saveAll,
    generateCurrent,
  };
}
