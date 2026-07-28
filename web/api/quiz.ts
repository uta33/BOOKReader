// Vercel serverless wrapper.
// Local development uses server/index.ts instead; both share server/lib.
// NOTE: '.js' extension is intentional — see api/tts.ts for why.
import { proxyWorker } from '../server/lib/workerProxy.js';

export const config = { maxDuration: 60 };

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
  await proxyWorker(req, res, '/api/quiz');
}
