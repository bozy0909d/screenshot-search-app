const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getWatchedFolder: () => ipcRenderer.invoke('get-watched-folder'),
  getDefaultFolderGuess: () => ipcRenderer.invoke('get-default-folder-guess'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
});
