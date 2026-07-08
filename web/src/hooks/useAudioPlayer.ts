import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../types/book';
import { synthesizeChunk } from '../services/api';
import {
  buildChunks,
  chunkIndexFor,
  estimatedStartSeconds,
  sentenceIndexAtTimeEstimate,
  type Chunk,
} from '../services/chunker';
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

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Blob URLs kept alive at once (current + next + a little slack). */
const URL_CACHE_MAX = 4;

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
  /** Assemble the whole book's narration as one MP3 blob (generates missing chunks). */
  exportMp3: () => Promise<Blob>;
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
  // Decoded Blob URLs per chunk key. Preparing the next chunk's URL during
  // playback makes the hand-off a cheap src swap with no decode gap.
  const urlCacheRef = useRef(new Map<string, string>());

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

  // ONE persistent audio element, activated by the user's first play gesture
  // and reused for every chunk via src swapping. iOS blocks NEW audio
  // elements from starting while the app is backgrounded (screen locked),
  // but an already-activated element may keep playing and change src — this
  // is what makes background/lock-screen playback work.
  const getAudioEl = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  const blobUrlFor = useCallback((key: string, clip: ChunkClip): string => {
    const cache = urlCacheRef.current;
    const existing = cache.get(key);
    if (existing) return existing;
    const url = URL.createObjectURL(
      new Blob([b64ToBytes(clip.audio) as BlobPart], { type: 'audio/mpeg' }),
    );
    cache.set(key, url);
    // Evict oldest entries (Map preserves insertion order).
    while (cache.size > URL_CACHE_MAX) {
      const [oldKey, oldUrl] = cache.entries().next().value as [string, string];
      cache.delete(oldKey);
      if (audioRef.current?.src !== oldUrl) URL.revokeObjectURL(oldUrl);
    }
    return url;
  }, []);

  const stopAudioPrimitives = useCallback(() => {
    // Keep the element itself (its playback permission must survive) —
    // just silence it and detach the per-chunk handlers.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.ontimeupdate = null;
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

  /**
   * Global sentence index at a playback position within a chunk. Uses SSML
   * mark timepoints when available; Chirp3-HD clips carry none, so fall back
   * to the character-proportional estimate (needs the clip duration).
   */
  const sentenceAtTime = useCallback(
    (chunk: Chunk, clip: ChunkClip, t: number, duration: number): number => {
      if (clip.timepoints.length === 0) {
        return sentenceIndexAtTimeEstimate(chunk, t, duration);
      }
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

  /** Start seconds of a sentence in its chunk (mark or estimate), or null. */
  const sentenceStartSeconds = useCallback(
    (chunk: Chunk, clip: ChunkClip, globalIdx: number, duration: number): number | null => {
      const tp = clip.timepoints.find((t) => t.markName === sentences[globalIdx]?.id);
      if (tp) return tp.timeSeconds;
      if (clip.timepoints.length === 0 && Number.isFinite(duration) && duration > 0) {
        return estimatedStartSeconds(chunk, globalIdx, duration);
      }
      return null;
    },
    [sentences],
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

  // Keep the lock-screen scrubber in sync with the playing chunk.
  const updatePositionState = useCallback(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: el.duration,
        position: Math.min(el.currentTime, el.duration),
        playbackRate: el.playbackRate,
      });
    } catch {
      /* older browsers */
    }
  }, []);

  // Pre-synthesize + pre-decode the following chunk during playback so the
  // chunk-to-chunk transition is a cheap src swap.
  const prepareNextChunk = useCallback(
    async (ci: number, token: number) => {
      if (ci >= chunks.length) return;
      const clip = await ensureChunkClip(ci).catch(() => null);
      if (!clip || token !== tokenRef.current) return;
      blobUrlFor(chunkKey(book.id, chunks[ci].id, settings.current.voiceName), clip);
    },
    [book.id, chunks, ensureChunkClip, blobUrlFor],
  );

  const playChunk = useCallback(
    async (ci: number, seekSentenceIdx?: number) => {
      stopAudioPrimitives();
      const token = ++tokenRef.current;

      const clip = await ensureChunkClip(ci).catch(() => null);
      if (token !== tokenRef.current || !playingRef.current) return;
      if (!clip) {
        fallbackPlay(seekSentenceIdx ?? idxRef.current);
        return;
      }

      const chunk = chunks[ci];
      const audio = getAudioEl();
      const url = blobUrlFor(chunkKey(book.id, chunk.id, settings.current.voiceName), clip);
      setMode('tts');
      playingChunkRef.current = { ci, clip };
      const sameSrc = audio.src === url;
      if (!sameSrc) audio.src = url;
      audio.playbackRate = settings.current.speakingRate;

      // Seek to a sentence inside the chunk (resume / tap-to-jump). When the
      // element still holds this chunk at that very sentence (pause → play),
      // resume mid-sentence instead of rewinding to the sentence start.
      // Estimated positions need the duration, so seeking waits for metadata.
      if (seekSentenceIdx !== undefined) {
        const applySeek = () => {
          if (sentenceAtTime(chunk, clip, audio.currentTime, audio.duration) === seekSentenceIdx)
            return;
          const seekTo = sentenceStartSeconds(chunk, clip, seekSentenceIdx, audio.duration);
          if (seekTo !== null) audio.currentTime = seekTo;
        };
        if (audio.readyState >= 1) applySeek();
        else audio.addEventListener('loadedmetadata', applySeek, { once: true });
      } else if (!sameSrc) {
        // Fresh chunk starts at its head.
        if (audio.readyState >= 1) audio.currentTime = 0;
      }

      audio.ontimeupdate = () => {
        if (token !== tokenRef.current) return;
        const gi = sentenceAtTime(chunk, clip, audio.currentTime, audio.duration);
        if (gi !== idxRef.current) setIdx(gi);
        updatePositionState();
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
      audio.play().then(updatePositionState).catch(() => {
        if (token === tokenRef.current) fallbackPlay(idxRef.current);
      });
      void prepareNextChunk(ci + 1, token);
    },
    [
      book.id,
      chunks,
      ensureChunkClip,
      stopAudioPrimitives,
      fallbackPlay,
      prepareNextChunk,
      sentenceAtTime,
      sentenceStartSeconds,
      setIdx,
      onReachedEnd,
      getAudioEl,
      blobUrlFor,
      updatePositionState,
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
        const seekTo = sentenceStartSeconds(
          chunks[ci],
          playing.clip,
          clamped,
          audioRef.current.duration,
        );
        if (seekTo !== null) {
          audioRef.current.currentTime = seekTo;
          return;
        }
      }
      void playChunk(ci, clamped);
    },
    [total, setIdx, chunks, sentenceStartSeconds, playChunk],
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

  // Assemble the whole narration as one MP3 for download. MP3 frames can be
  // concatenated directly, so the persisted chunks (generating any that are
  // missing, with the same progress reporting as saveAll) become one file.
  const exportMp3 = useCallback(async (): Promise<Blob> => {
    if (savingRef.current || chunkTotal === 0) {
      throw new Error('音声の準備がすでに実行中です。完了後にお試しください。');
    }
    if (!ttsAvailableRef.current) {
      throw new Error('高品質音声（Google TTS）が未設定のためダウンロードできません。');
    }
    savingRef.current = true;
    setSaveProgress({ done: 0, total: chunkTotal });
    try {
      const buffers: Uint8Array[] = [];
      for (let i = 0; i < chunkTotal; i++) {
        const clip = await ensureChunkClip(i);
        if (clip === null) {
          throw new Error('高品質音声（Google TTS）が未設定のためダウンロードできません。');
        }
        buffers.push(b64ToBytes(clip.audio));
        setSaveProgress({ done: i + 1, total: chunkTotal });
      }
      setSavedCount(await countChunksForBook(book.id));
      return new Blob(buffers as BlobPart[], { type: 'audio/mpeg' });
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

  // ---- Media Session: lock-screen / notification metadata & controls. ----

  useEffect(() => {
    if (!('mediaSession' in navigator) || !book.title) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: book.title,
      artist: 'BOOKReader',
      artwork: [
        { src: '/icon-192-v2.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512-v2.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  }, [book.title]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Latest-callback refs so the handlers registered once stay fresh.
  const apiRef = useRef({ play, pause, skipForward, skipBack });
  apiRef.current = { play, pause, skipForward, skipBack };

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const seekBy = (delta: number) => {
      const el = audioRef.current;
      if (!el || !Number.isFinite(el.duration)) return;
      el.currentTime = Math.max(0, Math.min(el.duration - 0.1, el.currentTime + delta));
    };
    const set = (type: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(type, fn);
      } catch {
        /* action unsupported on this browser */
      }
    };
    set('play', () => apiRef.current.play());
    set('pause', () => apiRef.current.pause());
    set('previoustrack', () => apiRef.current.skipBack());
    set('nexttrack', () => apiRef.current.skipForward());
    set('seekbackward', (d) => seekBy(-(d.seekOffset ?? 10)));
    set('seekforward', (d) => seekBy(d.seekOffset ?? 10));
    return () => {
      (
        [
          'play',
          'pause',
          'previoustrack',
          'nexttrack',
          'seekbackward',
          'seekforward',
        ] as MediaSessionAction[]
      ).forEach((t) => set(t, null));
      ms.playbackState = 'none';
    };
  }, []);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      playingRef.current = false;
      tokenRef.current++;
      stopAudioPrimitives();
      if (audioRef.current) {
        audioRef.current.removeAttribute('src');
        audioRef.current = null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      for (const url of urlCacheRef.current.values()) URL.revokeObjectURL(url);
      urlCacheRef.current.clear();
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
    exportMp3,
  };
}
