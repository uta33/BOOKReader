import { create } from 'zustand';

interface ReaderState {
  currentBookId: string | null;
  currentSentenceIdx: number;
  isPlaying: boolean;
  isGenerating: boolean;
  generationProgress: number;
  generationTotal: number;
  setCurrentBook: (id: string) => void;
  setCurrentSentenceIdx: (idx: number) => void;
  setPlaying: (v: boolean) => void;
  setGenerating: (v: boolean, progress?: number, total?: number) => void;
  reset: () => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  currentBookId: null,
  currentSentenceIdx: 0,
  isPlaying: false,
  isGenerating: false,
  generationProgress: 0,
  generationTotal: 0,

  setCurrentBook: (id) => set({ currentBookId: id }),
  setCurrentSentenceIdx: (idx) => set({ currentSentenceIdx: idx }),
  setPlaying: (v) => set({ isPlaying: v }),
  setGenerating: (v, progress = 0, total = 0) =>
    set({ isGenerating: v, generationProgress: progress, generationTotal: total }),
  reset: () =>
    set({
      currentSentenceIdx: 0,
      isPlaying: false,
      isGenerating: false,
      generationProgress: 0,
      generationTotal: 0,
    }),
}));
