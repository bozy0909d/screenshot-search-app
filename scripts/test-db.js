const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { openDatabase } = require('../src/db');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot-db-test-'));
const dbPath = path.join(tmpDir, 'test.sqlite');

const store = openDatabase(dbPath);

const inserted = store.addScreenshot({
  filePath: '/fake/Screenshot 2026-08-29 at 12.41.32.png',
  fileName: 'Screenshot 2026-08-29 at 12.41.32.png',
  createdAt: new Date().toISOString(),
  size: 12345,
});
assert.strictEqual(inserted, true);

const duplicateInsert = store.addScreenshot({
  filePath: '/fake/Screenshot 2026-08-29 at 12.41.32.png',
  fileName: 'Screenshot 2026-08-29 at 12.41.32.png',
  createdAt: new Date().toISOString(),
  size: 12345,
});
assert.strictEqual(duplicateInsert, false, 'duplicate path should not insert again');

store.addScreenshot({
  filePath: '/fake/lg-monitor-deal.png',
  fileName: 'lg-monitor-deal.png',
  createdAt: new Date().toISOString(),
  size: 999,
});

const pending = store.getPendingOcr();
assert.strictEqual(pending.length, 2);

const row = store.getByPath('/fake/Screenshot 2026-08-29 at 12.41.32.png');
store.setOcrResult(row.id, 'Traceback (most recent call last): Python Error: NameError');

const lgRow = store.getByPath('/fake/lg-monitor-deal.png');
store.setOcrResult(lgRow.id, 'LG UltraGear Monitor now only €299 limited offer');

const pythonResults = store.search('python error');
assert.strictEqual(pythonResults.length, 1);
assert.strictEqual(pythonResults[0].file_name, 'Screenshot 2026-08-29 at 12.41.32.png');

const monitorResults = store.search('LG monitor');
assert.strictEqual(monitorResults.length, 1);
assert.strictEqual(monitorResults[0].file_name, 'lg-monitor-deal.png');

const noResults = store.search('nonexistent gibberish query');
assert.strictEqual(noResults.length, 0);

store.removeByPath('/fake/lg-monitor-deal.png');
assert.strictEqual(store.search('LG monitor').length, 0);
assert.strictEqual(store.getAll().length, 1);

store.close();
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('db test passed: insert, dedupe, OCR update, FTS search, and delete all work');
