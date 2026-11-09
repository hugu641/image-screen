const crypto = require('crypto');
const { Server } = require('socket.io');
const { fdb } = require('../database/db');
const { originOption, socketClientIp } = require('../config/network');
const { verifyToken } = require('../controllers/authController');

let io = null;
const activeScreens = new Map(); // screenId -> socketId

const SCREEN_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SCREEN_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const PAIRING_CODE_RE = /^[A-Z0-9]{6}$/;

// ─── Abuse protection ───────────────────────────────────────────────────────
// Screens connect without an account (that is how pairing works), so anonymous traffic is
// throttled: connections per IP, new screens per IP, a cap on never-paired screens, and a
// per-socket event budget.
const MAX_PENDING_SCREENS = Number(process.env.MAX_PENDING_SCREENS) || 50;
const CONNECTIONS_PER_MIN = Number(process.env.SOCKET_CONNECTIONS_PER_MIN) || 120;
const NEW_SCREENS_PER_HOUR = Number(process.env.NEW_SCREENS_PER_HOUR) || 30;
const windows = new Map(); // `${kind}:${ip}` -> { count, resetAt }

/** Fixed-window counter. Returns true when the action is allowed. */
function allow(kind, ip, limit, windowMs) {
  const key = `${kind}:${ip}`;
  const now = Date.now();
  let w = windows.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowMs };
    windows.set(key, w);
  }
  w.count += 1;
  return w.count <= limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
}, 60 * 1000).unref();

