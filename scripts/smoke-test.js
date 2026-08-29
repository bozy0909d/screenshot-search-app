/**
 * Headless smoke test: launches the real Electron app with a temp userData dir
 * pre-seeded with a watched folder, waits for the renderer to report how many
 * screenshots it found, then quits. Fails (non-zero exit) if anything throws
 * or the count doesn't match what we planted on disk.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ftss-smoke-'));
const screenshotsDir = path.join(scratchRoot, 'screenshots');
const userDataDir = path.join(scratchRoot, 'userdata');
fs.mkdirSync(screenshotsDir, { recursive: true });
fs.mkdirSync(userDataDir, { recursive: true });

const plantedFiles = [
  'Screenshot 2026-08-29 at 12.41.32.png',
  'Screenshot 2026-08-28 at 09.02.10.png',
  'not-an-image.txt',
];
for (const name of plantedFiles) {
  fs.writeFileSync(path.join(screenshotsDir, name), 'fake-bytes');
}
const expectedImageCount = plantedFiles.filter((n) => n.endsWith('.png')).length;

app.setPath('userData', userDataDir);

const { ConfigStore } = require('../src/store');
const preSeedConfig = new ConfigStore(userDataDir);
preSeedConfig.set('watchedFolder', screenshotsDir);

const { scanFolder } = require('../src/scanner');

app.whenReady().then(async () => {
  try {
    const results = scanFolder(screenshotsDir);
    if (results.length !== expectedImageCount) {
      throw new Error(`Expected ${expectedImageCount} images, got ${results.length}`);
    }

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    ipcMain.handle('get-watched-folder', () => screenshotsDir);
    ipcMain.handle('scan-folder', async (event, folderPath) => scanFolder(folderPath));

    await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

    const domResult = await win.webContents.executeJavaScript(`
      (async () => {
        await new Promise((r) => setTimeout(r, 500));
        const grid = document.getElementById('results-grid');
        const status = document.getElementById('status-bar').textContent;
        const onboardingHidden = document.getElementById('onboarding').hidden;
        return { cardCount: grid.children.length, status, onboardingHidden };
      })()
    `);

    console.log('DOM result:', domResult);

    if (!domResult.onboardingHidden) {
      throw new Error('Onboarding screen should be hidden once a folder is set');
    }
    if (domResult.cardCount !== expectedImageCount) {
      throw new Error(`Expected ${expectedImageCount} result cards in DOM, got ${domResult.cardCount}`);
    }

    console.log('SMOKE TEST PASSED');
    process.exitCode = 0;
  } catch (err) {
    console.error('SMOKE TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
    app.quit();
  }
});
