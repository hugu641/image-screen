/**
 * serverConfig.js — Single source of truth for the ImageScreen server URL.
 *
 * Priority:
 *  1. localStorage["server_url"]      ← chosen by the user (native apps, remote hosting)
 *  2. import.meta.env.VITE_SERVER_URL ← build-time default (e.g. https://image-screen.app)
 *  3. window.location.origin          ← same-origin, only when served by the backend itself
 *
 * In a native wrapper (Electron / Capacitor) there is no backend on the same origin,
 * so the user must pick a server on first launch (see pages/ServerSetup.jsx).
 */

const STORAGE_KEY = 'server_url';

function safeGet() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Normalise user input: trim, add a scheme if missing, drop trailing slashes/paths. */
export function normalizeServerUrl(input) {
  let value = (input || '').trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) {
    // Bare IPs / localhost / *.local default to http, everything else to https
    const isLocal = /^(localhost|\d{1,3}(\.\d{1,3}){3}|[^/]+\.local)(:\d+)?(\/|$)/i.test(value);
    value = `${isLocal ? 'http' : 'https'}://${value}`;
  }
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

/** True for hosts that only exist on a local network (where plain HTTP is acceptable). */
export function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return false;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.home.arpa')) return true;
  if (!h.includes('.') && !h.includes(':')) return true; // single-label intranet name
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  if (h.includes(':')) return h === '::1' || /^f[cd]/.test(h) || h.startsWith('fe80');
  return false;
}

/** Plain HTTP would expose the login token: only allow it on local networks. */
export function assertTransportIsSafe(origin) {
  const url = new URL(origin);
  if (url.protocol === 'http:' && !isPrivateHost(url.hostname)) {
    throw new Error('Pour un serveur accessible sur Internet, utilisez une adresse en https:// (connexion chiffrée).');
  }
}

/** True when running inside Electron, Capacitor or any file:// wrapper. */
export function isNativeApp() {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'file:' ||
    !!window.Capacitor?.isNativePlatform?.() ||
    !!window.imagescreenNative
  );
}

function getBuildTimeUrl() {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  return envUrl && envUrl.trim() ? normalizeServerUrl(envUrl) : '';
}

/** The server origin to use for API, sockets and media. */
export function getServerUrl() {
  const saved = safeGet();
  if (saved && saved.trim()) return saved.trim().replace(/\/$/, '');
  const built = getBuildTimeUrl();
  if (built) return built;
  return window.location.origin;
}

/** Native apps with no saved/build-time server must show the setup screen. */
export function needsServerSetup() {
  if (!isNativeApp()) return false;
  const saved = safeGet();
  return !(saved && saved.trim()) && !getBuildTimeUrl();
}

export function setServerUrl(url) {
  const normalized = normalizeServerUrl(url);
  if (!normalized) throw new Error('Adresse invalide.');
  assertTransportIsSafe(normalized);
  localStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}

export function clearServerUrl() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Absolute URL for a media path such as "/uploads/abc.jpg". */
export function mediaUrl(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${getServerUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Check that a URL really is an ImageScreen server. Resolves to the normalised origin. */
export async function testServer(input, timeoutMs = 6000) {
  const origin = normalizeServerUrl(input);
  if (!origin) throw new Error("Adresse invalide. Exemple : 192.168.1.50:5000 ou image-screen.app");
  assertTransportIsSafe(origin);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${origin}/api/health`, { signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.app !== 'imagescreen') {
      throw new Error("Ce serveur ne ressemble pas à ImageScreen (ou il est trop ancien).");
    }
    return origin;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Le serveur ne répond pas (délai dépassé).', { cause: err });
    if (err instanceof TypeError) {
      throw new Error('Serveur injoignable. Vérifiez l’adresse, le Wi-Fi et que le serveur est démarré.', { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Navigate to an in-app route, working with both BrowserRouter and file:// HashRouter. */
export function goTo(path) {
  if (window.location.protocol === 'file:') {
    window.location.hash = `#${path}`;
  } else {
    window.location.href = path;
  }
}
