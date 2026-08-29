const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const { scanFolder } = require('./src/scanner');
const { ConfigStore } = require('./src/store');

let mainWindow;
let config;

function guessDefaultScreenshotsFolder() {
  const home = os.homedir();
  const candidates = [
    path.join(home, 'Desktop'), // Windows default screenshot location (older)
    path.join(home, 'Pictures', 'Screenshots'), // Windows 10/11 default
    path.join(home, 'Pictures', 'Screenshots (2)'),
  ];
  if (process.platform === 'darwin') {
    candidates.unshift(path.join(home, 'Desktop'));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return home;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  config = new ConfigStore(app.getPath('userData'));

  ipcMain.handle('get-watched-folder', () => {
    return config.get('watchedFolder') || null;
  });

  ipcMain.handle('get-default-folder-guess', () => {
    return guessDefaultScreenshotsFolder();
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      defaultPath: guessDefaultScreenshotsFolder(),
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const folder = result.filePaths[0];
    config.set('watchedFolder', folder);
    return folder;
  });

  ipcMain.handle('scan-folder', async (event, folderPath) => {
    return scanFolder(folderPath);
  });

  ipcMain.handle('open-file', async (event, filePath) => {
    const result = await shell.openPath(filePath);
    return result === '' ? true : result;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
