const fs = require('fs');
const { EventEmitter } = require('events');
const { scanFolder, isImageFile } = require('./scanner');
const { extractText } = require('./ocr');

/**
 * Coordinates scanning, OCR, and DB writes for a watched screenshot folder.
 * Emits 'progress' ({ done, total }) and 'updated' (screenshot row) as OCR completes.
 */
class Indexer extends EventEmitter {
  constructor(store, ocrCacheDir) {
    super();
    this.store = store;
    this.ocrCacheDir = ocrCacheDir;
    this._queue = [];
    this._processing = false;
  }

  /** Scans the folder, registers any not-yet-known files, and queues them for OCR. */
  indexExistingFiles(folderPath) {
    const files = scanFolder(folderPath);
    for (const file of files) {
      const isNew = this.store.addScreenshot(file);
      if (isNew) {
        this._enqueue(file.filePath);
      }
    }
    // Anything already in the DB but never OCR'd (e.g. app closed mid-run) also needs processing.
    for (const row of this.store.getPendingOcr(100000)) {
      this._enqueue(row.file_path);
    }
    this._drainQueue();
    return files.length;
  }

  /** Called by the folder watcher when a new file appears. */
  handleNewFile(filePath) {
    if (!isImageFile(filePath)) return;
    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (err) {
      return; // file may have been removed again already
    }
    const fileName = require('path').basename(filePath);
    const isNew = this.store.addScreenshot({
      filePath,
      fileName,
      createdAt: stats.birthtime.toISOString(),
      size: stats.size,
    });
    if (isNew) {
      this._enqueue(filePath);
      this._drainQueue();
    }
  }

  /** Called by the folder watcher when a file is deleted. */
  handleRemovedFile(filePath) {
    this.store.removeByPath(filePath);
    this.emit('removed', filePath);
  }

  _enqueue(filePath) {
    if (!this._queue.includes(filePath)) {
      this._queue.push(filePath);
    }
  }

  async _drainQueue() {
    if (this._processing) return;
    this._processing = true;

    const total = this._queue.length;
    let done = 0;

    while (this._queue.length > 0) {
      const filePath = this._queue.shift();
      const row = this.store.getByPath(filePath);
      if (!row) {
        continue;
      }
      try {
        const text = await extractText(filePath, this.ocrCacheDir);
        this.store.setOcrResult(row.id, text);
        this.emit('updated', this.store.getByPath(filePath));
      } catch (err) {
        this.store.setOcrFailed(row.id);
        this.emit('error', { filePath, error: err });
      }
      done += 1;
      this.emit('progress', { done, total: Math.max(total, done + this._queue.length) });
    }

    this._processing = false;
  }
}

module.exports = { Indexer };
