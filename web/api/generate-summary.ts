import { proxyWorker } from '../server/lib/workerProxy.js';

export const config = {
  supportsResponseStreaming: true,
  maxDuration: 60,
};

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
  await proxyWorker(req, res, '/api/generate-summary');
}
