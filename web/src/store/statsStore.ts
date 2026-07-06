import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPTY_DAY, dayKey, type DayMap, type DayStats } from '../services/stats';

/** Ignore glitchy sub-second flushes and clamp absurd sessions (clock jumps). */
const MIN_LISTEN_MS = 500;
const MAX_LISTEN_MS = 6 * 60 * 60 * 1000;

interface StatsState {
  days: DayMap;
  addListen: (ms: number) => void;
  addReview: () => void;
  addRecap: () => void;
}

function bumpToday(days: DayMap, patch: (d: DayStats) => DayStats): DayMap {
  const key = dayKey();
  return { ...days, [key]: patch(days[key] ?? EMPTY_DAY) };
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      days: {},
      addListen: (ms) => {
        if (!Number.isFinite(ms) || ms < MIN_LISTEN_MS) return;
        const clamped = Math.min(ms, MAX_LISTEN_MS);
        set((s) => ({
          days: bumpToday(s.days, (d) => ({ ...d, listenMs: d.listenMs + clamped })),
        }));
      },
      addReview: () =>
        set((s) => ({ days: bumpToday(s.days, (d) => ({ ...d, reviews: d.reviews + 1 })) })),
      addRecap: () =>
        set((s) => ({ days: bumpToday(s.days, (d) => ({ ...d, recaps: d.recaps + 1 })) })),
    }),
    { name: 'bookreader_stats' },
  ),
);
