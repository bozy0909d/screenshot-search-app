# Find That Screenshot

A cross-platform desktop app that lets you search your screenshot library by what you
remember *seeing* in it, not its filename or date. Runs fully offline — nothing is ever
uploaded anywhere.

## How it works

1. First launch asks you to pick the folder where your screenshots live.
2. It scans that folder and runs OCR (via [Tesseract.js](https://github.com/naptha/tesseract.js))
   on every image to extract visible text.
3. Extracted text, filename, path, and creation date are stored in a local SQLite database
   (with full-text search via FTS5).
4. The folder is watched in the background ([chokidar](https://github.com/paulmillr/chokidar))
   so any new screenshot gets OCR'd and indexed automatically.
5. Type into the search box to find screenshots by their contents. Click a result to open
   the original file.

## Development

```bash
npm install     # also rebuilds better-sqlite3's native module for Electron's ABI
npm start       # launch the app
npm test        # run all test scripts (scanner, db, ocr, indexer/watcher, full smoke test)
```

### Project layout

- `main.js` / `preload.js` — Electron main process and the IPC bridge to the renderer.
- `renderer/` — the UI (plain HTML/CSS/JS): onboarding, search box, results grid, settings.
- `src/scanner.js` — recursive folder scan for image files.
- `src/watcher.js` — chokidar-based live folder watching.
- `src/ocr.js` — Tesseract.js OCR extraction (worker reused across files, language data
  cached locally after first run so it works fully offline afterward).
- `src/db.js` — SQLite storage + full-text search (better-sqlite3 + FTS5).
- `src/indexer.js` — glues scanning, OCR, and the DB together; also drives live updates
  as the watcher reports new/removed files.
- `scripts/` — standalone test scripts (see `npm test`) plus PNG fixtures used by them.

### Native modules note

`better-sqlite3` is a native addon and must be compiled against Electron's Node ABI, not
your system Node's. `npm install` runs `electron-rebuild` automatically via `postinstall`
to handle this.
