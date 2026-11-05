import { useEffect, useSyncExternalStore } from 'react';
import { api } from '../services/api';

/**
 * Store branding (name, logo, default duration) shared by every page, so a change made in
 * Settings shows up in the sidebar immediately — no page reload.
 */
const DEFAULTS = { store_name: 'Mon Magasin', logo: '', default_duration: '5' };
let state = { ...DEFAULTS, loaded: false };
const listeners = new Set();
let inflight = null;

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

export function setStoreSettings(patch) {
  state = { ...state, ...patch };
  emit();
}

export function loadStoreSettings(force = false) {
  if (inflight && !force) return inflight;
  inflight = api
    .get('/settings')
    .then((s) => setStoreSettings({ ...DEFAULTS, ...s, loaded: true }))
    .catch(() => setStoreSettings({ loaded: true }))
    .finally(() => { inflight = null; });
  return inflight;
}

export function useStoreSettings() {
  const snapshot = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state
  );
  useEffect(() => {
    if (!state.loaded) loadStoreSettings();
  }, []);
  return snapshot;
}
