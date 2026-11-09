import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Eye,
  Film,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Pencil,
  Search,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api, mediaUrl } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import { DropdownMenu, MenuItem, MenuSeparator } from '../components/ui/Menu';
import { EmptyState, PageHeader, ProgressBar, Segmented, Skeleton } from '../components/ui/Misc';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/Confirm';
import MediaThumb from '../components/MediaThumb';
import { cn } from '../utils/cn';
import { formatBytes, formatDate, plural } from '../utils/format';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const BATCH = 5; // server accepts at most 5 files per request
const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4';

const isVideo = (m) => m.mime_type?.startsWith('video/');

/* ── Lightbox ─────────────────────────────────────────────────────────── */
function Lightbox({ items, index, onIndex, onClose, onRename, onDelete }) {
  const item = items[index];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') onIndex((index + 1) % items.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + items.length) % items.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, items.length, onIndex]);

  if (!item) return null;
  return (
    <Modal
      open
      onClose={onClose}
      size="full"
      title={item.original_name}
      description={`${item.mime_type} · ${formatBytes(item.size)} · ajouté le ${formatDate(item.created_at)}`}
      footer={
        <>
          <Button variant="soft-danger" icon={Trash2} onClick={() => onDelete(item)}>Supprimer</Button>
          <Button variant="secondary" icon={Pencil} onClick={() => onRename(item)}>Renommer</Button>
        </>
      }
    >
      <div className="relative grid min-h-[40vh] place-items-center overflow-hidden rounded-2xl bg-black">
        {isVideo(item) ? (
          <video key={item.id} src={mediaUrl(item.filepath)} controls autoPlay className="max-h-[62vh] w-full" />
        ) : (
          <img key={item.id} src={mediaUrl(item.filepath)} alt={item.original_name} className="max-h-[62vh] w-full animate-pop object-contain" />
        )}
        {items.length > 1 && (
          <>
            <button type="button" onClick={() => onIndex((index - 1 + items.length) % items.length)} aria-label="Média précédent" className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75">
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" onClick={() => onIndex((index + 1) % items.length)} aria-label="Média suivant" className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75">
              <ChevronRight className="size-6" />
            </button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
              {index + 1} / {items.length}
            </span>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Card (grid) ──────────────────────────────────────────────────────── */
function MediaCard({ item, selected, selecting, onSelect, onOpen, onRename, onDelete }) {
  return (
    <Card className={cn('group overflow-hidden transition-all hover:shadow-pop', selected && 'ring-2 ring-primary')}>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-3">
        <button type="button" onClick={() => (selecting ? onSelect(item) : onOpen(item))} aria-label={`Ouvrir ${item.original_name}`} className="block h-full w-full focus-visible:outline-none">
          <MediaThumb media={item} className="h-full w-full" imgClassName="transition duration-500 group-hover:scale-105" />
        </button>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/25 opacity-80" />

        <button
          type="button"
          onClick={() => onSelect(item)}
          aria-label={selected ? 'Désélectionner' : 'Sélectionner'}
          aria-pressed={selected}
          className={cn(
            'absolute left-2.5 top-2.5 grid size-8 place-items-center rounded-lg backdrop-blur-md transition',
            selected ? 'bg-primary text-white opacity-100' : 'bg-black/50 text-white opacity-0 hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
            selecting && 'opacity-100'
          )}
        >
          {selected ? <CheckSquare className="size-[18px]" /> : <Square className="size-[18px]" />}
        </button>

        <div className="absolute right-2.5 top-2.5">
          <DropdownMenu
            trigger={(props) => (
              <button type="button" {...props} aria-label={`Actions pour ${item.original_name}`} className="grid size-8 place-items-center rounded-lg bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70">
                <EllipsisVertical className="size-[18px]" />
              </button>
            )}
          >
            <MenuItem icon={Eye} onClick={() => onOpen(item)}>Afficher</MenuItem>
            <MenuItem icon={Pencil} onClick={() => onRename(item)}>Renommer</MenuItem>
            <MenuSeparator />
            <MenuItem icon={Trash2} tone="danger" onClick={() => onDelete(item)}>Supprimer</MenuItem>
          </DropdownMenu>
        </div>

        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-md">
          {isVideo(item) ? <Film className="size-3" /> : <ImageIcon className="size-3" />}
          {isVideo(item) ? 'Vidéo' : 'Image'}
        </span>
      </div>
      <div className="px-3.5 py-3">
        <p className="truncate text-[13px] font-semibold" title={item.original_name}>{item.original_name}</p>
        <p className="mt-0.5 text-[11px] text-subtle">{formatBytes(item.size)} · {formatDate(item.created_at, { day: 'numeric', month: 'short' })}</p>
      </div>
    </Card>
  );
}

/* ── Row (list) ───────────────────────────────────────────────────────── */
function MediaRow({ item, selected, onSelect, onOpen, onRename, onDelete }) {
  return (
    <li className={cn('flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2/70 sm:gap-4 sm:px-4', selected && 'bg-primary/5')}>
      <button type="button" onClick={() => onSelect(item)} aria-pressed={selected} aria-label={selected ? 'Désélectionner' : 'Sélectionner'} className="text-subtle hover:text-fg">
        {selected ? <CheckSquare className="size-5 text-brand" /> : <Square className="size-5" />}
      </button>
      <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus-visible:outline-none" aria-label={`Ouvrir ${item.original_name}`}>
        <MediaThumb media={item} className="h-12 w-[72px] shrink-0 rounded-lg" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{item.original_name}</span>
          <span className="block text-xs text-subtle sm:hidden">{formatBytes(item.size)}</span>
        </span>
      </button>
      <Badge tone={isVideo(item) ? 'accent' : 'info'} icon={isVideo(item) ? Film : ImageIcon} className="hidden sm:inline-flex">{isVideo(item) ? 'Vidéo' : 'Image'}</Badge>
      <span className="hidden w-20 text-right text-xs tabular-nums text-muted sm:block">{formatBytes(item.size)}</span>
      <span className="hidden w-28 text-right text-xs text-subtle md:block">{formatDate(item.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <div className="flex shrink-0 gap-0.5">
        <button type="button" onClick={() => onRename(item)} aria-label="Renommer" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg"><Pencil className="size-4" /></button>
        <button type="button" onClick={() => onDelete(item)} aria-label="Supprimer" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"><Trash2 className="size-4" /></button>
      </div>
    </li>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function MediaLibrary() {
  useDocumentTitle('Médiathèque');
  const toast = useToast();
  const confirm = useConfirm();

  const [media, setMedia] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [type, setType] = useState('all');
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('media_view') || 'grid'; } catch { return 'grid'; }
  });
  const [selected, setSelected] = useState(() => new Set());
  const [lightbox, setLightbox] = useState(null); // index in `visible`
  const [renaming, setRenaming] = useState(null);

  const [upload, setUpload] = useState(null); // { progress, label }
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInput = useRef(null);

  const fetchMedia = useCallback(async () => {
    try {
      const [list, u] = await Promise.all([
        api.get(`/media?search=${encodeURIComponent(search)}&sort=${encodeURIComponent(sort)}`),
        api.get('/media/usage').catch(() => null),
      ]);
      setMedia(list);
      setUsage(u);
    } catch (err) {
      toast.error(err.message || 'Impossible de charger la médiathèque.');
    } finally {
      setLoading(false);
    }
  }, [search, sort, toast]);

  useEffect(() => {
    const t = setTimeout(fetchMedia, 250);
    return () => clearTimeout(t);
  }, [fetchMedia]);

  const changeView = (v) => {
    setView(v);
    try { localStorage.setItem('media_view', v); } catch { /* ignore */ }
  };

  const visible = useMemo(
    () => media.filter((m) => (type === 'image' ? !isVideo(m) : type === 'video' ? isVideo(m) : true)),
    [media, type]
  );
  const counts = useMemo(() => ({
    all: media.length,
    image: media.filter((m) => !isVideo(m)).length,
    video: media.filter(isVideo).length,
  }), [media]);

  /* Upload (batches of 5 with overall progress) */
  const uploadFiles = useCallback(async (fileList) => {
    const all = [...fileList];
    const tooBig = all.filter((f) => f.size > MAX_FILE_BYTES);
    tooBig.forEach((f) => toast.error(`« ${f.name} » dépasse 100 Mo et n’a pas été envoyé.`));
    const files = all.filter((f) => f.size <= MAX_FILE_BYTES);
    if (!files.length) return;

    const totalBytes = files.reduce((n, f) => n + f.size, 0);
    let doneBytes = 0;
    let sent = 0;
    setUpload({ progress: 0, label: `Envoi de ${files.length} ${plural(files.length, 'fichier', 'fichiers')}…` });

    try {
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const batchBytes = batch.reduce((n, f) => n + f.size, 0);
        const fd = new FormData();
        batch.forEach((f) => fd.append('files', f));
        await api.uploadWithProgress('/media/upload', fd, (p) => {
          const overall = (doneBytes + p * batchBytes) / totalBytes;
          setUpload({
            progress: overall,
            label: p >= 1 ? 'Optimisation des images…' : `Envoi de ${files.length} ${plural(files.length, 'fichier', 'fichiers')}…`,
          });
        });
        doneBytes += batchBytes;
        sent += batch.length;
      }
      toast.success(`${sent} ${plural(sent, 'fichier ajouté', 'fichiers ajoutés')} à la médiathèque.`);
    } catch (err) {
      toast.error(err.message || 'Le téléversement a échoué.', sent ? { title: `${sent} fichier(s) envoyé(s) avant l’erreur` } : undefined);
    } finally {
      setUpload(null);
      fetchMedia();
    }
  }, [fetchMedia, toast]);

  /* Page-wide drag & drop */
  useEffect(() => {
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current++; setDragging(true); };
    const over = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const leave = (e) => { if (!hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [uploadFiles]);

  /* Selection + delete */
  const toggle = (item) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
    return next;
  });
  const selecting = selected.size > 0;

  const deleteItems = async (items) => {
    const many = items.length > 1;
    const ok = await confirm({
      tone: 'danger',
      title: many ? `Supprimer ${items.length} médias ?` : `Supprimer « ${items[0].original_name} » ?`,
      message: 'Ces fichiers seront définitivement supprimés et retirés des playlists qui les utilisent. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
    });
    if (!ok) return;
    const results = await Promise.allSettled(items.map((m) => api.delete(`/media/${m.id}`)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    const removed = items.length - failed;
    if (removed) toast.success(`${removed} ${plural(removed, 'média supprimé', 'médias supprimés')}.`);
    if (failed) toast.error(`${failed} ${plural(failed, 'suppression a échoué', 'suppressions ont échoué')}.`);
    setSelected(new Set());
    setLightbox(null);
    fetchMedia();
  };

  const usedRatio = usage ? usage.used / usage.max : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Médiathèque"
        description="Importez vos photos et vidéos. Les images sont automatiquement redimensionnées et optimisées pour l’affichage TV."
        actions={
          <>
            {usage && (
              <div className="hidden min-w-48 items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2 shadow-card md:flex">
                <HardDrive className="size-4 text-subtle" />
                <div className="flex-1">
                  <div className="mb-1 flex justify-between text-[11px] font-semibold"><span>{formatBytes(usage.used)}</span><span className="text-subtle">{formatBytes(usage.max)}</span></div>
                  <ProgressBar value={usedRatio} tone={usedRatio > 0.9 ? 'danger' : usedRatio > 0.7 ? 'warning' : 'primary'} className="h-1.5" label="Espace de stockage" />
                </div>
              </div>
            )}
            <Button variant="primary" icon={Upload} onClick={() => fileInput.current?.click()} loading={!!upload}>Importer des fichiers</Button>
            <input ref={fileInput} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }} />
          </>
        }
      />

      {/* Upload progress */}
      {upload && (
        <Card className="animate-pop p-4 sm:p-5" role="status" aria-live="polite">
          <div className="mb-2.5 flex items-center justify-between text-sm font-semibold">
            <span>{upload.label}</span>
            <span className="tabular-nums text-brand">{Math.round(upload.progress * 100)} %</span>
          </div>
          <ProgressBar value={upload.progress} label="Progression du téléversement" />
        </Card>
      )}

      {/* Toolbar */}
      {(media.length > 0 || search) && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input icon={Search} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un média…" aria-label="Rechercher un média" wrapperClassName="sm:w-72" />
            <div className="-mx-1 overflow-x-auto px-1">
              <Segmented
                size="sm"
                label="Type de média"
                value={type}
                onChange={setType}
                options={[
                  { value: 'all', label: 'Tout', count: counts.all },
                  { value: 'image', label: 'Images', count: counts.image },
                  { value: 'video', label: 'Vidéos', count: counts.video },
                ]}
              />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier par" className="w-44">
              <option value="newest">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="name_asc">Nom A → Z</option>
              <option value="name_desc">Nom Z → A</option>
            </Select>
            <Segmented
              size="sm"
              label="Affichage"
              value={view}
              onChange={changeView}
              options={[{ value: 'grid', label: '', icon: LayoutGrid }, { value: 'list', label: '', icon: List }]}
            />
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />)}
        </div>
      ) : media.length === 0 && !search ? (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="group w-full rounded-3xl border-2 border-dashed border-line-strong bg-surface/60 px-6 py-16 text-center transition hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <div className="relative mx-auto mb-5 w-fit">
            <div className="absolute inset-0 rounded-3xl bg-brand-gradient opacity-30 blur-xl transition group-hover:opacity-50" aria-hidden="true" />
            <div className="relative grid size-16 place-items-center rounded-3xl bg-brand-gradient text-white shadow-btn"><Upload className="size-7" /></div>
          </div>
          <p className="font-display text-xl font-extrabold">Glissez vos photos et vidéos ici</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">ou cliquez pour parcourir vos fichiers. Formats : JPG, PNG, WEBP, MP4 — 100 Mo maximum par fichier.</p>
        </button>
      ) : visible.length === 0 ? (
        <Card><EmptyState icon={FolderOpen} title="Aucun média trouvé" description="Modifiez votre recherche ou le filtre de type." action={<Button onClick={() => { setSearch(''); setType('all'); }}>Réinitialiser</Button>} /></Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((m, i) => (
            <MediaCard
              key={m.id}
              item={m}
              selected={selected.has(m.id)}
              selecting={selecting}
              onSelect={toggle}
              onOpen={() => setLightbox(i)}
              onRename={setRenaming}
              onDelete={(it) => deleteItems([it])}
            />
          ))}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {visible.map((m, i) => (
              <MediaRow key={m.id} item={m} selected={selected.has(m.id)} onSelect={toggle} onOpen={() => setLightbox(i)} onRename={setRenaming} onDelete={(it) => deleteItems([it])} />
            ))}
          </ul>
        </Card>
      )}

      {/* Selection bar */}
      {selecting && (
        <div className="glass fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-xl animate-pop items-center justify-between gap-3 rounded-2xl border border-line p-2.5 pl-4 shadow-pop lg:bottom-8 lg:left-[calc(50%+136px)] lg:right-auto lg:w-[34rem] lg:-translate-x-1/2">
          <p className="text-sm font-bold">{selected.size} {plural(selected.size, 'sélectionné', 'sélectionnés')}</p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(visible.map((m) => m.id)))}>Tout</Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setSelected(new Set())}>Annuler</Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => deleteItems(media.filter((m) => selected.has(m.id)))}>Supprimer</Button>
          </div>
        </div>
      )}

      {/* Page-wide drop overlay */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[120] grid place-items-center bg-bg/80 p-6 backdrop-blur-sm" aria-hidden="true">
          <div className="animate-pop rounded-4xl border-2 border-dashed border-primary bg-primary/10 px-14 py-12 text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-brand-gradient text-white shadow-btn"><Upload className="size-7" /></div>
            <p className="font-display text-2xl font-extrabold">Déposez vos fichiers</p>
            <p className="mt-1 text-sm text-muted">Ils seront ajoutés à la médiathèque</p>
          </div>
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          items={visible}
          index={Math.min(lightbox, visible.length - 1)}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          onRename={(it) => { setLightbox(null); setRenaming(it); }}
          onDelete={(it) => deleteItems([it])}
        />
      )}

      {renaming && <RenameModal item={renaming} onClose={() => setRenaming(null)} onDone={() => { setRenaming(null); fetchMedia(); }} />}
    </div>
  );
}

function RenameModal({ item, onClose, onDone }) {
  const toast = useToast();
  const [name, setName] = useState(item.original_name.replace(/\.[^/.]+$/, ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ext = item.original_name.match(/\.[^/.]+$/)?.[0] || '';

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Le nom ne peut pas être vide.');
    setBusy(true);
    try {
      await api.put(`/media/${item.id}/rename`, { name: name.trim() });
      toast.success('Média renommé.');
      onDone();
    } catch (err) {
      setError(err.message || 'Renommage impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={Pencil}
      title="Renommer le média"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" form="rename-media" loading={busy}>Renommer</Button>
        </>
      }
    >
      <form id="rename-media" onSubmit={submit}>
        <Field label="Nom" error={error} hint={ext ? `L’extension ${ext} est conservée.` : undefined}>
          {(p) => <Input {...p} data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />}
        </Field>
      </form>
    </Modal>
  );
}
