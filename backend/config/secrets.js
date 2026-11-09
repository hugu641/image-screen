const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./paths');

/**
 * JWT signing secret.
 *  1. JWT_SECRET from the environment (must be long and not a placeholder), else
 *  2. a random secret generated once and persisted in DATA_DIR/jwt.secret (mode 600).
 * There is deliberately NO hard-coded fallback.
 */
const PLACEHOLDERS = new Set([
  'change_this_to_a_long_random_string_in_production',
  'signage_super_secret_key_12345',
]);

function loadSecret() {
  const fromEnv = (process.env.JWT_SECRET || '').trim();
  if (fromEnv) {
    if (fromEnv.length < 32 || PLACEHOLDERS.has(fromEnv)) {
      console.warn('⚠️  JWT_SECRET is too short or a known placeholder — ignoring it and using a generated secret.');
    } else {
      return fromEnv;
    }
  }

  const file = path.join(DATA_DIR, 'jwt.secret');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* not created yet */
  }

  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, generated, { mode: 0o600 });
  console.log('🔑  Generated a new JWT secret in', file);
  return generated;
}

module.exports = { JWT_SECRET: loadSecret() };
