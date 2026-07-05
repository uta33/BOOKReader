import { create } from 'zustand';

interface PlaybackState {
  /** True while the reader is actively narrating (TTS or fallback speech). */
  isNarrating: boolean;
  setNarrating: (v: boolean) => void;
}

// Ephemeral (not persisted): reflects live playback so the BGM can follow it.
export const usePlaybackStore = create<PlaybackState>((set) => ({
  isNarrating: false,
  setNarrating: (isNarrating) => set({ isNarrating }),
}));
