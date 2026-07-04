// Vercel serverless wrapper (streaming).
// Local development uses server/index.ts instead; both share server/lib.
// NOTE: '.js' extension is intentional — see api/tts.ts for why.
import { generateSummaryStream } from '../server/lib/summary.js';

export const config = {
  supportsResponseStreaming: true,
  maxDuration: 60,
};

interface Req {
  method?: string;
  body?: { topic?: string; guidance?: string };
}
interface Res {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => void;
  end: () => void;
  json: (body: unknown) => void;
  headersSent?: boolean;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { topic, guidance } = req.body ?? {};
  try {
    const stream = generateSummaryStream({ topic: topic ?? '', guidance });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    } else {
      res.end();
    }
  }
}
