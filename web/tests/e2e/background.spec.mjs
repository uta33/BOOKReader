import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const EXEC = process.env.CHROMIUM_PATH;
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const SHOT = new URL('.artifacts/', import.meta.url).pathname;
mkdirSync(SHOT, { recursive: true });

let failures = 0;
const check = (cond, msg, extra) => {
  if (cond) console.log(`✅ ${msg}`);
  else { console.error(`❌ ${msg}`, extra ?? ''); failures++; }
};

// A genuinely playable 1-second 8kHz 8-bit mono WAV of silence, so the real
// audio pipeline (play → timeupdate → ended → next chunk) runs headless.
function makeWavB64(seconds = 1) {
  const rate = 8000;
  const dataSize = rate * seconds;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28); // byte rate
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34); // 8-bit
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  buf.fill(0x80, 44);
  return buf.toString('base64');
}
const WAV_B64 = makeWavB64(1);

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.route('**/api/tts', async (route) => {
  const body = route.request().postDataJSON();
  const timepoints = (body.parts ?? []).map((p, i) => ({ markName: p.id, timeSeconds: i * 0.3 }));
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ audioContent: WAV_B64, timepoints, fallback: false }),
  });
});

try {
  const md = `${SHOT}/bg-book.md`;
  writeFileSync(md, '# 第1章 前半\n一文目です。二文目です。\n# 第2章 後半\n三文目です。');
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  await page.locator('.filepick__input').setInputFiles(md);
  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 10000 });
  await page.getByText('一文目です。').waitFor();

  await page.getByRole('button', { name: '再生', exact: true }).click();
  await page.waitForTimeout(600);

  // Real audio is playing (tts mode, not fallback).
  const modeLabel = await page.locator('.player__mode').textContent();
  check(modeLabel?.includes('音声'), `tts mode active (label: ${modeLabel?.trim()})`);

  // Media Session: lock-screen metadata + state + handlers.
  const ms = await page.evaluate(() => ({
    title: navigator.mediaSession.metadata?.title,
    artist: navigator.mediaSession.metadata?.artist,
    artwork: navigator.mediaSession.metadata?.artwork?.length,
    state: navigator.mediaSession.playbackState,
  }));
  check(ms.title === 'bg-book', `mediaSession title = book title (${ms.title})`);
  check(ms.artist === 'BOOKReader', 'mediaSession artist set');
  check(ms.artwork === 2, 'mediaSession artwork (192/512) set');
  check(ms.state === 'playing', `mediaSession playbackState=playing (${ms.state})`);

  // Chunk1 (1s) → chunk2 (1s) hand-off happens on ONE persistent element,
  // then the book finishes: recap CTA banner + paused state.
  await page.getByText(/最後まで読みました/).waitFor({ timeout: 8000 });
  check(true, 'chunk hand-off + end-of-book reached with real audio');
  check(await page.getByRole('button', { name: '再生', exact: true }).isVisible(), 'player returns to paused at end');
  const endState = await page.evaluate(() => navigator.mediaSession.playbackState);
  check(endState === 'paused', `mediaSession paused at end (${endState})`);

  // Pause/resume mid-book still works with the persistent element.
  await page.getByText('一文目です。').click();
  await page.getByRole('button', { name: '再生', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const pausedState = await page.evaluate(() => navigator.mediaSession.playbackState);
  check(pausedState === 'paused', 'manual pause reflects in mediaSession');

  console.log(failures === 0 ? '\nALL BACKGROUND-PLAYBACK E2E CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/bg-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
