// Vercel serverless wrapper.
// Local development uses server/index.ts instead; both share server/lib.
// NOTE: '.js' extension is intentional — see api/tts.ts for why.
import { generateQuiz } from '../server/lib/quiz.js';

export const config = { maxDuration: 60 };

interface Req {
  method?: string;
  body?: { script?: string };
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
    const result = await generateQuiz(req.body?.script ?? '');
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
