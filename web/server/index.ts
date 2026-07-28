import express from 'express';
import { proxyWorker } from './lib/workerProxy.ts';

const app = express();
app.use(express.json({ limit: '7mb' }));

app.get('/api/health', async (req, res) => {
  await proxyWorker(
    { method: req.method, headers: req.headers },
    res,
    '/v1/health',
  );
});

for (const path of ['/api/generate-summary', '/api/quiz', '/api/tts', '/api/ocr']) {
  app.post(path, async (req, res) => {
    await proxyWorker(
      { method: req.method, body: req.body, headers: req.headers },
      res,
      path,
    );
  });
}

const port = Number(process.env.API_PROXY_PORT ?? 8788);
app.listen(port, () => {
  console.log(`[api-proxy] listening on http://localhost:${port}`);
});
