// localStorage stub must exist before the module under test is imported.
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const { buildBackup, restoreBackup, backupFilename } = await import(
  '../../src/services/backup.js'
);

let failures = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  if (cond) console.log(`✅ ${msg}`);
  else {
    console.error(`❌ ${msg}`, extra ?? '');
    failures++;
  }
};

// Seed two stores the way zustand-persist writes them.
mem.set(
  'bookreader_library',
  JSON.stringify({ state: { books: [{ id: 'b1' }, { id: 'b2' }] }, version: 0 }),
);
mem.set('bookreader_reviews', JSON.stringify({ state: { items: [{ id: 'r1' }] }, version: 0 }));
mem.set('bookreader_stats', JSON.stringify({ state: { days: {} }, version: 0 }));

const { json, summary } = buildBackup();
ok(summary.books === 2 && summary.reviews === 1, `summary counts (${summary.books}冊/${summary.reviews}件)`);
const parsed = JSON.parse(json);
ok(parsed.app === 'bookreader-backup' && parsed.version === 1, 'envelope app/version');
ok(typeof parsed.exportedAt === 'string', 'exportedAt present');
ok(parsed.stores.bookreader_library.state.books.length === 2, 'library store embedded');
ok(parsed.stores.bookreader_settings === undefined, 'absent stores omitted');

// Restore into a wiped storage.
mem.clear();
const restored = restoreBackup(json);
ok(restored.books === 2 && restored.reviews === 1, 'restore summary matches');
ok(
  JSON.parse(mem.get('bookreader_library')!).state.books[1].id === 'b2',
  'library store written back',
);
ok(mem.get('bookreader_settings') === undefined, 'absent store not fabricated');

// Validation failures.
const throws = (fn: () => void, part: string, msg: string) => {
  try {
    fn();
    ok(false, msg, 'did not throw');
  } catch (e) {
    ok(String(e).includes(part), msg, String(e));
  }
};
throws(() => restoreBackup('{broken'), 'JSON', 'broken JSON rejected');
throws(() => restoreBackup('{"app":"other"}'), 'バックアップファイルではありません', 'foreign file rejected');
throws(
  () => restoreBackup(JSON.stringify({ app: 'bookreader-backup', version: 99, stores: {} })),
  '新しいバージョン',
  'future version rejected',
);

ok(/^bookreader-backup-\d{8}\.json$/.test(backupFilename()), `filename format (${backupFilename()})`);

console.log(failures === 0 ? '\nALL BACKUP UNIT CHECKS PASSED ✅' : `\n${failures} FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
