// Vercel/Cloudflare-compatible serverless wrapper.
// Local development uses server/index.ts instead; both share server/lib.
import { generateSummary } from '../server/lib/summary.ts';

interface Req {
  method?: string;
  body?: { topic?: string; guidance?: string };
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { topic, guidance } = req.body ?? {};
    const result = await generateSummary({ topic: topic ?? '', guidance });
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