/** Per-socket token bucket: 30 events burst, 5 events/s sustained; gross abuse = disconnect. */
function throttleSocketEvents(socket) {
  let tokens = 30;
  let last = Date.now();
  let dropped = 0;
  socket.use((packet, next) => {
    const now = Date.now();
    tokens = Math.min(30, tokens + ((now - last) / 1000) * 5);
    last = now;
    if (tokens >= 1) {
      tokens -= 1;
      return next();
    }
    dropped += 1;
    if (dropped > 200) socket.disconnect(true);
    // event silently dropped
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

/** Never send the screen secret to admins. */
function publicScreen(screen) {
  if (!screen) return screen;
  // eslint-disable-next-line no-unused-vars
  const { token_hash, ...rest } = screen;
  return rest;
}

/**
 * Connection authentication:
 *  - admin sockets must present a valid JWT (handshake auth.token);
 *  - screen sockets must present their per-device secret (auth.screenToken). The first time a
 *    screen id is seen its secret hash is stored (trust on first use); afterwards only the
 *    device holding the secret can connect as that screen.
 */
async function authenticate(socket, next) {
  try {
    if (!allow('conn', socketClientIp(socket), CONNECTIONS_PER_MIN, 60 * 1000)) {
      return next(new Error('rate_limited'));
    }
    const { type, screenId } = socket.handshake.query;
    const auth = socket.handshake.auth || {};

    if (type === 'admin') {
      const user = await verifyToken(auth.token);
      if (!user || user.must_change_password) return next(new Error('unauthorized'));
      socket.data.role = 'admin';
      socket.data.userId = user.id;
      return next();
    }

    if (type === 'screen') {
      if (!SCREEN_ID_RE.test(String(screenId || '')) || !SCREEN_TOKEN_RE.test(String(auth.screenToken || ''))) {
        return next(new Error('unauthorized'));
      }
      const incoming = hashToken(auth.screenToken);
      const existing = await fdb.getById('screens', screenId);
      if (existing && existing.token_hash && !safeEqualHex(existing.token_hash, incoming)) {
        return next(new Error('unauthorized'));
      }
      if (existing && !existing.token_hash) {
        await fdb.update('screens', screenId, { token_hash: incoming }); // adopt legacy screen
      }
      socket.data.role = 'screen';
      socket.data.screenId = screenId;
      socket.data.tokenHash = incoming;
      return next();
    }

    return next(new Error('unauthorized'));
  } catch (err) {
    console.error('Socket auth error:', err);
    return next(new Error('unauthorized'));
  }
}

function num(v, max = 1e9) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
}

function init(server, allowedOrigins = null) {
  io = new Server(server, {
    maxHttpBufferSize: 64 * 1024,
    cors: {
      origin: originOption(allowedOrigins),
      methods: ['GET', 'POST'],
    },
  });

  io.use(authenticate);

  io.on('connection', (socket) => {
    throttleSocketEvents(socket);

    if (socket.data.role === 'admin') {
      socket.join('admins');
      console.log(`Admin connected: ${socket.id}`);
    } else if (socket.data.role === 'screen') {
      const screenId = socket.data.screenId;
      socket.join(`screen:${screenId}`);
      socket.screenId = screenId;
      activeScreens.set(screenId, socket.id);
      console.log(`Screen connected: ${screenId} (Socket: ${socket.id})`);

      handleScreenConnection(screenId, socket);
    }

    // Handlers (screen only: the screen identity always comes from the authenticated socket)
    socket.on('screen:register', async (data) => {
      if (socket.data.role !== 'screen' || !data || typeof data !== 'object') return;
      const id = socket.data.screenId;
      const code = String(data.code || '').toUpperCase();
      const name = typeof data.name === 'string' ? data.name.trim().slice(0, 60) : '';
      if (!PAIRING_CODE_RE.test(code)) return;

      const ipAddress = socketClientIp(socket);

      try {
        const existing = await fdb.getById('screens', id);

        if (!existing) {
          // New screen. Anonymous clients may only create a limited number of pending screens.
          if (!allow('newscreen', ipAddress, NEW_SCREENS_PER_HOUR, 60 * 60 * 1000) ||
              (await fdb.countPendingScreens()) >= MAX_PENDING_SCREENS) {
            socket.emit('screen:error', { code: 'too_many_pending_screens' });
            socket.disconnect(true);
            return;
          }
          // Create with a fixed id and remember the device secret
          await fdb.set('screens', id, {
            id,
            name: name || `Écran ${code}`,
            code,
            ip_address: ipAddress,
            status: 'not_associated',
            last_activity: fdb.serverTimestamp(),
            is_associated: false,
            playlist_id: null,
            token_hash: socket.data.tokenHash,
          });

          await logEvent(id, 'info', `Nouvel écran détecté : ${name || 'Écran ' + code} (${ipAddress})`);
        } else {
          let newStatus = 'not_associated';
          if (existing.is_associated) {
            newStatus = existing.playlist_id ? 'connected' : 'waiting_content';
          }

          await fdb.update('screens', id, {
            ip_address: ipAddress,
            status: newStatus,
            last_activity: fdb.serverTimestamp()
          });
        }

        broadcastScreenListUpdate();

        // Tell the screen its authoritative state, so it resumes after a reboot / reconnection
        // (or goes back to showing its pairing code if it was dissociated in the meantime).
        const current = await fdb.getById('screens', id);
        if (current && current.is_associated) {
          // Lazy require: playlistController itself requires this module
          const { getPlaylistDetails } = require('../controllers/playlistController');
          const playlistDetails = current.playlist_id ? await getPlaylistDetails(current.playlist_id) : null;
          socket.emit('screen:associated', {
            name: current.name,
            playlistId: current.playlist_id || null,
            playlistDetails,
          });
        } else {
          socket.emit('screen:associated', { name: null, playlistId: null, playlistDetails: null });
        }
      } catch (err) {
        console.error('Error in screen:register:', err);
      }
    });

    socket.on('screen:heartbeat', async () => {
      if (socket.data.role !== 'screen') return;
      const id = socket.data.screenId;

      try {
        const screen = await fdb.getById('screens', id);
        if (screen) {
          let status = 'not_associated';
          if (screen.is_associated) {
            status = screen.playlist_id ? 'connected' : 'waiting_content';
          }

          await fdb.update('screens', id, {
            last_activity: fdb.serverTimestamp(),
            status
          });

          broadcastScreenStatus(id, status);
        }
      } catch (err) {
        console.error('Error in screen:heartbeat:', err);
      }
    });

    // Screen reports its current slide for Live Preview
    socket.on('screen:preview_slide', (data) => {
      if (socket.data.role !== 'screen' || !data || typeof data !== 'object') return;
      io.to('admins').emit(`screen:preview:${socket.data.screenId}`, {
        mediaId: data.mediaId == null ? null : String(data.mediaId).slice(0, 64),
        index: num(data.index, 100000),
        total: num(data.total, 100000),
        progress: num(data.progress, 100),
      });
    });

    socket.on('disconnect', async () => {
      if (socket.screenId) {
        const id = socket.screenId;
        console.log(`Screen disconnected: ${id}`);
        if (activeScreens.get(id) === socket.id) activeScreens.delete(id);

        try {
          const screen = await fdb.getById('screens', id);
          if (screen) {
            let offlineStatus = 'offline';
            if (!screen.is_associated) {
              offlineStatus = 'not_associated';
            }

            await fdb.update('screens', id, {
              status: offlineStatus,
              last_activity: fdb.serverTimestamp()
            });

            await logEvent(id, 'info', `Écran déconnecté : ${screen.name}`);
            broadcastScreenStatus(id, offlineStatus);
          }
        } catch (err) {
          console.error('Error updating screen on disconnect:', err);
        }
      } else {
        console.log(`Admin disconnected: ${socket.id}`);
      }
    });
  });
}

// Helpers
async function handleScreenConnection(screenId, socket) {
  const ipAddress = socketClientIp(socket);
  try {
    const screen = await fdb.getById('screens', screenId);
    if (screen) {
      let status = 'not_associated';
      if (screen.is_associated) {
        status = screen.playlist_id ? 'connected' : 'waiting_content';
      }
      await fdb.update('screens', screenId, {
        ip_address: ipAddress,
        status,
        last_activity: fdb.serverTimestamp()
      });
      await logEvent(screenId, 'info', `Écran connecté : ${screen.name}`);
      broadcastScreenStatus(screenId, status);
    }
  } catch (err) {
    console.error(err);
  }
}

async function broadcastScreenListUpdate() {
  if (!io) return;
  try {
    const screens = await fdb.getAll('screens', [], { orderBy: 'last_activity', orderDir: 'desc' });

    // Résoudre les noms de playlists
    const result = await Promise.all(screens.map(async (screen) => {
      let playlist_name = null;
      if (screen.playlist_id) {
        const playlist = await fdb.getById('playlists', screen.playlist_id);
        playlist_name = playlist ? playlist.name : null;
      }
      return { ...publicScreen(screen), playlist_name };
    }));

    io.to('admins').emit('screens:list', result);
  } catch (err) {
    console.error(err);
  }
}

function broadcastScreenStatus(screenId, status) {
  if (io) {
    io.to('admins').emit('screen:status_update', { id: screenId, status });
  }
}

async function logEvent(screenId, eventType, message) {
  try {
    const newId = await fdb.add('events', {
      screen_id: screenId,
      event_type: eventType,
      message,
      timestamp: fdb.serverTimestamp()
    });

    if (io) {
      const event = await fdb.getById('events', newId);
      io.to('admins').emit('event:new', event);
    }
  } catch (err) {
    console.error('Failed to log event:', err);
  }
}

// Service APIs called from Controllers
function notifyPlaylistUpdate(screenId, playlistId, playlistDetails) {
  if (io) {
    console.log(`Notifying screen ${screenId} of playlist update:`, playlistId);
    io.to(`screen:${screenId}`).emit('screen:update_playlist', { playlistId, playlistDetails });
  }
}

function notifyScreenAssociation(screenId, name, playlistId, playlistDetails) {
  if (io) {
    console.log(`Notifying screen ${screenId} of association.`);
    io.to(`screen:${screenId}`).emit('screen:associated', { name, playlistId, playlistDetails });
  }
}

function forceScreenSync(screenId) {
  if (io) {
    console.log(`Forcing screen sync: ${screenId}`);
    io.to(`screen:${screenId}`).emit('screen:force_sync');
  }
}

module.exports = {
  init,
  publicScreen,
  notifyPlaylistUpdate,
  notifyScreenAssociation,
  forceScreenSync,
  logEvent,
  broadcastScreenListUpdate
};
