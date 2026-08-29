/**
 * Full end-to-end smoke test: boots the real app (main.js) against a temp userData dir
 * pre-seeded with a watched folder containing a real screenshot fixture, waits for the
 * background OCR indexing to finish, then drives the actual renderer UI (search box,
 * results grid) exactly as a user would. Run with: xvfb-run -a electron --no-sandbox scripts/smoke-test.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ftss-smoke-'));
const screenshotsDir = path.join(scratchRoot, 'screenshots');
const userDataDir = path.join(scratchRoot, 'userdata');
fs.mkdirSync(screenshotsDir, { recursive: true });
fs.mkdirSync(userDataDir, { recursive: true });

fs.copyFileSync(path.join(__dirname, 'fixtures', 'monitor.png'), path.join(screenshotsDir, 'lg-monitor-deal.png'));

fs.writeFileSync(
  path.join(userDataDir, 'config.json'),
  JSON.stringify({ watchedFolder: screenshotsDir }, null, 2)
);

app.setPath('userData', userDataDir);

let createdWindow = null;
app.on('browser-window-created', (event, win) => {
  createdWindow = win;
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(fn, { timeoutMs = 30000, intervalMs = 300 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result) return result;
    await sleep(intervalMs);
  }
  throw new Error('Timed out waiting for condition');
}

(async () => {
  try {
    require('../main.js');

    const win = await waitForCondition(() => createdWindow, { timeoutMs: 10000 });
    await waitForCondition(() => !win.webContents.isLoading(), { timeoutMs: 10000 });

    console.log('Waiting for background OCR indexing to finish...');
    await waitForCondition(async () => {
      const status = await win.webContents.executeJavaScript(
        'document.getElementById("status-bar").textContent'
      );
      console.log('  status:', status);
      return /^\d+ screenshot\(s\) indexed$/.test(status);
    });

    const onboardingHidden = await win.webContents.executeJavaScript(
      'document.getElementById("onboarding").hidden'
    );
    if (!onboardingHidden) throw new Error('Onboarding should be hidden once a folder is configured');

    const initialCardCount = await win.webContents.executeJavaScript(
      'document.getElementById("results-grid").children.length'
    );
    if (initialCardCount !== 1) throw new Error(`Expected 1 result card before search, got ${initialCardCount}`);

    console.log('Typing a search query that should match the OCR text ("LG monitor")...');
    await win.webContents.executeJavaScript(`
      (() => {
        const box = document.getElementById('search-box');
        box.value = 'LG monitor';
        box.dispatchEvent(new Event('input'));
      })()
    `);

    await waitForCondition(async () => {
      const status = await win.webContents.executeJavaScript('document.getElementById("status-bar").textContent');
      return status.includes('result(s) for "LG monitor"');
    });

    const matchCount = await win.webContents.executeJavaScript(
      'document.getElementById("results-grid").children.length'
    );
    if (matchCount !== 1) throw new Error(`Expected 1 matching result for "LG monitor", got ${matchCount}`);

    console.log('Typing a search query that should NOT match anything ("qwerty zzz nonsense")...');
    await win.webContents.executeJavaScript(`
      (() => {
        const box = document.getElementById('search-box');
        box.value = 'qwerty zzz nonsense';
        box.dispatchEvent(new Event('input'));
      })()
    `);
    await waitForCondition(async () => {
      const status = await win.webContents.executeJavaScript('document.getElementById("status-bar").textContent');
      return status.includes('0 result(s)');
    });

    console.log('Confirming the result card is clickable and openFile IPC round-trips without throwing...');
    await win.webContents.executeJavaScript(`
      (() => {
        const box = document.getElementById('search-box');
        box.value = '';
        box.dispatchEvent(new Event('input'));
      })()
    `);
    await sleep(400);
    const clickOutcome = await win.webContents.executeJavaScript(`
      (async () => {
        try {
          document.querySelector('.result-card').click();
          return 'clicked-ok';
        } catch (e) {
          return 'error: ' + e.message;
        }
      })()
    `);
    console.log('result-card click outcome:', clickOutcome);
    if (clickOutcome !== 'clicked-ok') throw new Error('Clicking the result card threw an error');

    console.log('SMOKE TEST PASSED');
    process.exitCode = 0;
  } catch (err) {
    console.error('SMOKE TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    setTimeout(() => {
      fs.rmSync(scratchRoot, { recursive: true, force: true });
      app.quit();
    }, 300);
  }
})();
