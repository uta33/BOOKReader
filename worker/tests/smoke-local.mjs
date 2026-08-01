import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const port = process.env.BOOKREADER_SMOKE_PORT ?? '8798';
const externalBaseUrl = process.env.BOOKREADER_SMOKE_BASE_URL?.replace(/\/+$/, '');
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`;
const localTestIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
const anonymousHeaders = {
  'Content-Type': 'application/json',
  ...(externalBaseUrl ? {} : { 'CF-Connecting-IP': localTestIp }),
};
const workerDirectory = fileURLToPath(new URL('..', import.meta.url));
const wranglerCli = fileURLToPath(
  new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
);
const child = externalBaseUrl
  ? null
  : spawn(process.execPath, [wranglerCli, 'dev', '--local', '--port', port], {
      cwd: workerDirectory,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

let log = '';
if (child) {
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      log = `${log}${chunk}`.slice(-12_000);
    });
  }
}

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request(path, init = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(
      `${init.method ?? 'GET'} ${path}: expected ${expectedStatus}, got ${response.status}: ${text}`,
    );
  }
  const contentType = response.headers.get('content-type') ?? '';
  return {
    response,
    body: contentType.includes('application/json') && text ? JSON.parse(text) : text,
  };
}

async function waitForWorker() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child && child.exitCode !== null) {
      throw new Error(`wrangler exited before becoming ready\n${log}`);
    }
    try {
      const { body } = await request('/v1/health');
      if (body.ok === true) return body;
    } catch {
      // Wrangler can accept a connection before the Worker has finished loading.
    }
    await sleep(200);
  }
  throw new Error(`Worker did not become ready\n${log}`);
}

async function stopWorker() {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), sleep(3_000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

try {
  const health = await waitForWorker();
  const runId = randomUUID();
  const anonymous = await request(
    '/v1/auth/anonymous',
    {
      method: 'POST',
      headers: anonymousHeaders,
      body: '{}',
    },
    201,
  );
  const token = anonymous.body.token;
  const authorization = { Authorization: `Bearer ${token}` };
  const account = await request('/v1/account', { headers: authorization });
  if (account.body.auth !== 'anonymous') throw new Error('Expected an anonymous account');

  const now = Date.now();
  const attachmentId = `smoke-attachment-${runId}`;
  const dogEarId = `smoke-dog-${runId}`;
  const syncPayload = {
    since: 0,
    changes: [
      {
        entity: 'book',
        id: `smoke-book-${runId}`,
        data: {
          title: 'Smoke Test',
          kind: 'paper',
          lastSentenceIdx: 3,
          createdAt: now,
        },
        updatedAt: now,
        originDeviceId: `smoke-device-${runId}`,
      },
      {
        entity: 'dogEar',
        id: dogEarId,
        bookId: `smoke-book-${runId}`,
        data: {
          page: 12,
          quote: '同期テスト',
          createdAt: now,
          reviewLevel: 2,
          nextReviewAt: now + 86_400_000,
          photoAttachmentId: attachmentId,
        },
        updatedAt: now,
        originDeviceId: `smoke-device-${runId}`,
      },
    ],
  };
  const sync = await request('/v1/sync', {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(syncPayload),
  });
  if (sync.body.cursor < 2 || sync.body.changes.length < 2) {
    throw new Error('Sync did not return both pushed records');
  }

  // APIのバイト往復を確認する最小fixture。画像デコード自体はクライアント側の責務。
  const imageBytes = new Uint8Array([80, 78, 71, 1, 2, 3, 4]);
  const uploaded = await request(
    `/v1/attachments/${attachmentId}`,
    {
      method: 'PUT',
      headers: {
        ...authorization,
        'Content-Type': 'image/png',
        'X-Dog-Ear-Id': dogEarId,
      },
      body: imageBytes,
    },
    201,
  );
  if (uploaded.body.sizeBytes !== imageBytes.byteLength) {
    throw new Error('Attachment upload size was not recorded');
  }
  const downloaded = await request(`/v1/attachments/${attachmentId}`, {
    headers: authorization,
  });
  if (
    downloaded.response.headers.get('content-type') !== 'image/png' ||
    !Buffer.from(downloaded.body, 'latin1').equals(Buffer.from(imageBytes))
  ) {
    throw new Error('Attachment download did not preserve content');
  }
  const diagnostics = await request('/v1/diagnostics', { headers: authorization });
  if (diagnostics.body.services.attachments !== true) {
    throw new Error('Diagnostics did not report image backup');
  }
  await request(`/v1/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: authorization,
  });
  await request(`/v1/attachments/${attachmentId}`, { headers: authorization }, 404);
  await request(
    `/v1/attachments/${attachmentId}`,
    {
      method: 'PUT',
      headers: {
        ...authorization,
        'Content-Type': 'image/png',
        'X-Dog-Ear-Id': dogEarId,
      },
      body: imageBytes,
    },
    201,
  );

  const secondDevice = await request('/v1/sync', {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      since: sync.body.cursor,
      changes: [
        {
          entity: 'book',
          id: `smoke-book-${runId}`,
          data: {
            title: 'Newer Device Title',
            kind: 'paper',
            lastSentenceIdx: 10,
            createdAt: now,
          },
          updatedAt: now + 10,
          originDeviceId: `smoke-device-b-${runId}`,
        },
        {
          entity: 'dogEar',
          id: `smoke-dog-b-${runId}`,
          bookId: `smoke-book-${runId}`,
          data: { page: 13, quote: '別端末の抜き書き', createdAt: now + 10 },
          updatedAt: now + 10,
          originDeviceId: `smoke-device-b-${runId}`,
        },
      ],
    }),
  });
  const stalePosition = await request('/v1/sync', {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      since: secondDevice.body.cursor,
      changes: [
        {
          entity: 'book',
          id: `smoke-book-${runId}`,
          data: {
            title: 'Stale Device Title',
            kind: 'paper',
            lastSentenceIdx: 20,
            createdAt: now,
          },
          updatedAt: now + 5,
          originDeviceId: `smoke-device-a-${runId}`,
        },
      ],
    }),
  });
  const canonicalBook = stalePosition.body.changes.find(
    (change) => change.entity === 'book' && change.id === `smoke-book-${runId}`,
  );
  if (
    canonicalBook?.data.title !== 'Newer Device Title' ||
    canonicalBook?.data.lastSentenceIdx !== 20
  ) {
    throw new Error('LWW or lastSentenceIdx MAX conflict resolution failed');
  }
  const fullSnapshot = await request('/v1/sync', {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ since: 0, changes: [], forceFull: true }),
  });
  if (
    fullSnapshot.body.fullResync !== true ||
    fullSnapshot.body.changes.filter((change) => change.entity === 'dogEar').length !== 2
  ) {
    throw new Error('Forced snapshot or two-device dog-ear union failed');
  }

  const tts = await request('/api/tts', {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'テスト' }),
  });
  if (tts.body.fallback !== true) throw new Error('TTS fallback contract changed');

  const oversized = await request(
    '/api/generate-summary',
    {
      method: 'POST',
      headers: {
        ...authorization,
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ topic: 'a'.repeat(201) }),
    },
    400,
  );
  if (typeof oversized.body.error !== 'string') {
    throw new Error('Validation errors must use the { error } contract');
  }
  if (
    oversized.response.headers.get('access-control-allow-origin') !==
    'http://localhost:5173'
  ) {
    throw new Error('CORS headers were missing from an allowed-origin error response');
  }
  for (let index = 0; index < 20; index += 1) {
    await request('/api/generate-summary', {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: `quota-smoke-${index}` }),
    });
  }
  const quotaExceeded = await request(
    '/api/generate-summary',
    {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'quota-smoke-over-limit' }),
    },
    429,
  );
  if (
    typeof quotaExceeded.body.error !== 'string' ||
    !quotaExceeded.response.headers.has('retry-after')
  ) {
    throw new Error('Quota rejection did not preserve the error and Retry-After contract');
  }

  const ticket = await request('/v1/account/deletion-ticket', {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (typeof ticket.body.ticket !== 'string') throw new Error('Deletion ticket not issued');

  const cors = await request(
    '/v1/health',
    {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    },
    204,
  );
  if (cors.response.headers.get('access-control-allow-origin') !== 'http://localhost:5173') {
    throw new Error('Allowed CORS origin was not echoed');
  }
  const sameOrigin = new URL(baseUrl).origin;
  const sameOriginCors = await request(
    '/account/delete',
    {
      method: 'OPTIONS',
      headers: {
        Origin: sameOrigin,
        'Access-Control-Request-Method': 'POST',
      },
    },
    204,
  );
  if (sameOriginCors.response.headers.get('access-control-allow-origin') !== sameOrigin) {
    throw new Error('Worker public forms must allow their own origin');
  }

  await request(
    '/v1/auth/signout',
    { method: 'POST', headers: authorization },
    409,
  );

  const deleted = await request('/v1/account', {
    method: 'DELETE',
    headers: authorization,
  });
  if (deleted.body.deleted !== true) {
    throw new Error('Account deletion did not confirm physical deletion');
  }
  const revoked = await request('/v1/account', { headers: authorization }, 401);
  if (typeof revoked.body.error !== 'string') {
    throw new Error('Authentication errors must use the { error } contract');
  }

  const webDeleteAccount = await request(
    '/v1/auth/anonymous',
    {
      method: 'POST',
      headers: anonymousHeaders,
      body: '{}',
    },
    201,
  );
  const webDeleteAuthorization = {
    Authorization: `Bearer ${webDeleteAccount.body.token}`,
  };
  const webDeleteTicket = await request('/v1/account/deletion-ticket', {
    method: 'POST',
    headers: { ...webDeleteAuthorization, 'Content-Type': 'application/json' },
    body: '{}',
  });
  await request('/account/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: sameOrigin,
    },
    body: new URLSearchParams({ ticket: webDeleteTicket.body.ticket }),
  });
  await request('/v1/account', { headers: webDeleteAuthorization }, 401);

  console.log(
    JSON.stringify(
      {
        health: health.ok,
        auth: account.body.auth,
        syncCursor: sync.body.cursor,
        syncChanges: fullSnapshot.body.changes.length,
        lwwAndReadingPositionMax: true,
        twoDeviceDogEarUnion: true,
        attachmentUploadDownloadDelete: true,
        diagnosticsAttachments: true,
        ttsFallback: tts.body.fallback,
        summaryQuota: '20 accepted, 21st rejected',
        deletionTicket: true,
        accountDeleteRevokedOldToken: true,
        anonymousSignOutRejected: true,
        webDeletionRemovedAccount: true,
        sameOriginFormsAllowed: true,
        cors: 204,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (log.trim()) console.error(log);
  process.exitCode = 1;
} finally {
  await stopWorker();
}
