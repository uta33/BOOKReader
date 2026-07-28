interface ProxyRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface ProxyResponse {
  status: (code: number) => ProxyResponse;
  setHeader: (name: string, value: string) => void;
  write: (chunk: Uint8Array) => void;
  end: () => void;
  json: (body: unknown) => void;
}

export async function proxyWorker(
  req: ProxyRequest,
  res: ProxyResponse,
  path: string,
): Promise<void> {
  const base = process.env.WORKER_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) {
    res.status(503).json({ error: 'Worker API is not configured' });
    return;
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  const authorization = header(req.headers, 'authorization');
  if (authorization) headers.set('Authorization', authorization);

  let upstream: Response;
  try {
    upstream = await fetch(`${base}${path}`, {
      method: req.method ?? 'POST',
      headers,
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body ?? {}),
    });
  } catch {
    res.status(502).json({ error: 'Worker API is unavailable' });
    return;
  }

  res.status(upstream.status);
  for (const name of ['content-type', 'cache-control', 'retry-after']) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  if (!upstream.body) {
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

function header(
  headers: ProxyRequest['headers'],
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
