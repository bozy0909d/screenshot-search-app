/**
 * End-to-end test of scanning + OCR + DB indexing, and the live folder watcher picking up
 * a newly-added screenshot. Requires two fixture PNGs as argv[2] and argv[3] (monitor-themed
 * and error-themed text respectively). Run under Electron (ELECTRON_RUN_AS_NODE=1) since it
 * uses better-sqlite3.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { openDatabase } = require('../src/db');
const { Indexer } = require('../src/indexer');
const { watchFolder } = require('../src/watcher');
const { shutdown } = require('../src/ocr');

const [, , monitorFixture, errorFixture] = process.argv;
if (!monitorFixture || !errorFixture) {
  console.error('Usage: node scripts/test-indexer-watcher.js <monitor.png> <error.png>');
  process.exit(1);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ftss-indexer-test-'));
const screenshotsDir = path.join(tmpRoot, 'screenshots');
fs.mkdirSync(screenshotsDir);
const dbPath = path.join(tmpRoot, 'db.sqlite');
const cacheDir = path.join(tmpRoot, 'tess-cache');

fs.copyFileSync(monitorFixture, path.join(screenshotsDir, 'lg-monitor-deal.png'));

function waitFor(emitter, event) {
  return new Promise((resolve) => emitter.once(event, resolve));
}

(async () => {
  let watcher;
  try {
    const store = openDatabase(dbPath);
    const indexer = new Indexer(store, cacheDir);

    console.log('Indexing existing files...');
    const initialCount = indexer.indexExistingFiles(screenshotsDir);
    assert.strictEqual(initialCount, 1);

    // Wait for the queued OCR job on the pre-existing file to finish.
    await waitFor(indexer, 'progress');

    let results = store.search('LG monitor');
    assert.strictEqual(results.length, 1, 'expected the pre-existing screenshot to be searchable after initial index');
    console.log('Initial indexing + search: OK');

    console.log('Starting folder watcher...');
    watcher = watchFolder(screenshotsDir, {
      onAdd: (filePath) => indexer.handleNewFile(filePath),
      onRemove: (filePath) => indexer.handleRemovedFile(filePath),
    });
    await waitFor(watcher, 'ready');

    const updatedPromise = waitFor(indexer, 'updated');
    fs.copyFileSync(errorFixture, path.join(screenshotsDir, 'python-error.png'));
    console.log('Dropped a new screenshot into the watched folder, waiting for it to be indexed...');
    await updatedPromise;

    results = store.search('python traceback');
    assert.strictEqual(results.length, 1, 'expected the newly-added screenshot to be searchable via the watcher');
    assert.strictEqual(results[0].file_name, 'python-error.png');
    console.log('Live folder watching + auto-OCR + search: OK');

    // Test removal too.
    const removedPromise = waitFor(indexer, 'removed');
    fs.unlinkSync(path.join(screenshotsDir, 'python-error.png'));
    await removedPromise;
    results = store.search('python traceback');
    assert.strictEqual(results.length, 0, 'expected deleted screenshot to be removed from the index');
    console.log('Removal handling: OK');

    console.log('ALL INDEXER/WATCHER TESTS PASSED');
    store.close();
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (watcher) await watcher.close();
    await shutdown();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
})();
