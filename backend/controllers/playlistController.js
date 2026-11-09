const { fdb } = require('../database/db');
const { logEvent, notifyPlaylistUpdate } = require('../services/socketService');

// ─── Helper : détails complets d'une playlist ─────────────────────────────────
async function getPlaylistDetails(playlistId) {
  const playlist = await fdb.getById('playlists', playlistId);
  if (!playlist) return null;

  const items = [];
  if (playlist.items && Array.isArray(playlist.items)) {
    const sortedItems = [...playlist.items].sort((a, b) => a.position - b.position);
    for (const item of sortedItems) {
      const media = await fdb.getById('media', item.mediaId);
      // Only media of the playlist's own store can appear in it
      if (media && media.store_id === playlist.store_id) {
        items.push({
          ...media,
          position: item.position,
          custom_duration: item.custom_duration || null
        });
      }
    }
  }

  return {
    ...playlist,
    media: items
  };
}

// ─── Helper : notifier les écrans affectés à une playlist ─────────────────────
async function syncAssignedScreens(playlistId) {
  try {
    const details = await getPlaylistDetails(playlistId);
    if (!details) return;

    const screens = await fdb.getAll('screens', [{ field: 'playlist_id', value: String(playlistId) }]);
    for (const screen of screens) {
      notifyPlaylistUpdate(screen.id, playlistId, details);
    }
  } catch (error) {
    console.error('Failed to sync screens on playlist update:', error);
  }
}

// ─── Helper : écrire les items dans la playlist ────────────────────────
async function writePlaylistItems(playlistId, mediaIds) {
  const items = [];
  if (mediaIds && Array.isArray(mediaIds)) {
    for (let i = 0; i < mediaIds.length; i++) {
      items.push({
        mediaId: String(mediaIds[i]),
        position: i,
        custom_duration: null
      });
    }
  }
  await fdb.update('playlists', playlistId, { items });
}

/** True only when every media id exists AND belongs to the given store. */
async function mediaOwnedBy(mediaIds, storeId) {
  for (const id of mediaIds) {
    const media = await fdb.getById('media', id);
    if (!media || media.store_id !== storeId) return false;
  }
  return true;
}

// ─── Input validation ─────────────────────────────────────────────────────────
const TRANSITIONS = ['fade', 'zoom', 'slide'];

/** Returns { error } or sanitized { name, duration, transition, mediaIds }. */
function sanitizePlaylistInput({ name, duration, transition, mediaIds }) {
  if (typeof name !== 'string' || name.trim() === '') return { error: 'Le nom de la playlist est obligatoire.' };
  const cleanName = name.trim().slice(0, 100);
  const d = Number(duration);
  const cleanDuration = Number.isFinite(d) && d > 0 ? Math.min(Math.round(d), 3600) : 5;
  const cleanTransition = TRANSITIONS.includes(transition) ? transition : 'fade';
  let ids = [];
  if (mediaIds !== undefined && mediaIds !== null) {
    if (!Array.isArray(mediaIds) || mediaIds.length > 1000) return { error: 'Liste de médias invalide.' };
    ids = mediaIds.map((m) => String(m).slice(0, 64));
  }
  return { name: cleanName, duration: cleanDuration, transition: cleanTransition, mediaIds: ids };
}

const NOT_IN_STORE = { error: 'Un des médias sélectionnés est introuvable dans votre magasin.' };

// ─── Actions ──────────────────────────────────────────────────────────────────

async function createPlaylist(req, res) {
  const storeId = req.user.storeId;
  const { random_order, loop_playback } = req.body || {};
  const input = sanitizePlaylistInput(req.body || {});
  if (input.error) return res.status(400).json({ error: input.error });
  const { name, duration, transition, mediaIds } = input;

  try {
    const existing = await fdb.getWhere('playlists', [
      { field: 'name', value: name },
      { field: 'store_id', value: storeId },
    ]);
    if (existing) {
      return res.status(400).json({ error: 'Une playlist avec ce nom existe déjà.' });
    }
    if (!(await mediaOwnedBy(mediaIds, storeId))) return res.status(400).json({ error: NOT_IN_STORE.error });

    const playlistId = await fdb.add('playlists', {
      name,
      duration: duration || 5,
      transition: transition || 'fade',
      random_order: random_order ? true : false,
      loop_playback: loop_playback !== undefined ? (loop_playback ? true : false) : true,
      store_id: storeId,
    });

    await writePlaylistItems(playlistId, mediaIds);
    await logEvent(null, 'info', `Playlist créée : ${name}`, storeId);

    const newPlaylist = await getPlaylistDetails(playlistId);
    res.status(201).json(newPlaylist);
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la playlist.' });
  }
}

