import { Hono } from 'hono';
import { createAnonymous, requireAuth } from './auth';
import { ApiError, errorResponse, readJson, readText } from './errors';
import {
  LIMITS,
  optionalText,
  requireText,
  validateNoteExcerpts,
  validateOcrImages,
  validatePurposes,
  validateTtsParts,
} from './limits';
import { estimateCharge, reserveBookCoverSearch, reserveUsage } from './quota';
import type { Env, WorkerVariables } from './types';
import { generateSummaryStream } from './ai/summary';
import { generateNoteSummary, generateRecapQuestions, type NoteInput } from './ai/note';
import { generateQuiz } from './ai/quiz';
import { synthesize, synthesizeChunk } from './ai/tts';
import { ocrImages } from './ai/ocr';
import { pruneExpiredTombstones, syncUser } from './sync';
import {
  completeGoogleLink,
  handleGoogleCallback,
  resolveGoogleConflict,
  startWebDeletion,
  confirmWebDeletion,
  startGoogleLink,
} from './oauth';
import {
  createDeletionTicket,
  deleteAccount,
  deleteWithTicket,
  deletionPage,
  privacyPage,
  publicHome,
  signOut,
} from './account';
import { diagnosticsForUser } from './diagnostics';
import { deleteAttachment, getAttachment, putAttachment } from './attachments';
import { searchGoogleBookCovers } from './bookCovers';

type AppEnv = { Bindings: Env; Variables: WorkerVariables };
const app = new Hono<AppEnv>();

