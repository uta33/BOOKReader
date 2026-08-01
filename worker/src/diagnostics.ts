import type { Env } from './types';

export const QUOTA_LIMITS = {
  summary: 20,
  quiz: 40,
  ttsChars: 100_000,
  ocrPages: 200,
} as const;

interface QuotaRow {
  day?: string;
  summary_count?: number;
  quiz_count?: number;
  tts_chars?: number;
  ocr_pages?: number;
  spend_microusd?: number;
}

export async function diagnosticsForUser(env: Env, userId: string, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const row = await env.DB.prepare(
    'SELECT * FROM quota_daily WHERE user_id = ? AND day = ?',
  ).bind(userId, day).first<QuotaRow>();
  return buildDiagnostics(env, row ?? {}, day);
}

export function buildDiagnostics(env: Env, row: QuotaRow, day: string) {
  const used = {
    summary: finiteCount(row.summary_count),
    quiz: finiteCount(row.quiz_count),
    ttsChars: finiteCount(row.tts_chars),
    ocrPages: finiteCount(row.ocr_pages),
  };
  const spendMicroUsd = finiteCount(row.spend_microusd);
  return {
    ok: true as const,
    checkedAt: Date.now(),
    services: {
      sync: true,
      summary: Boolean(env.ANTHROPIC_API_KEY),
      quiz: Boolean(env.ANTHROPIC_API_KEY),
      tts: Boolean(env.GOOGLE_TTS_API_KEY),
      ocr: Boolean(env.GOOGLE_VISION_API_KEY ?? env.GOOGLE_TTS_API_KEY),
      googleAuth: Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET),
    },
    quota: {
      day: row.day ?? day,
      used,
      limits: QUOTA_LIMITS,
      estimatedUsd: spendMicroUsd / 1_000_000,
    },
  };
}

function finiteCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}
