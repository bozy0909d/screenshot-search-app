const errorBanner = document.getElementById('error-banner');
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

let currentQuery = '';
let searchDebounceTimer = null;

function showScreen(screen) {
  onboardingScreen.hidden = screen !== 'onboarding';
  mainScreen.hidden = screen !== 'main';
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.hidden = true;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderResults(items) {
  resultsGrid.innerHTML = '';
  if (items.length === 0) {
    resultsGrid.innerHTML = '<p style="color:#888">No screenshots found.</p>';
    return;
  }
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <img class="result-thumb" src="file://${encodeURI(item.file_path)}" loading="lazy" />
      <div class="result-info">
        <div class="result-name">${escapeHtml(item.file_name)}</div>
        <div class="result-date">${new Date(item.created_at).toLocaleString()}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      window.api.openFile(item.file_path);
    });
    resultsGrid.appendChild(card);
  }
}

async function runSearch() {
  const results = await window.api.searchScreenshots(currentQuery);
  renderResults(results);
  if (!currentQuery) {
    statusBar.textContent = `${results.length} screenshot(s) indexed`;
  } else {
    statusBar.textContent = `${results.length} result(s) for "${currentQuery}"`;
  }
}

async function loadFolder(folderPath) {
  currentFolderPath.textContent = folderPath;
  statusBar.textContent = `Scanning ${folderPath} ...`;
  await runSearch();
}

chooseFolderBtn.addEventListener('click', async () => {
  try {
    clearError();
    const folder = await window.api.selectFolder();
    if (folder) {
      showScreen('main');
      await loadFolder(folder);
    }
  } catch (err) {
    showError(`Couldn't set that folder: ${err.message}`);
  }
});

changeFolderBtn.addEventListener('click', async () => {
  try {
    clearError();
    const folder = await window.api.selectFolder();
    if (folder) {
      settingsModal.hidden = true;
      await loadFolder(folder);
    }
  } catch (err) {
    showError(`Couldn't set that folder: ${err.message}`);
  }
});

settingsBtn.addEventListener('click', () => {
  settingsModal.hidden = false;
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.hidden = true;
});

searchBox.addEventListener('input', () => {
  currentQuery = searchBox.value.trim();
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(runSearch, 150);
});

window.api.onIndexProgress(({ done, total }) => {
  if (done < total) {
    statusBar.textContent = `Indexing screenshots... (${done}/${total})`;
  } else if (!currentQuery) {
    runSearch();
  }
});

window.api.onIndexChanged(() => {
  runSearch();
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
