import express from 'express';
import { generateSummary } from './lib/summary.ts';
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
  try {
    const { topic, guidance } = req.body ?? {};
    const result = await generateSummary({ topic, guidance });
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