function allowedOrigins(env: Env): Set<string> {
  return new Set(
    (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function isAllowedOrigin(env: Env, requestUrl: string, origin: string): boolean {
  return origin === new URL(requestUrl).origin || allowedOrigins(env).has(origin);
}

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowed = origin ? isAllowedOrigin(c.env, c.req.url, origin) : false;
  if (origin && !allowed) throw new ApiError(403, 'Origin is not allowed');
  if (c.req.method === 'OPTIONS') {
    const headers = new Headers({
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Dog-Ear-Id',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    });
    if (origin && allowed) headers.set('Access-Control-Allow-Origin', origin);
    return new Response(null, { status: 204, headers });
  }
  await next();
  c.header('Vary', 'Origin');
  if (origin && allowed) c.header('Access-Control-Allow-Origin', origin);
});

app.onError((error, c) => {
  if (!(error instanceof ApiError)) console.error('request_failed', error);
  const response = errorResponse(error);
  const origin = c.req.header('Origin');
  if (origin && isAllowedOrigin(c.env, c.req.url, origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }
  return response;
});

app.notFound(() => errorResponse(new ApiError(404, 'Not found')));

app.get('/v1/health', (c) =>
  c.json({
    ok: true,
    service: 'bookreader-api',
    apiVersion: 1,
  }),
);
app.get('/', () => publicHome());
app.get('/privacy', (c) => privacyPage(c.env.PRIVACY_CONTACT_EMAIL));

app.post('/v1/auth/anonymous', async (c) => {
  const result = await createAnonymous(c.req.raw, c.env);
  return c.json(result, 201);
});

app.get('/v1/auth/google/callback', (c) =>
  handleGoogleCallback(c.env, new URL(c.req.url)),
);
app.use('/v1/auth/google/start', requireAuth);
app.use('/v1/auth/google/complete', requireAuth);
app.use('/v1/auth/google/resolve', requireAuth);
app.use('/v1/auth/signout', requireAuth);
app.use('/v1/account', requireAuth);
app.use('/v1/account/*', requireAuth);
app.use('/v1/sync', requireAuth);
app.use('/v1/note-summary', requireAuth);
app.use('/v1/recap-questions', requireAuth);
app.use('/v1/diagnostics', requireAuth);
app.use('/v1/attachments/*', requireAuth);
app.use('/v1/books/*', requireAuth);
app.use('/api/*', requireAuth);

app.get('/v1/account', async (c) => {
  const user = c.get('user');
  const now = new Date().toISOString().slice(0, 10);
  const [identity, bookCount, quota] = await c.env.DB.batch([
    c.env.DB.prepare(
      'SELECT google_sub, email FROM google_identities WHERE user_id = ?',
    ).bind(user.id),
    c.env.DB.prepare(
      'SELECT COUNT(*) AS count FROM books WHERE user_id = ? AND deleted_at IS NULL',
    ).bind(user.id),
    c.env.DB.prepare('SELECT * FROM quota_daily WHERE user_id = ? AND day = ?').bind(user.id, now),
  ]);
  const identityRow = identity.results[0] as
    | { google_sub: string; email?: string }
    | undefined;
  const email = identityRow?.email;
  const count = Number((bookCount.results[0] as { count?: number } | undefined)?.count ?? 0);
  return c.json({
    userId: user.id,
    auth: identityRow ? 'google' : 'anonymous',
    email,
    bookCount: count,
    quota: quota.results[0] ?? {
      day: now,
      summary_count: 0,
      quiz_count: 0,
      tts_chars: 0,
      ocr_pages: 0,
      cover_search_count: 0,
    },
  });
});

app.get('/v1/diagnostics', async (c) =>
  c.json(await diagnosticsForUser(c.env, c.get('user').id)),
);

app.put('/v1/attachments/:id', async (c) =>
  c.json(await putAttachment(c.env, c.get('user').id, c.req.param('id'), c.req.raw), 201),
);
app.get('/v1/attachments/:id', (c) =>
  getAttachment(c.env, c.get('user').id, c.req.param('id')),
);
app.delete('/v1/attachments/:id', async (c) =>
  c.json(await deleteAttachment(c.env, c.get('user').id, c.req.param('id'))),
);

app.get('/v1/books/covers', async (c) => {
  const isbn = optionalText(c.req.query('isbn'), 'isbn', 32);
  const title = optionalText(c.req.query('title'), 'title', 200);
  const author = optionalText(c.req.query('author'), 'author', 200);
  if (!isbn && !title) throw new ApiError(400, 'isbn or title is required');
  await reserveBookCoverSearch(c.env, c.get('user').id);
  return c.json({
    candidates: await searchGoogleBookCovers(
      c.env,
      { isbn, title, author },
      c.req.raw.signal,
    ),
  });
});

app.post('/v1/sync', async (c) => {
  const body = await readJson<{
    since?: unknown;
    changes?: unknown;
    forceFull?: unknown;
  }>(c.req.raw, 7_000_000);
  const since =
    typeof body.since === 'number' && Number.isSafeInteger(body.since) ? body.since : -1;
  if (!Array.isArray(body.changes)) throw new ApiError(400, 'changes must be an array');
  if (body.forceFull !== undefined && typeof body.forceFull !== 'boolean') {
    throw new ApiError(400, 'forceFull must be a boolean');
  }
  return c.json(
    await syncUser(c.env, c.get('user').id, since, body.changes, body.forceFull === true),
  );
});

app.post('/v1/auth/google/start', async (c) => {
  const body = await readJson<{ ticket?: unknown }>(c.req.raw, 2_000);
  return c.json(await startGoogleLink(c.env, c.get('user'), body.ticket));
});

app.post('/v1/auth/google/complete', async (c) => {
  const body = await readJson<{ ticket?: unknown }>(c.req.raw, 2_000);
  const result = await completeGoogleLink(c.env, c.get('user'), body.ticket);
  return c.json(result, result.status === 'pending' ? 202 : 200);
});

app.post('/v1/auth/google/resolve', async (c) => {
  const body = await readJson<{ conflictId?: unknown; choice?: unknown }>(c.req.raw, 2_000);
  return c.json(
    await resolveGoogleConflict(
      c.env,
      c.get('user'),
      body.conflictId,
      body.choice,
    ),
  );
});

app.post('/v1/auth/signout', async (c) =>
  c.json(await signOut(c.req.raw, c.env, c.get('user'))),
);

app.post('/v1/account/deletion-ticket', async (c) =>
  c.json(await createDeletionTicket(c.env, c.get('user'))),
);

app.delete('/v1/account', async (c) => c.json(await deleteAccount(c.env, c.get('user'))));

app.get('/account/delete', () => deletionPage());
app.get('/account/delete/google/start', (c) => startWebDeletion(c.req.raw, c.env));
app.post('/account/delete/google/confirm', async (c) => {
  try {
    await confirmWebDeletion(c.env, await readFormField(c.req.raw, 'confirmation'));
    return deletionPage('アカウントとクラウドデータを削除しました。');
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '削除に失敗しました。';
    return deletionPage(message);
  }
});
app.post('/account/delete', async (c) => {
  try {
    await deleteWithTicket(c.env, await readFormField(c.req.raw, 'ticket'));
    return deletionPage('アカウントとクラウドデータを削除しました。');
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '削除に失敗しました。';
    return deletionPage(message);
  }
});

/**
 * マガジンノート用のリクエストを組み立てる。
 * `/api/generate-summary`（朗読台本）と違い、利用者自身の抜き書きを主材料にする。
 */
async function readNoteInput(request: Request): Promise<NoteInput> {
  const body = await readJson<Record<string, unknown>>(request, 200_000);
  return {
    title: requireText(body.title, 'title', LIMITS.topic),
    author: optionalText(body.author, 'author', LIMITS.topic),
    publisher: optionalText(body.publisher, 'publisher', LIMITS.topic),
    pubdate: optionalText(body.pubdate, 'pubdate', 64),
    isbn: optionalText(body.isbn, 'isbn', 32),
    blurb: optionalText(body.blurb, 'blurb', LIMITS.blurb),
    excerpts: validateNoteExcerpts(body.excerpts),
    purposes: validatePurposes(body.purposes),
  };
}

app.post('/v1/note-summary', async (c) => {
  const input = await readNoteInput(c.req.raw);
  const user = c.get('user');

  // 材料が無ければモデルを呼ばない。呼ばないのでクォータも減らさない。
  // 「書けません」と答えることが、書名から創作するより正しい。
  if (input.excerpts.length === 0 && !input.blurb) {
    return c.json({ body: '', grounded: 'none', excerptCount: 0 });
  }

  // 鍵が無いのは「材料が無い」のとは別の理由。同じ 'none' で返すと、
  // アプリが「抜き書きを足してください」という的外れな案内を出してしまう。
  if (!c.env.ANTHROPIC_API_KEY) throw new ApiError(503, 'AI要約はこのサーバーでは使えません');

  await reserveUsage(c.env, user.id, {
    kind: 'summary',
    units: 1,
    microUsd: estimateCharge('summary', 1),
  });
  try {
    return c.json(await generateNoteSummary(c.env, input));
  } catch {
    throw new ApiError(502, 'Summary provider request failed');
  }
});

app.post('/v1/recap-questions', async (c) => {
  const input = await readNoteInput(c.req.raw);
  if (input.excerpts.length === 0) return c.json({ questions: [] });

  if (!c.env.ANTHROPIC_API_KEY) throw new ApiError(503, 'AI要約はこのサーバーでは使えません');

  // 短い設問生成なので quiz の枠で計上する。quota_daily の列は固定
  // （summary_count / quiz_count / tts_chars / ocr_pages / cover_search_count）で、
  // 種別を増やすとマイグレーションが要るため。用途も /api/quiz と同質。
  await reserveUsage(c.env, c.get('user').id, {
    kind: 'quiz',
    units: 1,
    microUsd: estimateCharge('quiz', 1),
  });
  try {
    return c.json(await generateRecapQuestions(c.env, input));
  } catch {
    throw new ApiError(502, 'Summary provider request failed');
  }
});

app.post('/api/generate-summary', async (c) => {
  const body = await readJson<{ topic?: unknown; guidance?: unknown }>(c.req.raw, 20_000);
  const topic = requireText(body.topic, 'topic', LIMITS.topic);
  const guidance = optionalText(body.guidance, 'guidance', LIMITS.guidance);
  const user = c.get('user');
  const microUsd = c.env.ANTHROPIC_API_KEY ? estimateCharge('summary', 1) : 0;
  await reserveUsage(c.env, user.id, { kind: 'summary', units: 1, microUsd });

  const generator = generateSummaryStream(c.env, { topic, guidance });
  let first: IteratorResult<string>;
  try {
    first = await generator.next();
  } catch {
    throw new ApiError(502, 'Summary provider request failed');
  }
  if (first.done || !first.value) throw new ApiError(502, 'Summary provider returned no content');

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(first.value));
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        console.error('summary_stream_failed', error);
        controller.error(error);
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});

app.post('/api/quiz', async (c) => {
  const body = await readJson<{ script?: unknown }>(c.req.raw, 30_000);
  const script = requireText(body.script, 'script', LIMITS.quizScript);
  const user = c.get('user');
  const microUsd = c.env.ANTHROPIC_API_KEY ? estimateCharge('quiz', 1) : 0;
  await reserveUsage(c.env, user.id, { kind: 'quiz', units: 1, microUsd });
  try {
    return c.json(await generateQuiz(c.env, script));
  } catch {
    throw new ApiError(502, 'Quiz provider request failed');
  }
});

app.post('/api/tts', async (c) => {
  const body = await readJson<Record<string, unknown>>(c.req.raw, 100_000);
  const voiceName = optionalText(body.voiceName, 'voiceName', 128) ?? 'ja-JP-Neural2-B';
  const pitch = finiteNumber(body.pitch, 0, -20, 20);
  const user = c.get('user');

  if (Object.prototype.hasOwnProperty.call(body, 'parts')) {
    const { parts, totalChars } = validateTtsParts(body.parts);
    const microUsd = c.env.GOOGLE_TTS_API_KEY ? estimateCharge('tts', totalChars) : 0;
    await reserveUsage(c.env, user.id, {
      kind: 'tts',
      units: totalChars,
      microUsd,
    });
    try {
      return c.json(await synthesizeChunk(c.env, { parts, voiceName, pitch }));
    } catch {
      throw new ApiError(502, 'TTS provider request failed');
    }
  }

  const text = requireText(body.text, 'text', LIMITS.ttsText);
  const speakingRate = finiteNumber(body.speakingRate, 1, 0.25, 4);
  const microUsd = c.env.GOOGLE_TTS_API_KEY ? estimateCharge('tts', text.length) : 0;
  await reserveUsage(c.env, user.id, {
    kind: 'tts',
    units: text.length,
    microUsd,
  });
  try {
    return c.json(await synthesize(c.env, { text, voiceName, speakingRate, pitch }));
  } catch {
    throw new ApiError(502, 'TTS provider request failed');
  }
});

app.post('/api/ocr', async (c) => {
  const body = await readJson<{ images?: unknown }>(c.req.raw);
  const images = validateOcrImages(body.images);
  const user = c.get('user');
  const hasKey = Boolean(c.env.GOOGLE_VISION_API_KEY ?? c.env.GOOGLE_TTS_API_KEY);
  await reserveUsage(c.env, user.id, {
    kind: 'ocr',
    units: images.length,
    microUsd: hasKey ? estimateCharge('ocr', images.length) : 0,
  });
  try {
    return c.json(await ocrImages(c.env, images));
  } catch {
    throw new ApiError(502, 'OCR provider request failed');
  }
});

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ApiError(400, `numeric value must be between ${min} and ${max}`);
  }
  return value;
}

async function readFormField(request: Request, field: string): Promise<string | null> {
  const text = await readText(request, 4_096);
  return new URLSearchParams(text).get(field);
}

export default {
  fetch: app.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(pruneExpiredTombstones(env));
  },
};
