const { fdb } = require('../database/db');
const { logEvent } = require('../services/socketService');

async function getSettings(req, res) {
  try {
    const settings = await fdb.getById('settings', 'config') || {};

    // Valeurs par défaut
    if (!settings.store_name) settings.store_name = 'Mon Magasin';
    if (!settings.default_duration) settings.default_duration = '5';
    if (!settings.logo) settings.logo = '';

    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des paramètres.' });
  }
}

async function updateSettings(req, res) {
  const { store_name, default_duration, logo } = req.body || {};

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

    await fdb.set('settings', 'config', updates);
    await logEvent(null, 'info', 'Paramètres système mis à jour');

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
