// Vercel/Cloudflare-compatible serverless wrapper.
// Local development uses server/index.ts instead; both share server/lib.
import { synthesize } from '../server/lib/tts.ts';

interface Req {
  method?: string;
  body?: { text?: string; voiceName?: string; speakingRate?: number; pitch?: number };
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
    const { text, voiceName, speakingRate, pitch } = req.body ?? {};
    const result = await synthesize({
      text: text ?? '',
      voiceName: voiceName ?? 'ja-JP-Neural2-B',
      speakingRate: speakingRate ?? 1.0,
      pitch: pitch ?? 0.0,
    });
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
