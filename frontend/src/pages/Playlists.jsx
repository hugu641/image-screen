import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock,
  Copy,
  EllipsisVertical,
  Film,
  GripVertical,
  Images,
  ListVideo,
  Minus,
  Pencil,
  Plus,
  Save,
  Search,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import { DropdownMenu, MenuItem, MenuSeparator } from '../components/ui/Menu';
import { EmptyState, PageHeader, Segmented, Skeleton, Switch } from '../components/ui/Misc';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/Confirm';
import MediaThumb, { playlistCovers } from '../components/MediaThumb';
import PlaylistPreview from '../components/PlaylistPreview';
import { cn } from '../utils/cn';
import { formatDuration, plural } from '../utils/format';

const TRANSITIONS = [
  { value: 'fade', label: 'Fondu', hint: 'Apparition douce', cls: 'preview-fade' },
  { value: 'zoom', label: 'Zoom', hint: 'Léger zoom avant', cls: 'preview-zoom' },
  { value: 'slide', label: 'Glissement', hint: 'Entrée latérale', cls: 'preview-slide' },
];
const TRANSITION_LABEL = Object.fromEntries(TRANSITIONS.map((t) => [t.value, t.label]));
const DURATION_PRESETS = [5, 8, 10, 15, 30];

let uid = 0;
const makeEntry = (mediaId) => ({ uid: ++uid, mediaId: String(mediaId) });

/* ═══════════════════════════════════════════════════════════════════════════
   List view
   ═══════════════════════════════════════════════════════════════════════════ */
function Mosaic({ medias }) {
  if (medias.length === 0) {
    return (
      <div className="grid h-full w-full place-items-center bg-brand-gradient-soft text-subtle">
        <ListVideo className="size-10 opacity-60" />
      </div>
    );
  }
  if (medias.length < 4) {
    return <MediaThumb media={medias[0]} className="h-full w-full" imgClassName="transition duration-500 group-hover:scale-105" />;
  }
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-black/20">
      {medias.slice(0, 4).map((m) => (
        <MediaThumb key={m.id} media={m} className="h-full w-full" imgClassName="transition duration-500 group-hover:scale-105" />
      ))}
    </div>
  );
}

function PlaylistCard({ playlist, library, screensCount, onOpen, onDuplicate, onDelete }) {
  const covers = playlistCovers(playlist, library, 4);
  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-pop">
      <button
        type="button"
        onClick={() => onOpen(playlist)}
        aria-label={`Modifier la playlist ${playlist.name}`}
        className="block w-full text-left focus-visible:outline-none"
      >
        <div className="relative aspect-video overflow-hidden bg-surface-3">
          <Mosaic medias={covers} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 flex gap-2">
            <span className="rounded-lg bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
              {playlist.media_count || 0} {plural(playlist.media_count || 0, 'média', 'médias')}
            </span>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <h3 className="truncate pr-8 font-display text-base font-bold tracking-tight">{playlist.name}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary" icon={Clock}>{playlist.duration || 5} s / média</Badge>
            <Badge tone="neutral">{TRANSITION_LABEL[playlist.transition] || 'Fondu'}</Badge>
            {playlist.random_order ? <Badge tone="neutral" icon={Shuffle}>Aléatoire</Badge> : null}
            {screensCount > 0 && (
              <Badge tone="success" dot pulse>
                Sur {screensCount} {plural(screensCount, 'écran', 'écrans')}
              </Badge>
            )}
          </div>
        </div>
      </button>
      <div className="absolute right-2.5 top-2.5">
        <DropdownMenu
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={`Actions pour ${playlist.name}`}
              className="grid size-9 place-items-center rounded-xl bg-black/55 text-white backdrop-blur-md transition hover:bg-black/70"
            >
              <EllipsisVertical className="size-[18px]" />
            </button>
          )}
        >
          <MenuItem icon={Pencil} onClick={() => onOpen(playlist)}>Modifier</MenuItem>
          <MenuItem icon={Copy} onClick={() => onDuplicate(playlist)}>Dupliquer</MenuItem>
          <MenuSeparator />
          <MenuItem icon={Trash2} tone="danger" onClick={() => onDelete(playlist)}>Supprimer</MenuItem>
        </DropdownMenu>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Editor
   ═══════════════════════════════════════════════════════════════════════════ */
function TransitionPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Transition entre les médias" className="grid grid-cols-3 gap-3">
      {TRANSITIONS.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'group rounded-2xl border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
              active ? 'border-primary bg-primary/5 shadow-glow' : 'border-line hover:border-line-strong hover:bg-surface-2'
            )}
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
              <div className={cn('absolute inset-0 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500', t.cls)} />
            </div>
            <p className={cn('mt-2.5 text-[13px] font-bold', active && 'text-brand')}>{t.label}</p>
            <p className="text-[11px] text-subtle">{t.hint}</p>
          </button>
        );
      })}
    </div>
  );
}

function DurationStepper({ value, onChange }) {
  const set = (n) => onChange(Math.max(1, Math.min(3600, Math.round(n) || 1)));
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => set(value - 1)} aria-label="Diminuer la durée" className="grid size-10 place-items-center rounded-xl border border-line text-muted transition hover:bg-surface-2 hover:text-fg">
          <Minus className="size-4" />
        </button>
        <div className="relative">
          <input
            type="number"
            min="1"
            max="3600"
            value={value}
            onChange={(e) => set(Number(e.target.value))}
            aria-label="Durée d’affichage en secondes"
            className="input w-24 text-center font-display text-lg font-bold tabular-nums"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-subtle">s</span>
        </div>
        <button type="button" onClick={() => set(value + 1)} aria-label="Augmenter la durée" className="grid size-10 place-items-center rounded-xl border border-line text-muted transition hover:bg-surface-2 hover:text-fg">
          <Plus className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {DURATION_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set(p)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-bold transition',
              value === p ? 'bg-primary/10 text-brand' : 'bg-surface-2 text-muted hover:text-fg'
            )}
          >
            {p} s
          </button>
        ))}
      </div>
    </div>
  );
}

function SequenceRow({ entry, index, total, media, dragging, over, onMove, onRemove, handlers }) {
  const isVideo = media?.mime_type?.startsWith('video/');
  return (
    <li
      {...handlers}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border bg-surface p-2.5 transition-all',
        dragging ? 'opacity-40' : 'opacity-100',
        over ? 'border-primary shadow-glow' : 'border-line hover:border-line-strong'
      )}
    >
      <span className="hidden cursor-grab touch-none text-subtle active:cursor-grabbing sm:block" aria-hidden="true">
        <GripVertical className="size-5" />
      </span>
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-3 text-[11px] font-bold tabular-nums text-muted">{index + 1}</span>
      <MediaThumb media={media} className="h-12 w-[72px] shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={media?.original_name}>{media?.original_name || 'Média supprimé'}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-subtle">
          {isVideo ? <><Film className="size-3" /> Vidéo · durée propre</> : <><Clock className="size-3" /> Durée de la playlist</>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="Monter" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-30">
          <ArrowUp className="size-4" />
        </button>
        <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1} aria-label="Descendre" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-30">
          <ArrowDown className="size-4" />
        </button>
        <button type="button" onClick={() => onRemove(entry.uid)} aria-label="Retirer de la playlist" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger">
          <X className="size-4" />
        </button>
      </div>
    </li>
  );
}

