/**
 * Network-related configuration shared by Express and Socket.IO.
 */

// Origins used by the native apps (Capacitor Android / Electron). Always allowed
// because these apps are legitimate clients even when ALLOWED_ORIGINS is restricted.
const NATIVE_ORIGINS = [
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'app://.',
];

function parseAllowedOrigins() {
  const raw = (process.env.ALLOWED_ORIGINS || '').trim();
  if (!raw) return null; // null = any origin (the API is token-based, no cookies)
  return [...new Set([...raw.split(',').map((o) => o.trim()).filter(Boolean), ...NATIVE_ORIGINS])];
}

/** cors/socket.io `origin` option for a list of allowed origins (or null = any). */
function originOption(allowedOrigins) {
  if (!allowedOrigins) return '*';
  return (origin, callback) => {
    // No Origin header = non-browser client (curl, native HTTP) or same-origin request
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  };
}

/**
 * `trust proxy` setting. Only trust X-Forwarded-* headers when explicitly told to
 * (TRUST_PROXY=1 behind one reverse proxy such as Caddy/Nginx), otherwise clients
 * could spoof their IP address.
 */
function trustProxySetting() {
  const v = (process.env.TRUST_PROXY || '').trim().toLowerCase();
  if (!v || v === 'false' || v === '0') return false;
  if (v === 'true') return 1;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? v : n;
}

/** Client IP for a Socket.IO connection, honouring the same trust-proxy rule. */
function socketClientIp(socket) {
  const xff = socket.handshake.headers['x-forwarded-for'];
  if (xff && trustProxySetting()) {
    return String(xff).split(',')[0].trim().slice(0, 64);
  }
  return String(socket.handshake.address || '').replace(/^.*:/, '').slice(0, 64) || '127.0.0.1';
}

module.exports = { parseAllowedOrigins, originOption, trustProxySetting, socketClientIp };
