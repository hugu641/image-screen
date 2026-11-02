const path = require('path');
const fs = require('fs');

/**
 * All persistent data (SQLite file, uploads, generated secrets) lives in DATA_DIR.
 * Defaults to the backend folder so existing installations keep working unchanged;
 * set DATA_DIR (e.g. /data in Docker) to keep data on a dedicated volume.
 */
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..');

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'signage.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

module.exports = { DATA_DIR, UPLOADS_DIR, DB_PATH };
