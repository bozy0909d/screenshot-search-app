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

// Regression test: a file that disappears between readdir() and stat() (e.g. renamed mid-write
// by the screenshot tool, or briefly touched by a sync client) must not crash the whole scan.
const raceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot-scan-race-test-'));
fs.writeFileSync(path.join(raceDir, 'good.png'), 'fake image bytes');
fs.writeFileSync(path.join(raceDir, 'vanishing.png'), 'fake image bytes');

const originalStatSync = fs.statSync;
fs.statSync = function (p, ...rest) {
  if (p.toString().includes('vanishing.png')) {
    const err = new Error('ENOENT: no such file or directory, stat ' + p);
    err.code = 'ENOENT';
    throw err;
  }
  return originalStatSync.call(fs, p, ...rest);
};

let raceResults;
try {
  raceResults = scanFolder(raceDir);
} finally {
  fs.statSync = originalStatSync;
}

assert.strictEqual(raceResults.length, 1, 'a file that vanishes mid-scan should be skipped, not crash the scan');
assert.strictEqual(raceResults[0].fileName, 'good.png');

fs.rmSync(raceDir, { recursive: true, force: true });

console.log('scanner test passed: a file vanishing mid-scan is skipped instead of crashing scanFolder');
