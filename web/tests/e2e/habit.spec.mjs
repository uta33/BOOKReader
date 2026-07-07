import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const EXEC = process.env.CHROMIUM_PATH;
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const SHOT = new URL('.artifacts/', import.meta.url).pathname;
mkdirSync(SHOT, { recursive: true });
const log = (...a) => console.log('•', ...a);

let failures = 0;
const check = (cond, msg) => {
  if (cond) log(`✅ ${msg}`);
  else { console.error(`❌ ${msg}`); failures++; }
};

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLEERR:', m.text()); });

const readStore = (key) =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw).state : null;
  }, key);

try {
  // 1. Fresh Home shows onboarding empty state.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check(await page.getByText('まだ本がありません').isVisible(), 'fresh Home shows empty state');
  check(await page.getByRole('link', { name: '＋ 最初の本を追加' }).isVisible(), 'empty state has add CTA');

  // 2. Import a book.
  const md = `${SHOT}/habit-book.md`;
  writeFileSync(md, `# 第1章 集中\n一文目です。二文目です。三文目です。\n# 第2章 継続\n四文目です。五文目です。`);
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /台本を取り込み/ }).click();
  await page.locator('.filepick__input').setInputFiles(md);
  await page.getByRole('button', { name: '取り込む' }).click();
  await page.waitForURL(/\/reader\//, { timeout: 10000 });
  await page.getByText('一文目です。').waitFor({ timeout: 5000 });

  // 3. Quality toggle in the player bar.
  const qbtn = page.getByRole('button', { name: '音質切り替え' });
  check((await qbtn.textContent()) === '高音質', 'player quality toggle starts at 高音質 (Neural2 default)');
  await qbtn.click();
  check((await qbtn.textContent()) === '標準', 'toggle switches label to 標準');
  let settings = await readStore('bookreader_settings');
  check(settings.voiceName === 'ja-JP-Standard-A', `voice switched to standard female (got ${settings.voiceName})`);
  // Settings page reflects the same quality (shared store).
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  const stdBtn = page.locator('.segmented__btn', { hasText: '標準' }).first();
  check((await stdBtn.getAttribute('class')).includes('is-active'), 'Settings 音質 shows 標準 active after reader toggle');
  // Toggle back to 高音質 from the reader.
  const bookId = (await readStore('bookreader_library')).books[0].id;
  await page.goto(`${BASE}/reader/${bookId}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '音質切り替え' }).click();
  settings = await readStore('bookreader_settings');
  check(settings.voiceName === 'ja-JP-Neural2-B', 'toggle back restores Neural2 female voice');

  // 4. Listening time is recorded (play ~2.5s then pause).
  await page.getByRole('button', { name: '再生', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await page.waitForTimeout(300);
  const stats1 = await readStore('bookreader_stats');
  const todayKey = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const day1 = stats1?.days?.[todayKey];
  check(day1 && day1.listenMs >= 1500, `listen time recorded (${day1?.listenMs ?? 0}ms)`);

  // 5. Home now shows checklist + continue-hero + streak.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check(await page.getByText('今日のやること').isVisible(), 'Home shows today checklist');
  check(await page.getByText('続きから聴く').isVisible(), 'Home shows continue hero card');
  check(await page.getByText('habit-book').first().isVisible(), 'hero card shows the book title');
  check(await page.getByText(/あと約\d+分で読了/).isVisible(), 'hero card shows remaining-minutes estimate');
  // 2.5s of listening is below the 60s active-day threshold — streak stays 0.
  check(await page.getByText('今日から始めよう').isVisible(), 'streak still 0 below the active-day threshold');

  // 6. Recap increments stats and checklist row.
  await page.goto(`${BASE}/recap/${bookId}`, { waitUntil: 'networkidle' });
  await page.locator('textarea').fill('集中と継続が大事。明日は朝に15分聴く。');
  await page.getByRole('button', { name: '保存して復習に登録' }).click();
  await page.waitForTimeout(300);
  const stats2 = await readStore('bookreader_stats');
  check(stats2.days[todayKey].recaps === 1, 'recap save recorded in stats');

  // 7. Seed review items as due now, run the review session, grade all.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bookreader_reviews'));
    raw.state.items = raw.state.items.map((i) => ({ ...i, dueAt: Date.now() - 1000 }));
    localStorage.setItem('bookreader_reviews', JSON.stringify(raw));
  });
  await page.goto(`${BASE}/review`, { waitUntil: 'networkidle' });
  for (let guard = 0; guard < 10; guard++) {
    if (await page.getByText('今日の復習を完了しました').isVisible().catch(() => false)) break;
    await page.getByRole('button', { name: '思い出した — 答えを表示' }).click();
    await page.getByRole('button', { name: '思い出せた' }).click();
    await page.waitForTimeout(150);
  }
  check(await page.getByText('今日の復習を完了しました').isVisible(), 'review session completes');
  const stats3 = await readStore('bookreader_stats');
  check(stats3.days[todayKey].reviews >= 1, `review grades recorded (${stats3.days[todayKey].reviews})`);

  // 8. Home: review row done, recap row done.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check(await page.getByText(/完了（\d+件）/).isVisible(), 'checklist review row shows 完了');
  check(await page.getByText('今日のふりかえり済み').isVisible(), 'checklist recap row shows done');
  check(await page.getByText('1日連続').isVisible(), 'streak shows 1日連続 once the day is active (recap+reviews)');
  await page.screenshot({ path: `${SHOT}/habit-home.png` });

  // 9. Streak = 2 with a seeded active yesterday; heatmap has active cells.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('bookreader_stats'));
    const y = new Date(Date.now() - 86400000);
    const key = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    raw.state.days[key] = { listenMs: 16 * 60000, reviews: 3, recaps: 0 };
    localStorage.setItem('bookreader_stats', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.getByText('2日連続').isVisible(), 'streak shows 2日連続 with seeded yesterday');
  const activeCells = await page.locator('.cal__grid [class*="cal__cell--l"]:not(.cal__cell--l0)').count();
  check(activeCells >= 2, `heatmap renders active cells (${activeCells})`);
  const todayRing = await page.locator('.cal__cell--today').count();
  check(todayRing === 1, 'today cell has the ring');

  // 10. Nav has 5 tabs; Library lives at /library and still works.
  check((await page.locator('.bottom-nav__item').count()) === 5, 'bottom nav has 5 tabs');
  await page.goto(`${BASE}/library`, { waitUntil: 'networkidle' });
  check(await page.getByText('habit-book').first().isVisible(), '/library lists the imported book');
  check(await page.getByText(/100% 読了|%\s*読了/).first().isVisible(), 'library card shows progress');
  await page.screenshot({ path: `${SHOT}/habit-library.png` });

  console.log(failures === 0 ? '\nALL HABIT-REWORK CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
} catch (e) {
  console.error('E2E FAILED ❌', e);
  await page.screenshot({ path: `${SHOT}/habit-error.png` }).catch(() => {});
  failures++;
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
