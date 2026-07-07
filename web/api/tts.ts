// Vercel/Cloudflare-compatible serverless wrapper.
// Local development uses server/index.ts instead; both share server/lib.
// NOTE: '.js' extension is intentional even though the source is tts.ts —
// Vercel transpiles api/*.ts per-file (not bundled) and preserves the import
// specifier verbatim, so it must point at the post-compile output filename
// or Node's ESM loader throws ERR_MODULE_NOT_FOUND at runtime.
import { synthesize, synthesizeChunk, type ChunkPart } from '../server/lib/tts.js';

// Without this, Vercel falls back to its platform default (10s on Hobby),
// which a slow cold start + Google TTS round trip can exceed — the platform
// then kills the function and returns a bare 500 that bypasses our own
// try/catch below entirely (see src/services/api.ts's readError fallback).
export const config = { maxDuration: 30 };

interface Req {
  method?: string;
  body?: {
    text?: string;
    parts?: ChunkPart[];
    voiceName?: string;
    speakingRate?: number;
    pitch?: number;
  };
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
    const { text, parts, voiceName, speakingRate, pitch } = req.body ?? {};
    // Chunk mode: one continuous utterance with per-sentence timepoints.
    const result = parts
      ? await synthesizeChunk({
          parts,
          voiceName: voiceName ?? 'ja-JP-Neural2-B',
          pitch: pitch ?? 0.0,
        })
      : await synthesize({
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
