import { useEffect, useRef } from 'react';
import { useBgmStore } from '../store/bgmStore';

/** Looping ambient background sound bundled with the app. */
const BGM_URL = '/bgm/focus.mp3';

/**
 * App-wide background-music player. Mounted once; owns a single looping
 * <audio> element driven by the BGM store. Plays independently of the TTS
 * narration (both mix), and works across page navigation since it lives above
 * the router. Respects browser autoplay policy by retrying on the first user
 * gesture when play() is blocked.
 */
export function BgmPlayer() {
  const enabled = useBgmStore((s) => s.enabled);
  const volume = useBgmStore((s) => s.volume);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create the audio element once.
  useEffect(() => {
    const audio = new Audio(BGM_URL);
    audio.loop = true;
    audio.preload = 'none';
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // Live volume updates.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Play / pause following the enabled flag; recover from autoplay blocking.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!enabled) {
      audio.pause();
      return;
    }
    audio.volume = volume;
    const start = () => void audio.play().catch(() => {});
    audio.play().catch(() => {
      // Autoplay blocked until a user gesture — start on the next interaction.
      window.addEventListener('pointerdown', start, { once: true });
      window.addEventListener('keydown', start, { once: true });
    });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    // volume intentionally omitted: the effect above updates it live without
    // restarting playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return null;
}
