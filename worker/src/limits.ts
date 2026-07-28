import { ApiError } from './errors';

export const LIMITS = {
  topic: 200,
  guidance: 1_000,
  quizScript: 12_000,
  ttsText: 5_000,
  ttsParts: 100,
  ocrImages: 4,
  ocrBase64Bytes: 1_500_000,
  syncPush: 100,
  syncPull: 500,
} as const;

export function requireText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${field} is required`);
  }
  const text = value.trim();
  if (text.length > max) {
    throw new ApiError(400, `${field} must be <= ${max} characters`);
  }
  return text;
}

export function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new ApiError(400, `${field} must be a string`);
  const text = value.trim();
  if (text.length > max) {
    throw new ApiError(400, `${field} must be <= ${max} characters`);
  }
  return text || undefined;
}

export interface TtsPart {
  id: string;
  text: string;
}

export function validateTtsParts(value: unknown): { parts: TtsPart[]; totalChars: number } {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, 'parts are required');
  }
  if (value.length > LIMITS.ttsParts) {
    throw new ApiError(400, `parts must contain <= ${LIMITS.ttsParts} items`);
  }
  const parts = value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new ApiError(400, 'each part must be an object');
    const item = raw as Record<string, unknown>;
    return {
      id: requireText(item.id, 'part.id', 128),
      text: requireText(item.text, 'part.text', LIMITS.ttsText),
    };
  });
  const totalChars = parts.reduce((sum, part) => sum + part.text.length, 0);
  if (totalChars > LIMITS.ttsText) {
    throw new ApiError(400, `parts text must total <= ${LIMITS.ttsText} characters`);
  }
  return { parts, totalChars };
}

export function validateOcrImages(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ApiError(400, 'images are required');
  }
  if (value.length > LIMITS.ocrImages) {
    throw new ApiError(400, `images per request must be <= ${LIMITS.ocrImages}`);
  }
  return value.map((image) => {
    if (typeof image !== 'string' || !image) {
      throw new ApiError(400, 'each image must be a base64 string');
    }
    const estimatedBytes = Math.floor((image.length * 3) / 4);
    if (estimatedBytes > LIMITS.ocrBase64Bytes) {
      throw new ApiError(400, `each image must be <= ${LIMITS.ocrBase64Bytes} base64 bytes`);
    }
    return image;
  });
}
