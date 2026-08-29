const path = require('path');
const Database = require('better-sqlite3');

/**
 * Opens (creating if needed) the screenshots database at dbPath and ensures the schema exists.
 */
function openDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      size INTEGER,
      ocr_text TEXT,
      ocr_status TEXT NOT NULL DEFAULT 'pending',
      indexed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_screenshots_ocr_status ON screenshots (ocr_status);

    CREATE VIRTUAL TABLE IF NOT EXISTS screenshots_fts USING fts5(
      ocr_text,
      file_name,
      content='screenshots',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS screenshots_ai AFTER INSERT ON screenshots BEGIN
      INSERT INTO screenshots_fts(rowid, ocr_text, file_name)
      VALUES (new.id, new.ocr_text, new.file_name);
    END;

    CREATE TRIGGER IF NOT EXISTS screenshots_ad AFTER DELETE ON screenshots BEGIN
      INSERT INTO screenshots_fts(screenshots_fts, rowid, ocr_text, file_name)
      VALUES ('delete', old.id, old.ocr_text, old.file_name);
    END;

    CREATE TRIGGER IF NOT EXISTS screenshots_au AFTER UPDATE ON screenshots BEGIN
      INSERT INTO screenshots_fts(screenshots_fts, rowid, ocr_text, file_name)
      VALUES ('delete', old.id, old.ocr_text, old.file_name);
      INSERT INTO screenshots_fts(rowid, ocr_text, file_name)
      VALUES (new.id, new.ocr_text, new.file_name);
    END;
  `);

  return new ScreenshotStore(db);
}

class ScreenshotStore {
  constructor(db) {
    this.db = db;
  }

  /** Insert a newly-discovered screenshot (OCR not yet run). No-op if the path is already known. */
  addScreenshot({ filePath, fileName, createdAt, size }) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO screenshots (file_path, file_name, created_at, size, ocr_status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    const info = stmt.run(filePath, fileName, createdAt, size);
    return info.changes > 0;
  }

  getByPath(filePath) {
    return this.db.prepare('SELECT * FROM screenshots WHERE file_path = ?').get(filePath);
  }

  getPendingOcr(limit = 50) {
    return this.db
      .prepare("SELECT * FROM screenshots WHERE ocr_status = 'pending' ORDER BY id ASC LIMIT ?")
      .all(limit);
  }

  setOcrResult(id, text) {
    this.db
      .prepare(
        "UPDATE screenshots SET ocr_text = ?, ocr_status = 'done', indexed_at = ? WHERE id = ?"
      )
      .run(text, new Date().toISOString(), id);
  }

  setOcrFailed(id) {
    this.db.prepare("UPDATE screenshots SET ocr_status = 'failed' WHERE id = ?").run(id);
  }

  removeByPath(filePath) {
    this.db.prepare('DELETE FROM screenshots WHERE file_path = ?').run(filePath);
  }

  getAll() {
    return this.db.prepare('SELECT * FROM screenshots ORDER BY created_at DESC').all();
  }

  /** Full-text search over OCR text and filename, ranked by relevance. */
  search(query, limit = 200) {
    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];
    return this.db
      .prepare(
        `
        SELECT s.*
        FROM screenshots_fts f
        JOIN screenshots s ON s.id = f.rowid
        WHERE screenshots_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `
      )
      .all(ftsQuery, limit);
  }

  close() {
    this.db.close();
  }
}

/** Turns free-text user input into a safe FTS5 MATCH query (prefix match, each token required). */
function buildFtsQuery(rawQuery) {
  const tokens = rawQuery
    .split(/\s+/)
    .map((t) => t.replace(/["*]/g, '').trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

module.exports = { openDatabase, ScreenshotStore };
