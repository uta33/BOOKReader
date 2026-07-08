/**
 * OCR for scanned-book PDFs via Google Cloud Vision DOCUMENT_TEXT_DETECTION,
 * which handles vertical Japanese (縦書き) reading order well. Uses the
 * Vision-specific key if set, otherwise the same Google API key as TTS
 * (enable "Cloud Vision API" for that key in Google Cloud Console).
 */

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

/** Pages per request — keeps request bodies well under platform limits. */
export const OCR_BATCH_LIMIT = 4;

export type OcrResult = { texts: string[]; fallback: false } | { fallback: true };

export async function ocrImages(images: string[]): Promise<OcrResult> {
  if (!Array.isArray(images) || images.length === 0) throw new Error('images are required');
  if (images.length > OCR_BATCH_LIMIT) {
    throw new Error(`images per request must be <= ${OCR_BATCH_LIMIT}`);
  }
  for (const img of images) {
    if (typeof img !== 'string' || !img) throw new Error('each image must be a base64 string');
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY ?? process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return { fallback: true };

  const body = {
    requests: images.map((content) => ({
      image: { content },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      imageContext: { languageHints: ['ja'] },
    })),
  };

  const res = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Vision error: ${res.status} ${err}`);
  }
  const json = (await res.json()) as {
    responses?: { fullTextAnnotation?: { text?: string }; error?: { message?: string } }[];
  };
  const responses = json.responses ?? [];
  const firstError = responses.find((r) => r.error)?.error;
  if (firstError) throw new Error(`Google Vision error: ${firstError.message ?? 'unknown'}`);
  return { texts: responses.map((r) => r.fullTextAnnotation?.text ?? ''), fallback: false };
}
