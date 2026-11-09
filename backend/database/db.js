const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { DB_PATH } = require('../config/paths');

const db = new sqlite3.Database(DB_PATH);

// ─── Identifier safety ──────────────────────────────────────────────────────
// Table and column names are interpolated into SQL (values are always bound
// parameters), so they are strictly validated to make injection impossible.
const TABLES = new Set([
  'users', 'settings', 'media', 'playlists', 'screens', 'events', 'licenseKeys', 'keyRedemptions', 'stores',
]);
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const OPS = new Set(['=', '<', '>', '<=', '>=', '!=']);

function table(name) {
  if (!TABLES.has(name)) throw new Error(`Invalid table: ${name}`);
  return name;
}
function col(name) {
  if (!IDENT.test(name)) throw new Error(`Invalid column: ${name}`);
  return name;
}
function op(o) {
  const v = o || '=';
  if (!OPS.has(v)) throw new Error(`Invalid operator: ${v}`);
  return v;
}
function newId() {
  return crypto.randomBytes(9).toString('base64url');
}

// Helper function to run DB operations as Promises
const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// SQLite helper implementation mimicking the firestore helpers
const firestoreHelpers = {
  async getById(collection, id) {
    const row = await query.get(`SELECT * FROM ${table(collection)} WHERE id = ?`, [String(id)]);
    if (!row) return null;
    if (collection === 'playlists' && row.items) {
      try {
        row.items = JSON.parse(row.items);
      } catch (e) {
        row.items = [];
      }
    }
    return row;
  },

  async getWhere(collection, filters = []) {
    let sql = `SELECT * FROM ${table(collection)}`;
    const params = [];
    if (filters.length > 0) {
      const clause = filters.map(f => {
        params.push(f.value);
        return `${col(f.field)} ${op(f.op)} ?`;
      }).join(' AND ');
      sql += ` WHERE ${clause}`;
    }
    sql += ` LIMIT 1`;
    const row = await query.get(sql, params);
    if (!row) return null;
    if (collection === 'playlists' && row.items) {
      try {
        row.items = JSON.parse(row.items);
      } catch (e) {
        row.items = [];
      }
    }
    return row;
  },

  async getAll(collection, filters = [], options = {}) {
    let sql = `SELECT * FROM ${table(collection)}`;
    const params = [];
    if (filters.length > 0) {
      const clause = filters.map(f => {
        params.push(f.value);
        return `${col(f.field)} ${op(f.op)} ?`;
      }).join(' AND ');
      sql += ` WHERE ${clause}`;
    }
    if (options.orderBy) {
      sql += ` ORDER BY ${col(options.orderBy)} ${String(options.orderDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    }
    if (options.limit) {
      sql += ` LIMIT ${parseInt(options.limit, 10) || 100}`;
    }
    const rows = await query.all(sql, params);
    return rows.map(row => {
      if (collection === 'playlists' && row.items) {
        try {
          row.items = JSON.parse(row.items);
        } catch (e) {
          row.items = [];
        }
      }
      return row;
    });
  },

  async add(collection, data) {
    const id = data.id || newId();
    const finalData = { ...data, id };
    
    const now = new Date().toISOString();
    if (finalData.created_at === undefined) {
      finalData.created_at = now;
    }
    if (finalData.timestamp === undefined && collection === 'events') {
      finalData.timestamp = now;
    }

    if (collection === 'playlists' && finalData.items) {
      finalData.items = JSON.stringify(finalData.items);
    }

    const keys = Object.keys(finalData).map(col);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => finalData[k]);

    await query.run(`INSERT INTO ${table(collection)} (${keys.join(', ')}) VALUES (${placeholders})`, values);
    return id;
  },

  async set(collection, id, data) {
    const exists = await query.get(`SELECT 1 FROM ${table(collection)} WHERE id = ?`, [String(id)]);
    if (exists) {
      await this.update(collection, id, data);
    } else {
      await this.add(collection, { ...data, id });
    }
    return String(id);
  },

  async update(collection, id, data) {
    const finalData = { ...data };
    if (collection === 'playlists' && finalData.items) {
      finalData.items = JSON.stringify(finalData.items);
    }

    const keys = Object.keys(finalData).filter(k => k !== 'id').map(col);
    if (keys.length === 0) return;

    const values = [];
    const clause = keys.map(k => {
      const val = finalData[k];
      if (val && typeof val === 'object' && val.type === 'increment') {
        values.push(val.value);
        return `${k} = ${k} + ?`;
      } else {
        values.push(val);
        return `${k} = ?`;
      }
    }).join(', ');

    values.push(String(id));

    await query.run(`UPDATE ${table(collection)} SET ${clause} WHERE id = ?`, values);
  },

  async delete(collection, id) {
    await query.run(`DELETE FROM ${table(collection)} WHERE id = ?`, [String(id)]);
  },

  async deleteWhere(collection, filters = []) {
    let sql = `DELETE FROM ${table(collection)}`;
    const params = [];
    if (filters.length > 0) {
      const clause = filters.map(f => {
        params.push(f.value);
        return `${col(f.field)} ${op(f.op)} ?`;
      }).join(' AND ');
      sql += ` WHERE ${clause}`;
    }
    await query.run(sql, params);
  },

  /** Screens waiting to be paired (not associated yet). */
  async countPendingScreens() {
    const row = await query.get('SELECT COUNT(*) AS n FROM screens WHERE is_associated IS NULL OR is_associated = 0');
    return row ? row.n : 0;
  },

  /** Bytes used by one store's media library (each store has its own quota). */
  async sumMediaSize(storeId) {
    const row = await query.get('SELECT COALESCE(SUM(size), 0) AS total FROM media WHERE store_id = ?', [String(storeId)]);
    return row ? row.total : 0;
  },

  /** Housekeeping: drop never-paired screens inactive since `cutoffIso`, and old log rows. */
  async pruneStalePendingScreens(cutoffIso) {
    const r = await query.run(
      'DELETE FROM screens WHERE (is_associated IS NULL OR is_associated = 0) AND COALESCE(last_activity, created_at, \'\') < ?',
      [cutoffIso]
    );
    return r.changes;
  },

  async pruneEvents(keep = 5000) {
    const r = await query.run(
      'DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY COALESCE(timestamp, created_at) DESC LIMIT ?)',
      [keep]
    );
    return r.changes;
  },

  async count(collection) {
    const row = await query.get(`SELECT COUNT(*) AS n FROM ${table(collection)}`);
    return row ? row.n : 0;
  },

  /** Atomically consume one use of a license key. Returns true only if a use was available. */
  async claimLicenseUse(id) {
    const r = await query.run(
      'UPDATE licenseKeys SET uses_count = COALESCE(uses_count, 0) + 1 WHERE id = ? AND COALESCE(uses_count, 0) < max_uses',
      [String(id)]
    );
    return r.changes === 1;
  },

  async releaseLicenseUse(id) {
    await query.run('UPDATE licenseKeys SET uses_count = MAX(COALESCE(uses_count, 0) - 1, 0) WHERE id = ?', [String(id)]);
  },

  increment(value = 1) {
    return { type: 'increment', value };
  },

  serverTimestamp() {
    return new Date().toISOString();
  }
};

async function addColumnIfNotExists(table, column, type) {
  try {
    const columns = await query.all(`PRAGMA table_info(${table})`);
    const columnNames = columns.map(c => c.name);
    if (!columnNames.includes(column)) {
      await query.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`[Database Migration] Added column "${column}" to table "${table}".`);
    }
  } catch (err) {
    console.error(`[Database Migration] Failed to add column "${column}" to "${table}":`, err.message);
  }
}

/**
 * Moves an installation created before multi-store support into a single store.
 * - the existing content and users join a default store (named after the old store name);
 * - the old 'admin' account becomes the super-admin (manages accounts, sees no content);
 * - the old global settings row ('config') becomes that store's settings.
 * Idempotent: it only runs while legacy rows (store_id NULL, role 'admin') remain.
 */
async function migrateToStores() {
  // Legacy installations are the only ones with a role 'admin' account (multi-store roles are
  // 'superadmin', 'storeadmin' and 'user'). Once migrated, nothing matches again.
  const legacy = await query.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
  if (!legacy || !legacy.n) return;

  const old = await query.get("SELECT store_name FROM settings WHERE id = 'config'");
  const storeId = newId();
  await query.run('INSERT INTO stores (id, name, created_at) VALUES (?, ?, ?)', [
    storeId, (old && old.store_name) || 'Mon Magasin', new Date().toISOString(),
  ]);

  await query.run("UPDATE users SET role = 'superadmin', store_id = NULL WHERE role = 'admin'");
  await query.run("UPDATE users SET store_id = ? WHERE store_id IS NULL AND role = 'user'", [storeId]);
  for (const t of ['media', 'playlists', 'screens', 'events']) {
    await query.run(`UPDATE ${t} SET store_id = ? WHERE store_id IS NULL`, [storeId]);
  }
  await query.run("UPDATE settings SET id = ? WHERE id = 'config'", [storeId]);
  console.log(`[Database Migration] Existing data moved to store "${(old && old.store_name) || 'Mon Magasin'}" (id ${storeId}).`);
}

// Initialization and seeding of default data
async function initDb() {
  try {
    // Create tables
    await query.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        role TEXT,
        provider TEXT,
        google_uid TEXT,
        avatar TEXT,
        created_at TEXT
      )
    `);

    await query.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        store_name TEXT,
        default_duration TEXT,
        logo TEXT
      )
    `);

    await query.run(`
      CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY,
        filename TEXT,
        original_name TEXT,
        mime_type TEXT,
        size INTEGER,
        filepath TEXT,
        created_at TEXT
      )
    `);

    await query.run(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT,
        items TEXT,
        duration TEXT,
        transition TEXT,
        random_order INTEGER,
        loop_playback INTEGER,
        created_at TEXT
      )
    `);

    await query.run(`
      CREATE TABLE IF NOT EXISTS screens (
        id TEXT PRIMARY KEY,
        name TEXT,
        code TEXT UNIQUE,
        playlist_id TEXT,
        status TEXT,
        last_activity TEXT,
        created_at TEXT
      )
    `);

    await query.run(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT,
        message TEXT,
        timestamp TEXT
      )
    `);

    await query.run(`
      CREATE TABLE IF NOT EXISTS licenseKeys (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE,
        plan TEXT,
        duration_days INTEGER,
        max_uses INTEGER,
        uses_count INTEGER,
        note TEXT,
        created_by TEXT,
        expires_at TEXT,
        is_active INTEGER,
        created_at TEXT
      )
    `);

    await query.run(`
      CREATE TABLE IF NOT EXISTS keyRedemptions (
        id TEXT PRIMARY KEY,
        key_id TEXT,
        user_id TEXT,
        redeemed_at TEXT,
        created_at TEXT
      )
    `);

    await query.run(`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at TEXT
      )
    `);

    // Schema Migrations (Ensure columns exist on existing databases)
    await addColumnIfNotExists('users', 'plan', 'TEXT');
    await addColumnIfNotExists('users', 'subscription_status', 'TEXT');
    await addColumnIfNotExists('users', 'subscription_ends_at', 'TEXT');

    await addColumnIfNotExists('screens', 'is_associated', 'INTEGER');
    await addColumnIfNotExists('screens', 'ip_address', 'TEXT');

    await addColumnIfNotExists('events', 'screen_id', 'TEXT');
    await addColumnIfNotExists('events', 'event_type', 'TEXT');
    await addColumnIfNotExists('events', 'created_at', 'TEXT');

    // Seed default settings
    const settingsExist = await query.get("SELECT 1 FROM settings WHERE id = 'config'");
    if (!settingsExist) {
      await query.run(
        "INSERT INTO settings (id, store_name, default_duration, logo) VALUES (?, ?, ?, ?)",
        ['config', 'Mon Magasin', '5', '']
      );
    }

    // Multi-store: every piece of content belongs to exactly one store (see migrateToStores)
    await addColumnIfNotExists('settings', 'created_at', 'TEXT'); // settings are now created per store
    await addColumnIfNotExists('users', 'store_id', 'TEXT');
    // Password reset / invitation: only a SHA-256 hash of the one-time token is stored
    await addColumnIfNotExists('users', 'reset_token_hash', 'TEXT');
    await addColumnIfNotExists('users', 'reset_expires_at', 'TEXT');
    await addColumnIfNotExists('users', 'reset_purpose', 'TEXT');
    await addColumnIfNotExists('users', 'disabled', 'INTEGER DEFAULT 0');
    await addColumnIfNotExists('media', 'store_id', 'TEXT');
    await addColumnIfNotExists('playlists', 'store_id', 'TEXT');
    await addColumnIfNotExists('screens', 'store_id', 'TEXT');
    await addColumnIfNotExists('events', 'store_id', 'TEXT');

    // Security migrations
    await addColumnIfNotExists('users', 'token_version', 'INTEGER DEFAULT 0');
    await addColumnIfNotExists('users', 'must_change_password', 'INTEGER DEFAULT 0');
    await addColumnIfNotExists('screens', 'token_hash', 'TEXT');
    await query.run(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_key_redemptions_unique ON keyRedemptions(key_id, user_id)'
    );

    // No default accounts are created any more: the first account registered on a fresh
    // install becomes the administrator (see authController.register).
    // Installations created by older versions may still hold the public default accounts:
    // keep them, but force a password change and invalidate their sessions.
    const LEGACY_DEFAULTS = [
      ['admin@magasin.local', 'admin123'],
      ['hugu@imagescreen.local', '1234'],
    ];
    for (const [email, pwd] of LEGACY_DEFAULTS) {
      const u = await query.get('SELECT id, password, must_change_password FROM users WHERE email = ?', [email]);
      if (u && !u.must_change_password && u.password && (await bcrypt.compare(pwd, u.password))) {
        await query.run(
          'UPDATE users SET must_change_password = 1, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?',
          [u.id]
        );
        console.warn(`⚠️  Account ${email} still uses a publicly known default password: a password change is now required.`);
      }
    }

    // The database holds password hashes: keep it private even if it pre-dates the umask
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      try { fs.chmodSync(DB_PATH + suffix, 0o600); } catch { /* file may not exist */ }
    }

    await migrateToStores();

    console.log('✅  SQLite Database successfully initialized.');
  } catch (error) {
    console.error('❌  SQLite init failed:', error);
    process.exit(1);
  }
}

module.exports = {
  fdb: firestoreHelpers,
  initDb
};
