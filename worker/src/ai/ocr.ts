import type { Env } from '../types';

const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export async function ocrImages(env: Env, images: string[]) {
  const apiKey = env.GOOGLE_VISION_API_KEY ?? env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return { fallback: true as const };
  const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: images.map((content) => ({
        image: { content },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['ja'] },
      })),
    }),
  });
  if (!response.ok) throw new Error(`Google Vision error: ${response.status}`);
  const json = (await response.json()) as {
    responses?: { fullTextAnnotation?: { text?: string }; error?: { message?: string } }[];
  };
  const responses = json.responses ?? [];
  const error = responses.find((item) => item.error)?.error;
  if (error) throw new Error(`Google Vision error: ${error.message ?? 'unknown'}`);
  return {
    texts: responses.map((item) => item.fullTextAnnotation?.text ?? ''),
    fallback: false as const,
  };
}
