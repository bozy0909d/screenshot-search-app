const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { extractText, shutdown } = require('../src/ocr');

const fixturePath = process.argv[2];
if (!fixturePath || !fs.existsSync(fixturePath)) {
  console.error('Usage: node scripts/test-ocr.js <path-to-test-image.png>');
  process.exit(1);
}

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tesseract-cache-'));

(async () => {
  try {
    const text = await extractText(fixturePath, cacheDir);
    console.log('Extracted text:\n---\n' + text + '\n---');
    assert.ok(text.toLowerCase().includes('monitor'), 'expected OCR text to contain "monitor"');
    assert.ok(text.includes('299'), 'expected OCR text to contain "299"');
    console.log('ocr test passed');
  } catch (err) {
    console.error('ocr test failed:', err);
    process.exitCode = 1;
  } finally {
    await shutdown();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
})();
