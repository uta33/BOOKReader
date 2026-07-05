import { useEffect, useRef } from 'react';
import { useBgmStore } from '../store/bgmStore';
import { usePlaybackStore } from '../store/playbackStore';

/** Looping ambient background sound bundled with the app. */
const BGM_URL = '/bgm/focus.mp3';

/**
 * App-wide background-music player. Mounted once; owns a single looping
 * <audio> element driven by the BGM store. Plays only while the reader is
 * narrating (so the ambient sound accompanies the read-aloud rather than
 * running constantly), mixing under the narration. Lives above the router so
 * it survives navigation.
 */
export function BgmPlayer() {
  const enabled = useBgmStore((s) => s.enabled);
  const volume = useBgmStore((s) => s.volume);
  const isNarrating = usePlaybackStore((s) => s.isNarrating);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const shouldPlay = enabled && isNarrating;

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

  // Follow narration: play while the reader is narrating, pause otherwise.
  // Narration starts from a user gesture (pressing play), so autoplay is
  // permitted; we still swallow a rejected play() defensively.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (shouldPlay) {
      audio.volume = volume;
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    // volume handled by its own effect; don't restart playback on volume change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPlay]);

  return null;
}
