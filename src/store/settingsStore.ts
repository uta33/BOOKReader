import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_VOICE } from '../constants/voices';
import { DEFAULT_SPEED_IDX, SPEED_STEPS } from '../constants/speeds';

interface SettingsState {
  voiceName: string;
  speakingRate: number;
  pitch: number;
  speedStepIdx: number;
  /** AI要約サーバーのベースURL。空なら要約機能を出さない。 */
  apiBaseUrl: string;
  /** Obsidian URIで送るVault名。空ならObsidianで最後に開いたVaultを使う。 */
  obsidianVault: string;
  setVoice: (name: string) => void;
  setSpeedIdx: (idx: number) => void;
  setPitch: (pitch: number) => void;
  setApiBaseUrl: (url: string) => void;
  setObsidianVault: (vault: string) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

const STORAGE_KEY = 'bookreader_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  voiceName: DEFAULT_VOICE,
  speakingRate: SPEED_STEPS[DEFAULT_SPEED_IDX],
  pitch: 0.0,
  speedStepIdx: DEFAULT_SPEED_IDX,
  apiBaseUrl: '',
  obsidianVault: '',

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
  setApiBaseUrl: (url) => {
    set({ apiBaseUrl: url });
    get().saveSettings();
  },
  setObsidianVault: (vault) => {
    set({ obsidianVault: vault });
    get().saveSettings();
  },

  loadSettings: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      set(parsed);
    }
  },

  // フィールドを明示的に列挙している。新しい設定を足すときはここにも
  // 追加しないと、loadSettings は素通しなので配線済みに見えたまま永続化されない。
  saveSettings: async () => {
    const { voiceName, speakingRate, pitch, speedStepIdx, apiBaseUrl, obsidianVault } = get();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voiceName, speakingRate, pitch, speedStepIdx, apiBaseUrl, obsidianVault }),
    );
  },
}));
