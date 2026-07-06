/**
 * Pure helpers for the daily learning-activity log (habit loop support):
 * streak computation, lifetime totals, and the activity-calendar grid.
 */

export interface DayStats {
  /** Total narration listening time that day. */
  listenMs: number;
  /** Review items graded that day. */
  reviews: number;
  /** Recaps written that day. */
  recaps: number;
}

/** Keyed by local-time 'YYYY-MM-DD'. */
export type DayMap = Record<string, DayStats>;

export const EMPTY_DAY: DayStats = { listenMs: 0, reviews: 0, recaps: 0 };

/** Daily listening goal shown on the Home checklist. */
export const DAILY_LISTEN_GOAL_MS = 15 * 60 * 1000;

/** Minimum listening that counts a day as "active" for the streak. */
export const ACTIVE_LISTEN_MS = 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-time calendar key, e.g. '2026-07-06'. */
export function dayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isActiveDay(day: DayStats | undefined): boolean {
  if (!day) return false;
  return day.listenMs >= ACTIVE_LISTEN_MS || day.reviews > 0 || day.recaps > 0;
}

/**
 * Consecutive active days ending today. A not-yet-active today does NOT break
 * the streak (the user still has the rest of the day) — counting then starts
 * from yesterday.
 */
export function computeStreak(days: DayMap, today = new Date()): number {
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let streak = 0;
  if (isActiveDay(days[dayKey(cursor)])) streak++;
  // Walk backwards from yesterday regardless of today's state.
  for (;;) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!isActiveDay(days[dayKey(cursor)])) break;
    streak++;
  }
  return streak;
}

export interface Totals {
  listenMin: number;
  reviews: number;
  recaps: number;
  activeDays: number;
}

export function totals(days: DayMap): Totals {
  let listenMs = 0;
  let reviews = 0;
  let recaps = 0;
  let activeDays = 0;
  for (const d of Object.values(days)) {
    listenMs += d.listenMs;
    reviews += d.reviews;
    recaps += d.recaps;
    if (isActiveDay(d)) activeDays++;
  }
  return { listenMin: Math.round(listenMs / 60000), reviews, recaps, activeDays };
}

export interface CalendarCell {
  key: string;
  /** 0 = no activity … 3 = heavy day. */
  level: 0 | 1 | 2 | 3;
  isToday: boolean;
  /** Days after today in the current week (rendered blank). */
  isFuture: boolean;
}

/** Activity intensity: listening weighted against the daily goal. */
function levelOf(day: DayStats | undefined): 0 | 1 | 2 | 3 {
  if (!day) return 0;
  const score = day.listenMs / DAILY_LISTEN_GOAL_MS + day.reviews / 10 + day.recaps / 2;
  if (score <= 0) return 0;
  if (score < 0.34) return 1;
  if (score < 1) return 2;
  return 3;
}

/**
 * Grid for the GitHub-style activity calendar: `weeks` columns of 7 cells
 * (Sunday-first), the last column being the current week.
 */
export function calendarWeeks(days: DayMap, weeks = 12, today = new Date()): CalendarCell[][] {
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayKeyStr = dayKey(todayMid);
  // Sunday of the current week, then back (weeks-1) more weeks.
  const start = new Date(todayMid.getTime() - todayMid.getDay() * DAY_MS - (weeks - 1) * 7 * DAY_MS);
  const grid: CalendarCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS);
      const key = dayKey(date);
      col.push({
        key,
        level: levelOf(days[key]),
        isToday: key === todayKeyStr,
        isFuture: date.getTime() > todayMid.getTime(),
      });
    }
    grid.push(col);
  }
  return grid;
}
