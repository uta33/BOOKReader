import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BgmState {
  /** Whether the looping background sound should play. */
  enabled: boolean;
  /** 0..1 playback volume for the background sound. */
  volume: number;
  setEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
}

export const useBgmStore = create<BgmState>()(
  persist(
    (set) => ({
      enabled: false,
      volume: 0.4,
      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume }),
    }),
    { name: 'bookreader_bgm' },
  ),
);
