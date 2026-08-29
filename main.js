const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const { scanFolder } = require('./src/scanner');
const { ConfigStore } = require('./src/store');
const { openDatabase } = require('./src/db');
const { Indexer } = require('./src/indexer');
const { watchFolder } = require('./src/watcher');
const ocr = require('./src/ocr');

let mainWindow;
let config;
let store;
let indexer;
let currentWatcher = null;

function guessDefaultScreenshotsFolder() {
  const home = os.homedir();
  const candidates = [
    path.join(home, 'Pictures', 'Screenshots'), // Windows 10/11 default
    path.join(home, 'Desktop'), // common fallback (macOS default, older Windows)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return home;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function startWatchingFolder(folderPath) {
  if (currentWatcher) {
    currentWatcher.close();
  }
  currentWatcher = watchFolder(folderPath, {
    onAdd: (filePath) => indexer.handleNewFile(filePath),
    onRemove: (filePath) => indexer.handleRemovedFile(filePath),
  });
}

function setWatchedFolder(folderPath) {
  config.set('watchedFolder', folderPath);
  indexer.indexExistingFiles(folderPath);
  startWatchingFolder(folderPath);
}

app.whenReady().then(() => {
  config = new ConfigStore(app.getPath('userData'));

  const dbPath = path.join(app.getPath('userData'), 'screenshots.sqlite');
  const ocrCacheDir = path.join(app.getPath('userData'), 'ocr-cache');
  fs.mkdirSync(ocrCacheDir, { recursive: true });

  store = openDatabase(dbPath);
  indexer = new Indexer(store, ocrCacheDir);

  indexer.on('progress', (payload) => {
    mainWindow?.webContents.send('index-progress', payload);
  });
  indexer.on('updated', () => {
    mainWindow?.webContents.send('index-changed');
  });
  indexer.on('removed', () => {
    mainWindow?.webContents.send('index-changed');
  });

  ipcMain.handle('get-watched-folder', () => config.get('watchedFolder') || null);

  ipcMain.handle('get-default-folder-guess', () => guessDefaultScreenshotsFolder());

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      defaultPath: guessDefaultScreenshotsFolder(),
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const folder = result.filePaths[0];
    setWatchedFolder(folder);
    return folder;
  });

  ipcMain.handle('get-all-screenshots', () => store.getAll());

  ipcMain.handle('search-screenshots', (event, query) => {
    const trimmed = (query || '').trim();
    return trimmed ? store.search(trimmed) : store.getAll();
  });

  ipcMain.handle('open-file', async (event, filePath) => {
    const result = await shell.openPath(filePath);
    return result === '' ? true : result;
  });

  createWindow();

  const existingFolder = config.get('watchedFolder');
  if (existingFolder) {
    setWatchedFolder(existingFolder);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (currentWatcher) await currentWatcher.close();
  await ocr.shutdown();
  if (store) store.close();
});
