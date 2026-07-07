import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../types/book';
import { synthesizeChunk } from '../services/api';
import { buildChunks, chunkIndexFor, type Chunk } from '../services/chunker';
import {
  chunkKey,
  countChunksForBook,
  ensurePersistentStorage,
  getChunkClip,
  putChunkClip,
  type ChunkClip,
} from '../services/audioCache';
import { useSettingsStore } from '../store/settingsStore';
import { useLibraryStore } from '../store/libraryStore';
import { usePlaybackStore } from '../store/playbackStore';
import { useStatsStore } from '../store/statsStore';

export type AudioMode = 'tts' | 'speech' | 'timed';

/** Delay before the single automatic retry on a transient synthesis failure. */
const RETRY_DELAY_MS = 800;

/**
 * Synthesize one chunk (multi-sentence continuous utterance), retrying once
 * after a transient failure. Returns null when the server reports Google TTS
 * isn't configured (`fallback`) — a permanent condition for this deployment.
 */
async function synthesizeChunkWithRetry(
  chunk: Chunk,
  voiceName: string,
  pitch: number,
): Promise<ChunkClip | null> {
  const parts = chunk.sentences.map((s) => ({ id: s.id, text: s.text }));
  for (let attempt = 0; ; attempt++) {
    try {
      const resp = await synthesizeChunk(parts, voiceName, pitch);
      if (resp.fallback) return null;
      return { audio: resp.audioContent, timepoints: resp.timepoints };
    } catch (e) {
      if (attempt > 0) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

export interface SaveProgress {
  done: number;
  total: number;
}

interface PlayerApi {
  currentIdx: number;
  isPlaying: boolean;
  mode: AudioMode;
  total: number;
  /** Total narration chunks for this book. */
  chunkTotal: number;
  /** Chunks already persisted for this book (any voice). */
  savedCount: number;
  /** non-null while "save all audio" is running. */
  saveProgress: SaveProgress | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  skipForward: () => void;
  skipBack: () => void;
  jumpTo: (idx: number) => void;
  /** Generate & persist every chunk so the book plays offline anytime. */
  saveAll: () => Promise<void>;
  /** Generate & persist the current chunk only — does not play it. */
  generateCurrent: () => Promise<void>;
}

/**
 * Chunked narration with per-sentence highlight sync.
 *
 * Sentences are grouped into ~400-char chunks, each synthesized as ONE
 * continuous utterance (natural prosody, no per-sentence seams). Google TTS
 * returns an SSML-mark timepoint per sentence, which drives the highlight and
 * tap-to-seek from a single audio element. Chunks are synthesized at 1.0x and
 * persisted in IndexedDB keyed by book+chunk+voice; playback speed is applied
 * via `playbackRate`. Source preference: saved/Google chunk → browser
 * SpeechSynthesis (per sentence) → timed advance.
 */
export function useAudioPlayer(book: Book, onReachedEnd?: () => void): PlayerApi {
  const sentences = book.sentences;
  const total = sentences.length;
  const chunks = useMemo(() => buildChunks(sentences), [sentences]);
  const chunkTotal = chunks.length;
  const idToGlobal = useMemo(() => {
    const m = new Map<string, number>();
    sentences.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [sentences]);

  const { voiceName, speakingRate, pitch } = useSettingsStore();
  const updateBook = useLibraryStore((s) => s.updateBook);
  const setNarrating = usePlaybackStore((s) => s.setNarrating);

  const [currentIdx, setCurrentIdx] = useState(book.lastSentenceIdx ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<AudioMode>('tts');
  const [savedCount, setSavedCount] = useState(0);
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);

  const idxRef = useRef(currentIdx);
  const playingRef = useRef(false);
  const tokenRef = useRef(0); // invalidates stale async callbacks
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingChunkRef = useRef<{ ci: number; clip: ChunkClip } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsAvailableRef = useRef(true);
  const savingRef = useRef(false);
  // In-flight synthesis requests keyed by chunk key, so prefetch and an
  // explicit "generate" click racing on the same chunk share one call.
  const pendingRef = useRef(new Map<string, Promise<ChunkClip | null>>());
  // Next chunk's Audio element, built while the current one plays, so the
  // chunk hand-off has no fetch/decode gap.
  const nextAudioRef = useRef<{ ci: number; audio: HTMLAudioElement; clip: ChunkClip } | null>(
    null,
  );

  const settings = useRef({ voiceName, speakingRate, pitch });
  settings.current = { voiceName, speakingRate, pitch };

  // Load how many chunks are already saved for this book.
  useEffect(() => {
    if (!book.id) return;
    let cancelled = false;
    void countChunksForBook(book.id).then((n) => {
      if (!cancelled) setSavedCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  // Expose live narration state globally so the BGM can follow it (play only
  // while narrating). Reset to false when the reader unmounts.
  useEffect(() => {
    setNarrating(isPlaying);
  }, [isPlaying, setNarrating]);
  useEffect(() => () => setNarrating(false), [setNarrating]);

  // Log listening time into the daily activity stats (streak / today's goal).
  // The cleanup flushes on pause and on unmount alike.
  const addListen = useStatsStore((s) => s.addListen);
  useEffect(() => {
    if (!isPlaying) return;
    const startedAt = Date.now();
    return () => addListen(Date.now() - startedAt);
  }, [isPlaying, addListen]);

  // Changing the speed mid-chunk applies immediately to the playing audio.
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
      audioRef.current.ontimeupdate = null;
      audioRef.current = null;
    }
    playingChunkRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Fetch (or synthesize + persist) one chunk. Returns null when Google TTS
  // is unavailable. Chunks are always synthesized at 1.0x.
  const ensureChunkClip = useCallback(
    async (ci: number): Promise<ChunkClip | null> => {
      if (ci < 0 || ci >= chunks.length) return null;
      const key = chunkKey(book.id, chunks[ci].id, settings.current.voiceName);
      const cached = await getChunkClip(key);
      if (cached) return cached;
      if (!ttsAvailableRef.current) return null;

      let task = pendingRef.current.get(key);
      if (!task) {
        task = synthesizeChunkWithRetry(
          chunks[ci],
          settings.current.voiceName,
          settings.current.pitch,
        ).finally(() => {
          pendingRef.current.delete(key);
        });
        pendingRef.current.set(key, task);
      }

      const clip = await task;
      if (clip === null) {
        ttsAvailableRef.current = false;
        return null;
      }
      await putChunkClip(key, clip);
      setSavedCount((n) => n + 1);
      return clip;
    },
    [book.id, chunks],
  );

  /** Global sentence index at a playback position within a chunk. */
  const sentenceAtTime = useCallback(
    (chunk: Chunk, clip: ChunkClip, t: number): number => {
      let idx = chunk.startIdx;
      for (const tp of clip.timepoints) {
        if (tp.timeSeconds > t + 0.05) break;
        const gi = idToGlobal.get(tp.markName);
        if (gi !== undefined) idx = gi;
      }
      return idx;
    },
    [idToGlobal],
  );

  // ---- Fallback machine (no Google TTS): per-sentence speech / timed. ----

  const advanceFallback = useCallback(() => {
    const next = idxRef.current + 1;
    if (next >= total) {
      playingRef.current = false;
      setIsPlaying(false);
      onReachedEnd?.();
      return;
    }
    setIdx(next);
    if (playingRef.current) fallbackPlay(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, setIdx, onReachedEnd]);

  const speakViaSpeech = useCallback(
    (idx: number, token: number) => {
      const text = sentences[idx].text;
      const synth = window.speechSynthesis;
      const estMs = Math.max(1500, (text.length * 90) / settings.current.speakingRate);
      // Watchdog: advance even if onend never fires (e.g. headless browsers).
      timerRef.current = setTimeout(() => {
        if (token === tokenRef.current && playingRef.current) advanceFallback();
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
          if (playingRef.current) advanceFallback();
        };
        synth.speak(u);
      } else {
        setMode('timed');
      }
    },
    [sentences, advanceFallback],
  );

  const fallbackPlay = useCallback(
    (idx: number) => {
      stopAudioPrimitives();
      const token = ++tokenRef.current;
      speakViaSpeech(idx, token);
    },
    [stopAudioPrimitives, speakViaSpeech],
  );

  // ---- Chunked TTS playback. ----

  // Pre-build the following chunk's Audio element during playback so the
  // chunk-to-chunk transition is seamless.
  const prepareNextChunk = useCallback(
    async (ci: number, token: number) => {
      nextAudioRef.current = null;
      if (ci >= chunks.length) return;
      const clip = await ensureChunkClip(ci).catch(() => null);
      if (!clip || token !== tokenRef.current) return;
      const audio = new Audio(`data:audio/mp3;base64,${clip.audio}`);
      audio.preload = 'auto';
      nextAudioRef.current = { ci, audio, clip };
    },
    [chunks.length, ensureChunkClip],
  );

  const playChunk = useCallback(
    async (ci: number, seekSentenceIdx?: number) => {
      stopAudioPrimitives();
      const token = ++tokenRef.current;

      // Use the preloaded element when it matches; otherwise fetch normally.
      const pre = nextAudioRef.current;
      nextAudioRef.current = null;
      let audio: HTMLAudioElement | null = null;
      let clip: ChunkClip | null = null;
      if (pre && pre.ci === ci) {
        audio = pre.audio;
        clip = pre.clip;
      } else {
        clip = await ensureChunkClip(ci).catch(() => null);
        if (token !== tokenRef.current || !playingRef.current) return;
        if (clip) audio = new Audio(`data:audio/mp3;base64,${clip.audio}`);
      }

      if (!audio || !clip) {
        fallbackPlay(seekSentenceIdx ?? idxRef.current);
        return;
      }

      const chunk = chunks[ci];
      const theClip = clip;
      setMode('tts');
      playingChunkRef.current = { ci, clip: theClip };
      audio.playbackRate = settings.current.speakingRate;
      audioRef.current = audio;

      // Seek to a sentence inside the chunk (resume / tap-to-jump).
      if (seekSentenceIdx !== undefined && seekSentenceIdx > chunk.startIdx) {
        const tp = theClip.timepoints.find(
          (t) => t.markName === sentences[seekSentenceIdx]?.id,
        );
        if (tp) {
          const seekTo = tp.timeSeconds;
          if (audio.readyState >= 1) audio.currentTime = seekTo;
          else
            audio.addEventListener(
              'loadedmetadata',
              () => {
                audio.currentTime = seekTo;
              },
              { once: true },
            );
        }
      }

      audio.ontimeupdate = () => {
        if (token !== tokenRef.current) return;
        const gi = sentenceAtTime(chunk, theClip, audio.currentTime);
        if (gi !== idxRef.current) setIdx(gi);
      };
      audio.onended = () => {
        if (token !== tokenRef.current || !playingRef.current) return;
        const nc = ci + 1;
        if (nc >= chunks.length) {
          playingRef.current = false;
          setIsPlaying(false);
          onReachedEnd?.();
          return;
        }
        setIdx(chunks[nc].startIdx);
        void playChunk(nc);
      };
      audio.play().catch(() => {
        if (token === tokenRef.current) fallbackPlay(idxRef.current);
      });
      void prepareNextChunk(ci + 1, token);
    },
    [
      chunks,
      sentences,
      ensureChunkClip,
      stopAudioPrimitives,
      fallbackPlay,
      prepareNextChunk,
      sentenceAtTime,
      setIdx,
      onReachedEnd,
    ],
  );

  const play = useCallback(() => {
    if (playingRef.current || total === 0) return;
    playingRef.current = true;
    setIsPlaying(true);
    const ci = Math.max(0, chunkIndexFor(chunks, idxRef.current));
    void playChunk(ci, idxRef.current);
  }, [playChunk, chunks, total]);

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
      if (!playingRef.current) return;
      const ci = Math.max(0, chunkIndexFor(chunks, clamped));
      // Seek within the currently playing chunk without reloading it.
      const playing = playingChunkRef.current;
      if (playing && playing.ci === ci && audioRef.current) {
        const tp = playing.clip.timepoints.find(
          (t) => t.markName === sentences[clamped]?.id,
        );
        if (tp) {
          audioRef.current.currentTime = tp.timeSeconds;
          return;
        }
      }
      void playChunk(ci, clamped);
    },
    [total, setIdx, chunks, sentences, playChunk],
  );

  const skipForward = useCallback(() => jumpTo(idxRef.current + 1), [jumpTo]);
  const skipBack = useCallback(() => jumpTo(idxRef.current - 1), [jumpTo]);

  // Prefetch: keep the chunk under the cursor and the next one synthesized,
  // so pressing play (and the following transition) is instant. Full-book
  // generation stays the explicit saveAll() action.
  useEffect(() => {
    if (!book.id || chunks.length === 0) return;
    let cancelled = false;
    const ci = Math.max(0, chunkIndexFor(chunks, currentIdx));
    (async () => {
      for (const i of [ci, ci + 1]) {
        if (cancelled || !ttsAvailableRef.current || i >= chunks.length) break;
        try {
          await ensureChunkClip(i);
        } catch {
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book.id, currentIdx, chunks, ensureChunkClip]);

  // Explicit "save the whole book" — persists every chunk for offline replay.
  const saveAll = useCallback(async () => {
    if (savingRef.current || chunkTotal === 0) return;
    if (!ttsAvailableRef.current) {
      throw new Error('高品質音声（Google TTS）が未設定のため保存できません。');
    }
    savingRef.current = true;
    setSaveProgress({ done: 0, total: chunkTotal });
    try {
      await ensurePersistentStorage();
      for (let i = 0; i < chunkTotal; i++) {
        const clip = await ensureChunkClip(i);
        if (clip === null) {
          throw new Error('高品質音声（Google TTS）が未設定のため保存できません。');
        }
        setSaveProgress({ done: i + 1, total: chunkTotal });
      }
      setSavedCount(await countChunksForBook(book.id));
    } finally {
      savingRef.current = false;
      setSaveProgress(null);
    }
  }, [book.id, chunkTotal, ensureChunkClip]);

  // Explicit "generate the current chunk only" — prepares/persists it without
  // starting playback (pre-warming, or confirming Google TTS is configured).
  const generateCurrent = useCallback(async () => {
    const ci = Math.max(0, chunkIndexFor(chunks, idxRef.current));
    const clip = await ensureChunkClip(ci);
    if (clip === null) {
      throw new Error('高品質音声（Google TTS）が未設定のため生成できません。');
    }
  }, [chunks, ensureChunkClip]);

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
    chunkTotal,
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
