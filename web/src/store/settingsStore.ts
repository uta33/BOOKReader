import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_VOICE } from '../constants/voices';
import { DEFAULT_SPEED_IDX, SPEED_STEPS } from '../constants/speeds';

export type FontScale = 's' | 'm' | 'l';

interface SettingsState {
  voiceName: string;
  speedStepIdx: number;
  speakingRate: number;
  pitch: number;
  fontScale: FontScale;
  /** Obsidian vault name for obsidian:// export (empty = last-opened vault). */
  obsidianVault: string;
  setVoice: (name: string) => void;
  setSpeedIdx: (idx: number) => void;
  setPitch: (pitch: number) => void;
  setFontScale: (scale: FontScale) => void;
  setObsidianVault: (vault: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceName: DEFAULT_VOICE,
      speedStepIdx: DEFAULT_SPEED_IDX,
      speakingRate: SPEED_STEPS[DEFAULT_SPEED_IDX],
      pitch: 0.0,
      fontScale: 'm',
      obsidianVault: '',
      setVoice: (name) => set({ voiceName: name }),
      setSpeedIdx: (idx) => set({ speedStepIdx: idx, speakingRate: SPEED_STEPS[idx] }),
      setPitch: (pitch) => set({ pitch }),
      setFontScale: (fontScale) => set({ fontScale }),
      setObsidianVault: (obsidianVault) => set({ obsidianVault }),
    }),
    { name: 'bookreader_settings' },
  ),
);
