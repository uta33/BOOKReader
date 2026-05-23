import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_VOICE } from '../constants/voices';
import { DEFAULT_SPEED_IDX, SPEED_STEPS } from '../constants/speeds';

interface SettingsState {
  voiceName: string;
  speakingRate: number;
  pitch: number;
  speedStepIdx: number;
  setVoice: (name: string) => void;
  setSpeedIdx: (idx: number) => void;
  setPitch: (pitch: number) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

const STORAGE_KEY = 'bookreader_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  voiceName: DEFAULT_VOICE,
  speakingRate: SPEED_STEPS[DEFAULT_SPEED_IDX],
  pitch: 0.0,
  speedStepIdx: DEFAULT_SPEED_IDX,

  setVoice: (name) => {
    set({ voiceName: name });
    get().saveSettings();
  },
  setSpeedIdx: (idx) => {
    set({ speedStepIdx: idx, speakingRate: SPEED_STEPS[idx] });
    get().saveSettings();
  },
  setPitch: (pitch) => {
    set({ pitch });
    get().saveSettings();
  },

  loadSettings: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      set(parsed);
    }
  },

  saveSettings: async () => {
    const { voiceName, speakingRate, pitch, speedStepIdx } = get();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ voiceName, speakingRate, pitch, speedStepIdx }));
  },
}));
