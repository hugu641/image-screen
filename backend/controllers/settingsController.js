const { fdb } = require('../database/db');
const { logEvent } = require('../services/socketService');
const { verifyToken } = require('./authController');

const DEFAULTS = { store_name: 'Mon Magasin', default_duration: '5', logo: '' };

/**
 * Which store's settings to return:
 *  - a logged-in user → their store;
 *  - a screen (unauthenticated TV player) → the store it is paired with, given by ?screenId=.
 * Anything else gets the defaults, so nothing leaks between stores.
 */
async function storeForRequest(req) {
  const header = req.headers['authorization'] || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    const user = await verifyToken(token);
    if (user && user.store_id) return user.store_id;
  }
  const screenId = typeof req.query.screenId === 'string' ? req.query.screenId : '';
  if (screenId) {
    const screen = await fdb.getById('screens', screenId);
    if (screen && screen.store_id) return screen.store_id;
  }
  return null;
}

async function getSettings(req, res) {
  try {
    const storeId = await storeForRequest(req);
    if (!storeId) return res.json({ ...DEFAULTS });

    const store = await fdb.getById('stores', storeId);
    const row = (await fdb.getById('settings', storeId)) || {};
    const settings = {
      store_name: row.store_name || (store && store.name) || DEFAULTS.store_name,
      default_duration: row.default_duration || DEFAULTS.default_duration,
      logo: row.logo || DEFAULTS.logo,
    };
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des paramètres.' });
  }
}

async function updateSettings(req, res) {
  const { store_name, default_duration, logo } = req.body || {};
  const storeId = req.user.storeId;

  try {
    const updates = {};

    if (store_name !== undefined) {
      if (typeof store_name !== 'string' || store_name.trim().length > 100) {
        return res.status(400).json({ error: 'Nom du magasin invalide (100 caractères maximum).' });
      }
      updates.store_name = store_name.trim();
    }
    if (default_duration !== undefined) {
      const d = Number(default_duration);
      if (!Number.isFinite(d) || d < 1 || d > 3600) {
        return res.status(400).json({ error: 'Durée par défaut invalide (1 à 3600 secondes).' });
      }
      updates.default_duration = String(Math.round(d));
    }
    if (logo !== undefined) {
      // Only an uploaded file path or an http(s) URL — never javascript:/data: URLs
      const okLogo = logo === '' || (typeof logo === 'string' && logo.length <= 500 && /^(\/uploads\/[\w.-]+|https?:\/\/[^\s]+)$/.test(logo));
      if (!okLogo) return res.status(400).json({ error: 'Logo invalide.' });
      updates.logo = logo;
    }

    // One settings row per store (id = store id)
    await fdb.set('settings', storeId, updates);
    await logEvent(null, 'info', 'Paramètres du magasin mis à jour', storeId);

    res.json({ message: 'Paramètres enregistrés avec succès.' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement des paramètres." });
  }
}

module.exports = {
  getSettings,
  updateSettings
};
