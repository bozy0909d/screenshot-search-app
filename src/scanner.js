const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']);

function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Recursively scans a folder for image files.
 * Returns an array of { filePath, fileName, createdAt, size }.
 */
function scanFolder(folderPath) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && isImageFile(fullPath)) {
        const stats = fs.statSync(fullPath);
        results.push({
          filePath: fullPath,
          fileName: entry.name,
          createdAt: stats.birthtime.toISOString(),
          size: stats.size,
        });
      }
    }
  }

  walk(folderPath);
  return results;
}

module.exports = { scanFolder, isImageFile, IMAGE_EXTENSIONS };
