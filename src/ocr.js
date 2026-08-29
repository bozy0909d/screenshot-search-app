const path = require('path');
const Tesseract = require('tesseract.js');

let workerPromise = null;

/**
 * Lazily creates (and reuses) a single Tesseract worker. Language data is cached under
 * cacheDir on first use so every OCR run after that is fully offline.
 */
function getWorker(cacheDir) {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('eng', 1, {
      cachePath: cacheDir,
    });
  }
  return workerPromise;
}

/**
 * Runs OCR on a single image file and returns the extracted text (trimmed, empty string if none).
 */
async function extractText(filePath, cacheDir) {
  const worker = await getWorker(cacheDir);
  const {
    data: { text },
  } = await worker.recognize(filePath);
  return text.trim();
}

async function shutdown() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}

module.exports = { extractText, shutdown };
