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
  noteExcerpts: 50,
  noteExcerptChars: 6_000,
  noteQuote: 2_000,
  blurb: 2_000,
  purposes: 10,
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

export interface NoteExcerptInput {
  page: number;
  line?: number;
  quote: string;
  comment?: string;
}

/**
 * ドッグイヤー抜き書きの検証。
 *
 * 引用が空の項目は落とす（写真だけ撮って本文を書いていない抜き書きがありうる）。
 * 合計文字数を縛るのは、100件を超える抜き書きが付いた本でプロンプトが
 * 際限なく伸びるのを防ぐため。
 */
export function validateNoteExcerpts(value: unknown): NoteExcerptInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError(400, 'excerpts must be an array');
  if (value.length > LIMITS.noteExcerpts) {
    throw new ApiError(400, `excerpts must contain <= ${LIMITS.noteExcerpts} items`);
  }

  const excerpts: NoteExcerptInput[] = [];
  let totalChars = 0;
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') throw new ApiError(400, 'each excerpt must be an object');
    const item = raw as Record<string, unknown>;
    const quote = typeof item.quote === 'string' ? item.quote.trim() : '';
    if (!quote) continue;
    if (quote.length > LIMITS.noteQuote) {
      throw new ApiError(400, `excerpt.quote must be <= ${LIMITS.noteQuote} characters`);
    }
    const comment = optionalText(item.comment, 'excerpt.comment', LIMITS.noteQuote);
    totalChars += quote.length + (comment?.length ?? 0);
    if (totalChars > LIMITS.noteExcerptChars) {
      throw new ApiError(400, `excerpts must total <= ${LIMITS.noteExcerptChars} characters`);
    }
    excerpts.push({
      page: positiveInt(item.page),
      line: positiveInt(item.line) || undefined,
      quote,
      comment,
    });
  }
  return excerpts;
}

export function validatePurposes(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError(400, 'purposes must be an array');
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, LIMITS.purposes)
    .map((item) => item.trim());
}

/** 負数・小数・非数はすべて 0（＝未記入）に倒す。 */
function positiveInt(value: unknown): number {
  const n = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}
