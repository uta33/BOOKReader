import express from 'express';
import { generateSummaryStream } from './lib/summary.ts';
import { generateQuiz } from './lib/quiz.ts';
import { synthesize } from './lib/tts.ts';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    googleTts: Boolean(process.env.GOOGLE_TTS_API_KEY),
  });
});

app.post('/api/generate-summary', async (req, res) => {
  const { topic, guidance } = req.body ?? {};
  try {
    const stream = generateSummaryStream({ topic, guidance });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    } else {
      res.end();
    }
  }
});

app.post('/api/quiz', async (req, res) => {
  try {
    const { script } = req.body ?? {};
    const result = await generateQuiz(script);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName, speakingRate, pitch } = req.body ?? {};
    const result = await synthesize({
      text,
      voiceName: voiceName ?? 'ja-JP-Neural2-B',
      speakingRate: speakingRate ?? 1.0,
      pitch: pitch ?? 0.0,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

const port = Number(process.env.API_PORT ?? 8787);
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
