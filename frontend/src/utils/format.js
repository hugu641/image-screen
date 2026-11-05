const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
  : null;

/** 1536 → "1,5 Ko" */
export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / Math.pow(1024, i);
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: value >= 100 || i === 0 ? 0 : 1 })} ${units[i]}`;
}

/** Date → "il y a 5 minutes" / "hier" / "12 mars" */
export function relativeTime(input) {
  if (!input) return 'Jamais';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Math.round((date.getTime() - Date.now()) / 1000); // seconds, negative = past
  const abs = Math.abs(diff);
  if (abs < 45) return "à l'instant";
  if (!rtf) return date.toLocaleString('fr-FR');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Seconds → "1 min 20 s" */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m) return sec ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}

export function formatTime(input) {
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(input, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', opts);
}

export function initials(value) {
  const parts = String(value || '?').split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] || '?') + (parts.length > 1 ? parts[1][0] : '');
  return letters.toUpperCase();
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Bonsoir';
  if (h < 18) return 'Bonjour';
  return 'Bonsoir';
}

/** Deterministic hue (0-360) from a string, used for avatar gradients. */
export function hueFrom(str) {
  let hash = 0;
  for (const ch of String(str)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 360;
}

export function plural(n, one, many) {
  return n > 1 ? many : one;
}
