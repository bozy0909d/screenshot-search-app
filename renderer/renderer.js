const onboardingScreen = document.getElementById('onboarding');
const mainScreen = document.getElementById('main-screen');
const chooseFolderBtn = document.getElementById('choose-folder-btn');
const changeFolderBtn = document.getElementById('change-folder-btn');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsModal = document.getElementById('settings-modal');
const currentFolderPath = document.getElementById('current-folder-path');
const statusBar = document.getElementById('status-bar');
const resultsGrid = document.getElementById('results-grid');
const searchBox = document.getElementById('search-box');

let allScreenshots = [];

function showScreen(screen) {
  onboardingScreen.hidden = screen !== 'onboarding';
  mainScreen.hidden = screen !== 'main';
}

function renderResults(items) {
  resultsGrid.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <img class="result-thumb" src="file://${item.filePath}" loading="lazy" />
      <div class="result-info">
        <div class="result-name">${item.fileName}</div>
        <div class="result-date">${new Date(item.createdAt).toLocaleString()}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      window.api.openFile(item.filePath);
    });
    resultsGrid.appendChild(card);
  }
}

async function loadFolder(folderPath) {
  statusBar.textContent = `Scanning ${folderPath} ...`;
  const files = await window.api.scanFolder(folderPath);
  allScreenshots = files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  statusBar.textContent = `${allScreenshots.length} screenshot(s) found in ${folderPath}`;
  renderResults(allScreenshots);
  currentFolderPath.textContent = folderPath;
}

chooseFolderBtn.addEventListener('click', async () => {
  const folder = await window.api.selectFolder();
  if (folder) {
    showScreen('main');
    await loadFolder(folder);
  }
});

changeFolderBtn.addEventListener('click', async () => {
  const folder = await window.api.selectFolder();
  if (folder) {
    settingsModal.hidden = true;
    await loadFolder(folder);
  }
});

settingsBtn.addEventListener('click', () => {
  settingsModal.hidden = false;
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.hidden = true;
});

searchBox.addEventListener('input', () => {
  const query = searchBox.value.trim().toLowerCase();
  if (!query) {
    renderResults(allScreenshots);
    return;
  }
  const filtered = allScreenshots.filter((item) => item.fileName.toLowerCase().includes(query));
  renderResults(filtered);
});

(async function init() {
  const watchedFolder = await window.api.getWatchedFolder();
  if (watchedFolder) {
    showScreen('main');
    await loadFolder(watchedFolder);
  } else {
    showScreen('onboarding');
  }
})();
