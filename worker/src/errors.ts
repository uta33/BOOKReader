export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export function isCheckConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /check constraint failed/i.test(message);
}

export function errorResponse(error: unknown): Response {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(500, 'Internal server error');
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  if (apiError.retryAfter) headers.set('Retry-After', String(apiError.retryAfter));
  return new Response(JSON.stringify({ error: apiError.message }), {
    status: apiError.status,
    headers,
  });
}

export async function readJson<T>(request: Request, maxBytes = 7_000_000): Promise<T> {
  const text = await readText(request, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, 'Invalid JSON');
  }
}

export async function readText(request: Request, maxBytes: number): Promise<string> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ApiError(413, 'Request body is too large');
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(413, 'Request body is too large');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
