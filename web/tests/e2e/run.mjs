// E2E runner: boots the dev server (web + api), waits for it, then runs
// every *.spec.mjs in this directory sequentially. Set CHROMIUM_PATH to use
// a pre-installed Chromium instead of Playwright's own download.
import { spawn } from 'child_process';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(dir, '../..');
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

async function waitForServer(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`dev server did not come up at ${url}`);
}

const server = spawn('npm', ['run', 'dev'], {
  cwd: webDir,
  stdio: 'ignore',
  detached: true, // own process group so the whole concurrently tree dies
});

let failedSuites = 0;
try {
  await waitForServer(BASE);
  const specs = readdirSync(dir)
    .filter((f) => f.endsWith('.spec.mjs'))
    .sort();
  for (const spec of specs) {
    console.log(`\n━━━ ${spec} ━━━`);
    const code = await new Promise((resolve) => {
      const p = spawn(process.execPath, [path.join(dir, spec)], { stdio: 'inherit' });
      p.on('exit', resolve);
    });
    if (code !== 0) failedSuites++;
  }
} finally {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}

console.log(failedSuites === 0 ? '\nALL E2E SUITES PASSED ✅' : `\n${failedSuites} SUITE(S) FAILED ❌`);
process.exit(failedSuites === 0 ? 0 : 1);
