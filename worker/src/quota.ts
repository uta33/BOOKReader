import { ApiError, isCheckConstraintError } from './errors';
import type { Env } from './types';

export type UsageKind = 'summary' | 'quiz' | 'tts' | 'ocr';

export interface UsageCharge {
  kind: UsageKind;
  units: number;
  microUsd: number;
}

export const DAILY_BUDGET_MICRO_USD = 2_000_000;
export const MONTHLY_BUDGET_MICRO_USD = 20_000_000;

export function utcBuckets(now = new Date()): { day: string; month: string } {
  const iso = now.toISOString();
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
}

export function estimateCharge(kind: UsageKind, units: number): number {
  if (kind === 'summary') return 100_000;
  if (kind === 'quiz') return 30_000;
  if (kind === 'tts') return Math.max(1, units) * 16;
  return Math.max(1, units) * 1_500;
}

export async function reserveUsage(
  env: Env,
  userId: string,
  charge: UsageCharge,
  now = new Date(),
): Promise<void> {
  const { day, month } = utcBuckets(now);
  const timestamp = now.getTime();
  const column =
    charge.kind === 'summary'
      ? 'summary_count'
      : charge.kind === 'quiz'
        ? 'quiz_count'
        : charge.kind === 'tts'
          ? 'tts_chars'
          : 'ocr_pages';

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO quota_daily
         (user_id, day, summary_count, quiz_count, tts_chars, ocr_pages, spend_microusd, updated_at)
         VALUES (?, ?, 0, 0, 0, 0, 0, ?)`,
      ).bind(userId, day, timestamp),
      env.DB.prepare(
        `INSERT OR IGNORE INTO budget_periods
         (period_type, bucket, spend_microusd, cap_microusd, updated_at)
         VALUES ('day', ?, 0, ?, ?)`,
      ).bind(day, DAILY_BUDGET_MICRO_USD, timestamp),
      env.DB.prepare(
        `INSERT OR IGNORE INTO budget_periods
         (period_type, bucket, spend_microusd, cap_microusd, updated_at)
         VALUES ('month', ?, 0, ?, ?)`,
      ).bind(month, MONTHLY_BUDGET_MICRO_USD, timestamp),
      env.DB.prepare(
        `UPDATE quota_daily
         SET ${column} = ${column} + ?, spend_microusd = spend_microusd + ?, updated_at = ?
         WHERE user_id = ? AND day = ?`,
      ).bind(charge.units, charge.microUsd, timestamp, userId, day),
      env.DB.prepare(
        `UPDATE budget_periods
         SET spend_microusd = spend_microusd + ?, updated_at = ?
         WHERE period_type = 'day' AND bucket = ?`,
      ).bind(charge.microUsd, timestamp, day),
      env.DB.prepare(
        `UPDATE budget_periods
         SET spend_microusd = spend_microusd + ?, updated_at = ?
         WHERE period_type = 'month' AND bucket = ?`,
      ).bind(charge.microUsd, timestamp, month),
    ]);
  } catch (error) {
    if (isCheckConstraintError(error)) {
      throw new ApiError(429, 'Daily quota or provider budget has been reached', 3_600);
    }
    throw error;
  }
}