function Editor({ playlistId, library, onBack, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // snapshot of what is stored on the server
  const [form, setForm] = useState({ name: '', duration: 5, transition: 'fade', random_order: false, loop_playback: true });
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const snapshot = useCallback((f, e) => JSON.stringify({ f, ids: e.map((x) => x.mediaId) }), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(`/playlists/${playlistId}`);
      const f = {
        name: d.name,
        duration: Number(d.duration) || 5,
        transition: d.transition || 'fade',
        random_order: Boolean(d.random_order),
        loop_playback: Boolean(d.loop_playback),
      };
      const e = (d.media || []).map((m) => makeEntry(m.id));
      setForm(f);
      setEntries(e);
      setSaved(snapshot(f, e));
    } catch (err) {
      toast.error(err.message || 'Playlist introuvable.');
      onBack();
    } finally {
      setLoading(false);
    }
  }, [playlistId, snapshot, toast, onBack]);

  useEffect(() => { load(); }, [load]);

  const dirty = saved !== null && snapshot(form, entries) !== saved;

  // Warn before closing the tab with unsaved work
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const byId = useMemo(() => new Map(library.map((m) => [String(m.id), m])), [library]);
  const sequence = entries.map((e) => byId.get(e.mediaId)).filter(Boolean);

  const totals = useMemo(() => {
    const images = sequence.filter((m) => !m.mime_type.startsWith('video/')).length;
    const videos = sequence.length - images;
    return { images, videos, seconds: images * form.duration };
  }, [sequence, form.duration]);

  const usage = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => map.set(e.mediaId, (map.get(e.mediaId) || 0) + 1));
    return map;
  }, [entries]);

  const add = (media) => setEntries((prev) => [...prev, makeEntry(media.id)]);
  const remove = (u) => setEntries((prev) => prev.filter((e) => e.uid !== u));
  const move = (i, dir) => setEntries((prev) => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const copy = [...prev];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });
  const reorder = (from, to) => setEntries((prev) => {
    if (from === null || to === null || from === to) return prev;
    const copy = [...prev];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  });

  const save = async () => {
    if (!form.name.trim()) return toast.error('Donnez un nom à la playlist.');
    setSaving(true);
    try {
      await api.put(`/playlists/${playlistId}`, { ...form, name: form.name.trim(), mediaIds: entries.map((e) => e.mediaId) });
      const f = { ...form, name: form.name.trim() };
      setForm(f);
      setSaved(snapshot(f, entries));
      onChanged();
      toast.success('Playlist enregistrée. Les écrans concernés se mettent à jour.');
    } catch (err) {
      toast.error(err.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const goBack = async () => {
    if (dirty) {
      const ok = await confirm({
        tone: 'warning',
        title: 'Quitter sans enregistrer ?',
        message: 'Vos modifications de cette playlist seront perdues.',
        confirmLabel: 'Quitter',
        cancelLabel: 'Rester',
      });
      if (!ok) return;
    }
    onBack();
  };

  const filtered = library.filter((m) => {
    if (filter === 'image' && m.mime_type.startsWith('video/')) return false;
    if (filter === 'video' && !m.mime_type.startsWith('video/')) return false;
    return !query.trim() || m.original_name?.toLowerCase().includes(query.trim().toLowerCase());
  });

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 rounded-2xl lg:col-span-7" />
          <Skeleton className="h-96 rounded-2xl lg:col-span-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky action bar */}
      <div className="glass sticky top-16 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:-mx-6 sm:px-6 lg:top-[72px] lg:-mx-10 lg:px-10">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={goBack}>Playlists</Button>
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor="playlist-name" className="sr-only">Nom de la playlist</label>
          <input
            id="playlist-name"
            value={form.name}
            maxLength={100}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nom de la playlist"
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-xl font-extrabold tracking-tight transition hover:border-line focus:border-primary focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </div>
        {dirty && <Badge tone="warning" dot>Non enregistré</Badge>}
        <Button variant="primary" icon={Save} loading={saving} disabled={!dirty} onClick={save}>Enregistrer</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: settings + sequence */}
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader icon={Clock} title="Diffusion" description="Réglages appliqués sur tous les écrans qui utilisent cette playlist" />
            <CardBody className="space-y-6">
              <div>
                <p className="label">Transition</p>
                <TransitionPicker value={form.transition} onChange={(transition) => setForm({ ...form, transition })} />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="label">Durée d’affichage des images</p>
                  <DurationStepper value={form.duration} onChange={(duration) => setForm({ ...form, duration })} />
                </div>
                <div className="space-y-4 sm:pt-6">
                  <Switch
                    label="Ordre aléatoire"
                    description="Mélange les médias à chaque tour"
                    checked={form.random_order}
                    onChange={(random_order) => setForm({ ...form, random_order })}
                  />
                  <Switch
                    label="Lecture en boucle"
                    description="Recommence à la fin de la liste"
                    checked={form.loop_playback}
                    onChange={(loop_playback) => setForm({ ...form, loop_playback })}
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={ListVideo}
              tone="accent"
              title={`Séquence (${entries.length})`}
              description={
                entries.length === 0
                  ? 'Ajoutez des médias depuis la médiathèque'
                  : `${formatDuration(totals.seconds)}${totals.videos ? ` + ${totals.videos} ${plural(totals.videos, 'vidéo', 'vidéos')}` : ''} par tour`
              }
              action={entries.length > 0 && <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setEntries([])}>Vider</Button>}
            />
            <CardBody className="pt-4">
              {entries.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center">
                  <Images className="mx-auto mb-3 size-8 text-subtle" />
                  <p className="text-sm font-semibold">Votre playlist est vide</p>
                  <p className="mt-1 text-[13px] text-muted">Cliquez sur un média de la médiathèque pour l’ajouter ici.</p>
                </div>
              ) : (
                <ol className="space-y-2" onDragLeave={() => setOverIndex(null)}>
                  {entries.map((entry, i) => (
                    <SequenceRow
                      key={entry.uid}
                      entry={entry}
                      index={i}
                      total={entries.length}
                      media={byId.get(entry.mediaId)}
                      dragging={dragIndex === i}
                      over={overIndex === i && dragIndex !== null && dragIndex !== i}
                      onMove={move}
                      onRemove={remove}
                      handlers={{
                        draggable: true,
                        onDragStart: (e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); },
                        onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverIndex(i); },
                        onDrop: (e) => { e.preventDefault(); reorder(dragIndex, i); setDragIndex(null); setOverIndex(null); },
                        onDragEnd: () => { setDragIndex(null); setOverIndex(null); },
                      }}
                    />
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: preview + library */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="overflow-hidden">
            <CardHeader title="Aperçu" description="Rendu identique à celui de la TV" />
            <CardBody className="pt-4">
              <PlaylistPreview items={sequence} duration={form.duration} transition={form.transition} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={Images} tone="info" title="Médiathèque" description="Cliquez sur un média pour l’ajouter" />
            <CardBody className="space-y-4 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input icon={Search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher dans la médiathèque" wrapperClassName="flex-1" />
                <Segmented
                  size="sm"
                  label="Type de média"
                  value={filter}
                  onChange={setFilter}
                  options={[{ value: 'all', label: 'Tout' }, { value: 'image', label: 'Images' }, { value: 'video', label: 'Vidéos' }]}
                />
              </div>
              {library.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">La médiathèque est vide. Importez des fichiers depuis la page Médiathèque.</p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">Aucun média ne correspond.</p>
              ) : (
                <ul className="grid max-h-[420px] grid-cols-3 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => add(m)}
                        title={`Ajouter « ${m.original_name} »`}
                        className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-line transition hover:border-primary hover:shadow-glow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                      >
                        <MediaThumb media={m} className="h-full w-full" imgClassName="transition duration-300 group-hover:scale-110" />
                        <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="grid size-9 place-items-center rounded-full bg-brand-gradient text-white shadow-btn"><Plus className="size-5" /></span>
                        </span>
                        {usage.get(String(m.id)) > 0 && (
                          <span className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-brand-gradient px-1.5 text-[10px] font-bold leading-5 text-white shadow">
                            ×{usage.get(String(m.id))}
                          </span>
                        )}
                        {m.mime_type.startsWith('video/') && (
                          <span className="absolute bottom-1.5 left-1.5 grid size-5 place-items-center rounded-md bg-black/60 text-white"><Film className="size-3" /></span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Playlists() {
  const toast = useToast();
  const confirm = useConfirm();
  const store = useStoreSettings();
  const [params, setParams] = useSearchParams();
  const editId = params.get('p');
  useDocumentTitle(editId ? 'Éditer une playlist' : 'Playlists');

  const [playlists, setPlaylists] = useState([]);
  const [library, setLibrary] = useState([]);
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const nameInput = useRef(null);

  const refreshPlaylists = useCallback(async () => {
    try { setPlaylists(await api.get('/playlists')); } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [p, m, s] = await Promise.all([api.get('/playlists'), api.get('/media'), api.get('/screens')]);
        setPlaylists(p); setLibrary(m); setScreens(s);
      } catch (err) {
        toast.error(err.message || 'Impossible de charger les playlists.');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const open = useCallback((pl) => setParams({ p: String(pl.id) }), [setParams]);
  const closeEditor = useCallback(() => setParams({}), [setParams]);

  const screensFor = (pl) => screens.filter((s) => String(s.playlist_id) === String(pl.id)).length;

  const create = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!newName.trim()) return setFormError('Le nom de la playlist est obligatoire.');
    setBusy(true);
    try {
      const created = await api.post('/playlists', {
        name: newName.trim(),
        duration: Number(store.default_duration) || 5,
        transition: 'fade',
        random_order: false,
        loop_playback: true,
        mediaIds: [],
      });
      setCreating(false);
      setNewName('');
      await refreshPlaylists();
      open(created);
      toast.success('Playlist créée : ajoutez maintenant vos médias.');
    } catch (err) {
      setFormError(err.message || 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (pl) => {
    try {
      const copy = await api.post(`/playlists/${pl.id}/duplicate`);
      await refreshPlaylists();
      toast.success(`« ${copy.name || 'Copie'} » créée.`);
      open(copy);
    } catch (err) {
      toast.error(err.message || 'Duplication impossible.');
    }
  };

  const remove = async (pl) => {
    const n = screensFor(pl);
    const ok = await confirm({
      tone: 'danger',
      title: `Supprimer « ${pl.name} » ?`,
      message: n > 0
        ? `Cette playlist est diffusée sur ${n} ${plural(n, 'écran', 'écrans')} : ${plural(n, 'il s’arrêtera', 'ils s’arrêteront')} de diffuser. Vos médias ne sont pas supprimés.`
        : 'Vos médias ne sont pas supprimés, seule la liste l’est.',
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;
    try {
      await api.delete(`/playlists/${pl.id}`);
      toast.success('Playlist supprimée.');
      refreshPlaylists();
      api.get('/screens').then(setScreens).catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Suppression impossible.');
    }
  };

  if (editId) {
    return <Editor key={editId} playlistId={editId} library={library} onBack={closeEditor} onChanged={refreshPlaylists} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Playlists"
        description="Composez des boucles de diffusion : choisissez les médias, leur ordre, la durée et la transition."
        actions={<Button variant="primary" icon={Plus} onClick={() => { setFormError(''); setCreating(true); }}>Nouvelle playlist</Button>}
      />

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[300px] rounded-2xl" />)}
        </div>
      ) : playlists.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListVideo}
            title="Créez votre première playlist"
            description="Une playlist est une boucle de photos et de vidéos que vos écrans diffusent en continu."
            action={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Nouvelle playlist</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {playlists.map((pl) => (
            <PlaylistCard
              key={pl.id}
              playlist={pl}
              library={library}
              screensCount={screensFor(pl)}
              onOpen={open}
              onDuplicate={duplicate}
              onDelete={remove}
            />
          ))}
          <button
            type="button"
            onClick={() => { setFormError(''); setCreating(true); }}
            className="group grid min-h-[200px] place-items-center rounded-2xl border-2 border-dashed border-line text-muted transition hover:border-primary/50 hover:bg-primary/5 hover:text-brand"
          >
            <span className="flex flex-col items-center gap-2 text-sm font-semibold">
              <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 transition group-hover:bg-primary/10"><Plus className="size-6" /></span>
              Nouvelle playlist
            </span>
          </button>
        </div>
      )}

      {creating && (
        <Modal
          open
          onClose={() => setCreating(false)}
          icon={ListVideo}
          title="Nouvelle playlist"
          description="Donnez-lui un nom, vous ajouterez les médias juste après."
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreating(false)}>Annuler</Button>
              <Button variant="primary" type="submit" form="create-playlist" loading={busy}>Créer</Button>
            </>
          }
        >
          <form id="create-playlist" onSubmit={create}>
            <Field label="Nom de la playlist" error={formError}>
              {(p) => (
                <Input {...p} ref={nameInput} data-autofocus value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100} placeholder="Ex. Promotions de la semaine" />
              )}
            </Field>
          </form>
        </Modal>
      )}
    </div>
  );
}

