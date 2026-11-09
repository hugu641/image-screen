const { fdb } = require('../database/db');
const { getPlaylistDetails } = require('./playlistController');
const {
  logEvent,
  notifyScreenAssociation,
  notifyPlaylistUpdate,
  forceScreenSync,
  broadcastScreenListUpdate,
  publicScreen
} = require('../services/socketService');

async function listScreens(req, res) {
  try {
    const screens = await fdb.getAll('screens', [], { orderBy: 'last_activity', orderDir: 'desc' });

    // Résoudre le nom de la playlist pour chaque écran
    const result = await Promise.all(screens.map(async (screen) => {
      let playlist_name = null;
      if (screen.playlist_id) {
        const playlist = await fdb.getById('playlists', screen.playlist_id);
        playlist_name = playlist ? playlist.name : null;
      }
      return { ...publicScreen(screen), playlist_name };
    }));

    res.json(result);
  } catch (error) {
    console.error('List screens error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des écrans.' });
  }
}

async function associateScreen(req, res) {
  const { playlistId } = req.body || {};
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';

  if (!code || !name) {
    return res.status(400).json({ error: "Le code d'association et le nom de l'écran sont requis." });
  }

  try {
    const screen = await fdb.getWhere('screens', [{ field: 'code', value: code.toUpperCase() }]);
    if (!screen) {
      return res.status(404).json({ error: "Code d'association invalide. Aucun écran trouvé avec ce code." });
    }

    const playlist_id = playlistId ? String(playlistId) : null;
    let status = playlist_id ? 'connected' : 'waiting_content';

    await fdb.update('screens', screen.id, {
      name,
      playlist_id,
      is_associated: true,
      status,
      last_activity: fdb.serverTimestamp()
    });

    let playlistDetails = null;
    if (playlist_id) {
      playlistDetails = await getPlaylistDetails(playlist_id);
    }

    notifyScreenAssociation(screen.id, name, playlist_id, playlistDetails);
    await logEvent(screen.id, 'info', `Écran associé : ${name} (Code: ${code})`);
    await broadcastScreenListUpdate();

    res.json({ message: 'Écran associé avec succès.', screenId: screen.id });
  } catch (error) {
    console.error('Associate screen error:', error);
    res.status(500).json({ error: "Erreur lors de l'association de l'écran." });
  }
}

async function renameScreen(req, res) {
  const { id } = req.params;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';

  if (!name) {
    return res.status(400).json({ error: "Le nom de l'écran ne peut pas être vide." });
  }

  try {
    const screen = await fdb.getById('screens', id);
    if (!screen) {
      return res.status(404).json({ error: 'Écran introuvable.' });
    }

    await fdb.update('screens', id, { name });
    await logEvent(id, 'info', `Écran renommé : ${screen.name} -> ${name}`);
    await broadcastScreenListUpdate();

    res.json({ message: 'Écran renommé avec succès.', name });
  } catch (error) {
    console.error('Rename screen error:', error);
    res.status(500).json({ error: "Erreur lors du renommage de l'écran." });
  }
}

async function deleteScreen(req, res) {
  const { id } = req.params;

  try {
    const screen = await fdb.getById('screens', id);
    if (!screen) {
      return res.status(404).json({ error: 'Écran introuvable.' });
    }

    await fdb.delete('screens', id);
    await logEvent(null, 'info', `Écran supprimé : ${screen.name}`);
    notifyScreenAssociation(id, null, null, null);
    await broadcastScreenListUpdate();

    res.json({ message: 'Écran supprimé avec succès.' });
  } catch (error) {
    console.error('Delete screen error:', error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'écran." });
  }
}

async function assignPlaylist(req, res) {
  const { id } = req.params;
  const { playlistId } = req.body;

  try {
    const screen = await fdb.getById('screens', id);
    if (!screen) {
      return res.status(404).json({ error: 'Écran introuvable.' });
    }

    const playlist_id = playlistId ? String(playlistId) : null;
    let status = playlist_id ? 'connected' : 'waiting_content';

    if (screen.status === 'offline') {
      status = 'offline';
    }

    await fdb.update('screens', id, { playlist_id, status });

    let playlistDetails = null;
    if (playlist_id) {
      playlistDetails = await getPlaylistDetails(playlist_id);
    }

    notifyPlaylistUpdate(id, playlist_id, playlistDetails);

    const playlistName = playlistDetails ? playlistDetails.name : 'Aucune';
    await logEvent(id, 'info', `Playlist affectée à l'écran ${screen.name} : ${playlistName}`);
    await broadcastScreenListUpdate();

    res.json({ message: 'Playlist affectée avec succès.', playlistId: playlist_id });
  } catch (error) {
    console.error('Assign playlist error:', error);
    res.status(500).json({ error: "Erreur lors de l'affectation de la playlist." });
  }
}

async function triggerSync(req, res) {
  const { id } = req.params;

  try {
    const screen = await fdb.getById('screens', id);
    if (!screen) {
      return res.status(404).json({ error: 'Écran introuvable.' });
    }

    forceScreenSync(id);
    await logEvent(id, 'info', `Synchronisation forcée pour l'écran : ${screen.name}`);

    res.json({ message: 'Commande de synchronisation envoyée.' });
  } catch (error) {
    console.error('Trigger sync error:', error);
    res.status(500).json({ error: "Erreur lors de l'envoi de la commande de synchronisation." });
  }
}

module.exports = {
  listScreens,
  associateScreen,
  renameScreen,
  deleteScreen,
  assignPlaylist,
  triggerSync
};
