import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_VOICE } from '../constants/voices';
import { DEFAULT_SPEED_IDX, SPEED_STEPS } from '../constants/speeds';

interface SettingsState {
  voiceName: string;
  speedStepIdx: number;
  speakingRate: number;
  pitch: number;
  setVoice: (name: string) => void;
  setSpeedIdx: (idx: number) => void;
  setPitch: (pitch: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceName: DEFAULT_VOICE,
      speedStepIdx: DEFAULT_SPEED_IDX,
      speakingRate: SPEED_STEPS[DEFAULT_SPEED_IDX],
      pitch: 0.0,
      setVoice: (name) => set({ voiceName: name }),
      setSpeedIdx: (idx) => set({ speedStepIdx: idx, speakingRate: SPEED_STEPS[idx] }),
      setPitch: (pitch) => set({ pitch }),
    }),
    { name: 'bookreader_settings' },
  ),
);
