// Vercel/Cloudflare-compatible serverless wrapper.
// Local development uses server/index.ts instead; both share server/lib.
// NOTE: '.js' extension is intentional even though the source is tts.ts —
// Vercel transpiles api/*.ts per-file (not bundled) and preserves the import
// specifier verbatim, so it must point at the post-compile output filename
// or Node's ESM loader throws ERR_MODULE_NOT_FOUND at runtime.
import { proxyWorker } from '../server/lib/workerProxy.js';

// Without this, Vercel falls back to its platform default (10s on Hobby),
// which a slow cold start + Google TTS round trip can exceed — the platform
// then kills the function and returns a bare 500 that bypasses our own
// try/catch below entirely (see src/services/api.ts's readError fallback).
export const config = { maxDuration: 30 };

interface Req {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  write: (chunk: Uint8Array) => void;
  end: () => void;
  json: (body: unknown) => void;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  await proxyWorker(req, res, '/api/tts');
}
