/**
 * socket.js — Socket.IO client
 *
 * Uses the same server URL resolution as api.js (see serverConfig.js).
 */
import { io } from 'socket.io-client';
import { getServerUrl } from './serverConfig';

const getSocketUrl = getServerUrl;

let socket = null;

/**
 * Initialize (or re-initialize) the socket connection.
 * @param {'admin'|'screen'} type
 * @param {string|null} screenId  — required when type === 'screen'
 */
export function initSocket(type, screenId = null) {
  if (socket) {
    socket.disconnect();
  }

  const query = { type };
  if (screenId) query.screenId = screenId;

  socket = io(getSocketUrl(), {
    query,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
    // Allow credentials when server enforces a stricter CORS policy (cloud mode)
    withCredentials: true
  });

  socket.on('connect', () => {
    console.log(`[Socket] ✅ Connected as ${type} to ${getSocketUrl()}`);
  });

  socket.on('connect_error', (err) => {
    console.warn(`[Socket] ⚠️  Connection error: ${err.message}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] 🔌 Disconnected: ${reason}`);
  });

  return socket;
}

/** Return the current socket instance (may be null before initSocket is called). */
export function getSocket() {
  return socket;
}

/** Gracefully disconnect and clear the socket reference. */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
