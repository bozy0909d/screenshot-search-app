const chokidar = require('chokidar');
const { isImageFile } = require('./scanner');

/**
 * Watches folderPath for new/removed image files (after the initial scan has already run).
 * Returns the chokidar watcher so callers can .close() it.
 */
function watchFolder(folderPath, { onAdd, onRemove }) {
  const watcher = chokidar.watch(folderPath, {
    ignoreInitial: true, // initial scan is handled separately by scanFolder
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher.on('add', (filePath) => {
    if (isImageFile(filePath)) onAdd(filePath);
  });

  watcher.on('unlink', (filePath) => {
    if (isImageFile(filePath)) onRemove(filePath);
  });

  return watcher;
}

module.exports = { watchFolder };
