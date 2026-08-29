const fs = require('fs');
const path = require('path');

/**
 * Tiny JSON-backed config store for app settings (currently just the watched folder path).
 */
class ConfigStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'config.json');
    this.data = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (err) {
      return {};
    }
  }

  _save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this._save();
  }
}

module.exports = { ConfigStore };
