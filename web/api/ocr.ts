// Vercel/Cloudflare-compatible serverless wrapper.
// Local development uses server/index.ts instead; both share server/lib.
// NOTE: '.js' extension is intentional even though the source is ocr.ts —
// Vercel transpiles api/*.ts per-file (not bundled) and preserves the import
// specifier verbatim, so it must point at the post-compile output filename
// or Node's ESM loader throws ERR_MODULE_NOT_FOUND at runtime.
import { ocrImages } from '../server/lib/ocr.js';

// A batch of page images through Cloud Vision can take a while — well past
// Vercel's 10s Hobby default.
export const config = { maxDuration: 60 };

interface Req {
  method?: string;
  body?: { images?: string[] };
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
    const result = await ocrImages(req.body?.images ?? []);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