async function listPlaylists(req, res) {
  try {
    const playlists = await fdb.getAll('playlists', [{ field: 'store_id', value: req.user.storeId }], { orderBy: 'created_at', orderDir: 'desc' });

    const result = playlists.map((p) => {
      const media_count = (p.items && Array.isArray(p.items)) ? p.items.length : 0;
      return { ...p, media_count };
    });

    res.json(result);
  } catch (error) {
    console.error('List playlists error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des playlists.' });
  }
}

async function getPlaylist(req, res) {
  const { id } = req.params;

  try {
    const details = await getPlaylistDetails(id);
    if (!details || details.store_id !== req.user.storeId) {
      return res.status(404).json({ error: 'Playlist introuvable.' });
    }
    res.json(details);
  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la playlist.' });
  }
}

async function updatePlaylist(req, res) {
  const { id } = req.params;
  const storeId = req.user.storeId;
  const { random_order, loop_playback } = req.body || {};
  const input = sanitizePlaylistInput(req.body || {});
  if (input.error) return res.status(400).json({ error: input.error });
  const { name, duration, transition, mediaIds } = input;

  try {
    const playlist = await fdb.getById('playlists', id);
    if (!playlist || playlist.store_id !== storeId) {
      return res.status(404).json({ error: 'Playlist introuvable.' });
    }
    if (!(await mediaOwnedBy(mediaIds, storeId))) return res.status(400).json({ error: NOT_IN_STORE.error });

    await fdb.update('playlists', id, {
      name,
      duration,
      transition,
      random_order: random_order ? true : false,
      loop_playback: loop_playback ? true : false
    });

    await writePlaylistItems(id, mediaIds);
    await logEvent(null, 'info', `Playlist mise à jour : ${name}`, storeId);
    await syncAssignedScreens(id);

    const updated = await getPlaylistDetails(id);
    res.json(updated);
  } catch (error) {
    console.error('Update playlist error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la playlist.' });
  }
}

async function deletePlaylist(req, res) {
  const { id } = req.params;
  const storeId = req.user.storeId;

  try {
    const playlist = await fdb.getById('playlists', id);
    if (!playlist || playlist.store_id !== storeId) {
      return res.status(404).json({ error: 'Playlist introuvable.' });
    }

    const screens = await fdb.getAll('screens', [{ field: 'playlist_id', value: String(id) }]);

    await fdb.delete('playlists', id);
    await logEvent(null, 'info', `Playlist supprimée : ${playlist.name}`, storeId);

    // Notifier les écrans affectés
    for (const screen of screens) {
      notifyPlaylistUpdate(screen.id, null, null);
    }

    res.json({ message: 'Playlist supprimée avec succès.' });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la playlist.' });
  }
}

async function duplicatePlaylist(req, res) {
  const { id } = req.params;
  const storeId = req.user.storeId;

  try {
    const source = await getPlaylistDetails(id);
    if (!source || source.store_id !== storeId) {
      return res.status(404).json({ error: 'Playlist source introuvable.' });
    }

    let copyName = `Copie de ${source.name}`;
    let counter = 1;
    while (true) {
      const exists = await fdb.getWhere('playlists', [
        { field: 'name', value: copyName },
        { field: 'store_id', value: storeId },
      ]);
      if (!exists) break;
      copyName = `Copie de ${source.name} (${counter++})`;
    }

    const items = source.media.map(item => ({
      mediaId: String(item.id),
      position: item.position,
      custom_duration: item.custom_duration || null
    }));

    const newId = await fdb.add('playlists', {
      name: copyName,
      duration: source.duration,
      transition: source.transition,
      random_order: source.random_order,
      loop_playback: source.loop_playback,
      items,
      store_id: storeId,
    });

    await logEvent(null, 'info', `Playlist dupliquée : ${source.name} -> ${copyName}`, storeId);

    const copyDetails = await getPlaylistDetails(newId);
    res.status(201).json(copyDetails);
  } catch (error) {
    console.error('Duplicate playlist error:', error);
    res.status(500).json({ error: 'Erreur lors de la duplication de la playlist.' });
  }
}

module.exports = {
  createPlaylist,
  listPlaylists,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  duplicatePlaylist,
  getPlaylistDetails
};
