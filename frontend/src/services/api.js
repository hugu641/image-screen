/**
 * api.js — Frontend API client
 *
 * The server URL comes from services/serverConfig.js (user choice > build-time
 * VITE_SERVER_URL > same origin), so web, Electron and Android builds share one logic.
 */
import { getServerUrl, mediaUrl, goTo } from './serverConfig';

export function getApiUrl() {
  return `${getServerUrl()}/api`;
}

export function getUploadsUrl() {
  return getServerUrl();
}

/** Absolute URL for a media file path (e.g. "/uploads/x.jpg"). Replaces the old UPLOADS_URL constant. */
export { mediaUrl };

// ─── Helper to build request headers ────────────────────────────────────────

function getHeaders(isMultipart = false) {
  const token = localStorage.getItem('token');
  const headers = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isMultipart) headers['Content-Type'] = 'application/json';

  return headers;
}

// ─── Global fetch wrapper ────────────────────────────────────────────────────

async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    const path = window.location.protocol === 'file:'
      ? window.location.hash.replace(/^#/, '') || '/'
      : window.location.pathname;
    if (!path.startsWith('/tv') && !path.startsWith('/setup') && path !== '/login') {
      goTo('/login');
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Une erreur est survenue.');
  }

  return data;
}

// ─── Exported API helpers ────────────────────────────────────────────────────

export const api = {
  get(endpoint) {
    return request(`${getApiUrl()}${endpoint}`, {
      method: 'GET',
      headers: getHeaders()
    });
  },

  post(endpoint, body) {
    return request(`${getApiUrl()}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return request(`${getApiUrl()}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return request(`${getApiUrl()}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
  },

  patch(endpoint, body) {
    return request(`${getApiUrl()}${endpoint}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body || {})
    });
  },

  upload(endpoint, formData) {
    return request(`${getApiUrl()}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData
    });
  }
};
