const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getWatchedFolder: () => ipcRenderer.invoke('get-watched-folder'),
  getDefaultFolderGuess: () => ipcRenderer.invoke('get-default-folder-guess'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getAllScreenshots: () => ipcRenderer.invoke('get-all-screenshots'),
  searchScreenshots: (query) => ipcRenderer.invoke('search-screenshots', query),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  onIndexProgress: (callback) => {
    ipcRenderer.on('index-progress', (event, payload) => callback(payload));
  },
  onIndexChanged: (callback) => {
    ipcRenderer.on('index-changed', () => callback());
  },
});
