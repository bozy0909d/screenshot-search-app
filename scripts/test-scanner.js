const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { scanFolder } = require('../src/scanner');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot-scan-test-'));

const subDir = path.join(tmpDir, 'nested');
fs.mkdirSync(subDir);

const files = [
  path.join(tmpDir, 'Screenshot 2026-08-29 at 12.41.32.png'),
  path.join(tmpDir, 'photo.JPG'),
  path.join(tmpDir, 'notes.txt'),
  path.join(subDir, 'nested-shot.png'),
];

for (const f of files) {
  fs.writeFileSync(f, 'fake image bytes');
}

const results = scanFolder(tmpDir);

assert.strictEqual(results.length, 3, `expected 3 image files, got ${results.length}`);

const names = results.map((r) => r.fileName).sort();
assert.deepStrictEqual(names, ['Screenshot 2026-08-29 at 12.41.32.png', 'nested-shot.png', 'photo.JPG'].sort());

for (const r of results) {
  assert.ok(r.filePath);
  assert.ok(r.createdAt);
  assert.ok(r.size > 0);
}

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('scanner test passed:', results.length, 'image files found (txt excluded, nested included)');
