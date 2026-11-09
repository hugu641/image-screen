import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  EllipsisVertical,
  Eye,
  Link2,
  ListVideo,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tv,
  Unlink,
  WifiOff,
} from 'lucide-react';
import { api } from '../services/api';
import { useAdminSocket } from '../hooks/useAdminSocket';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import { DropdownMenu, MenuItem, MenuSeparator } from '../components/ui/Menu';
import { EmptyState, PageHeader, Segmented, Skeleton } from '../components/ui/Misc';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/Confirm';
import MediaThumb, { playlistCover } from '../components/MediaThumb';
import TvAddress from '../components/TvAddress';
import { cn } from '../utils/cn';
import { plural, relativeTime } from '../utils/format';

const STATUS_STYLE = {
  connected: { label: 'En ligne', dot: 'bg-emerald-400', live: true },
  offline: { label: 'Hors ligne', dot: 'bg-slate-400' },
  waiting_content: { label: 'Sans contenu', dot: 'bg-amber-400' },
  not_associated: { label: 'Non associé', dot: 'bg-violet-400' },
};

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { label: 'Erreur réseau', dot: 'bg-rose-400' };
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
      <span className={cn('size-2 rounded-full', s.dot, s.live && 'shadow-[0_0_0_3px_rgba(52,211,153,0.3)]')} />
      {s.label}
    </span>
  );
}

/* ── Association modal ─────────────────────────────────────────────────── */
function AssociateModal({ screen, prefill, playlists, onClose, onDone }) {
  const toast = useToast();
  const [code, setCode] = useState(screen?.code || prefill || '');
  const [name, setName] = useState(screen ? (screen.name && !screen.name.startsWith('Écran ') ? screen.name : '') : '');
  const [playlistId, setPlaylistId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) return setError('Le code se compose de 6 caractères, affichés sur l’écran de la TV.');
    if (!name.trim()) return setError('Donnez un nom à cet écran, par exemple « TV Hall d’entrée ».');
    setBusy(true);
    try {
      await api.post('/screens/associate', { code, name: name.trim(), playlistId: playlistId || null });
      toast.success(`« ${name.trim()} » est associé.`);
      onDone();
    } catch (err) {
      setError(err.message || 'Association impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={Link2}
      title="Associer un écran"
      description="Saisissez le code affiché sur la TV, puis donnez-lui un nom."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" form="associate-form" loading={busy} icon={Link2}>Associer l’écran</Button>
        </>
      }
    >
      <form id="associate-form" onSubmit={submit} className="space-y-4">
        {error && <div role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">{error}</div>}

        <Field label="Code de la TV" required hint={screen ? 'Code détecté automatiquement.' : 'Ex. A7K9P2'}>
          {(p) => (
            <Input
              {...p}
              data-autofocus={!screen || undefined}
              value={code}
              readOnly={!!screen}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="A7K9P2"
              autoComplete="off"
              spellCheck={false}
              className="text-center font-mono text-xl font-bold uppercase tracking-[0.35em]"
            />
          )}
        </Field>
        <Field label="Nom de l’écran" required>
          {(p) => (
            <Input {...p} data-autofocus={screen || undefined} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. TV Hall d’entrée" />
          )}
        </Field>
        <Field label="Playlist à diffuser" hint="Vous pourrez la changer à tout moment.">
          {(p) => (
            <Select {...p} value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
              <option value="">Aucune pour l’instant</option>
              {playlists.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  );
}

/* ── Screen card ───────────────────────────────────────────────────────── */
function ScreenCard({ screen, cover, onRename, onAssign, onSync, onDelete }) {
  const offline = screen.status === 'offline';
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-pop">
      <div className="relative aspect-video overflow-hidden bg-surface-3">
        {cover ? (
          <MediaThumb media={cover} className="h-full w-full" imgClassName={cn('transition duration-500 group-hover:scale-105', offline && 'grayscale')} />
        ) : (
          <div className="grid h-full w-full place-items-center bg-brand-gradient-soft text-subtle">
            <Tv className="size-10 opacity-60" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
        <div className="absolute left-3 top-3"><StatusPill status={screen.status} /></div>
        <div className="absolute right-2.5 top-2.5">
          <DropdownMenu
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label={`Actions pour ${screen.name}`}
                className="grid size-9 place-items-center rounded-xl bg-black/55 text-white backdrop-blur-md transition hover:bg-black/70"
              >
                <EllipsisVertical className="size-[18px]" />
              </button>
            )}
          >
            <MenuItem icon={Eye} to={`/admin/preview/${screen.id}`}>Aperçu en direct</MenuItem>
            <MenuItem icon={ListVideo} onClick={() => onAssign(screen)}>Affecter une playlist</MenuItem>
            <MenuItem icon={RefreshCw} onClick={() => onSync(screen)}>Forcer la synchronisation</MenuItem>
            <MenuItem icon={Pencil} onClick={() => onRename(screen)}>Renommer</MenuItem>
            <MenuSeparator />
            <MenuItem icon={Unlink} tone="danger" onClick={() => onDelete(screen)}>Dissocier l’écran</MenuItem>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-3.5 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold tracking-tight">{screen.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-muted">
            <ListVideo className="size-3.5 shrink-0 text-brand" />
            {screen.playlist_name ? <span className="truncate font-medium text-fg">{screen.playlist_name}</span> : <span>Aucune playlist</span>}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-subtle">
          <span className="truncate font-mono">{screen.ip_address || '—'}</span>
          <span className="shrink-0">{relativeTime(screen.last_activity)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" icon={Eye} to={`/admin/preview/${screen.id}`}>Aperçu</Button>
          <Button size="sm" variant="soft" icon={ListVideo} onClick={() => onAssign(screen)}>Playlist</Button>
        </div>
      </div>
    </Card>
  );
}

export default function Screens() {
  useDocumentTitle('Écrans');
  const toast = useToast();
  const confirm = useConfirm();

  const [screens, setScreens] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [associate, setAssociate] = useState(null); // { screen?, prefill? }
  const [searchParams, setSearchParams] = useSearchParams();
  const [renaming, setRenaming] = useState(null);
  const [assigning, setAssigning] = useState(null);

  const fetchScreens = useCallback(async () => {
    try { setScreens(await api.get('/screens')); } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [s, p, m] = await Promise.all([api.get('/screens'), api.get('/playlists'), api.get('/media')]);
        setScreens(s); setPlaylists(p); setLibrary(m);
      } catch (err) {
        toast.error(err.message || 'Impossible de charger les écrans.');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  useAdminSocket({
    'screens:list': setScreens,
    'screen:status_update': ({ id, status }) =>
      setScreens((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s))),
  });

  // Arriving from the QR code on a TV: /screens?code=ABC123 opens the association dialog
  useEffect(() => {
    const raw = searchParams.get('code');
    if (!raw || loading) return;
    const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const match = screens.find((s) => !s.is_associated && s.code === code);
    setAssociate(match ? { screen: match } : { prefill: code });
    setSearchParams({}, { replace: true });
  }, [searchParams, loading, screens, setSearchParams]);

  const pending = useMemo(() => screens.filter((s) => !s.is_associated), [screens]);
  const associated = useMemo(() => screens.filter((s) => s.is_associated), [screens]);

  const counts = useMemo(() => ({
    all: associated.length,
    online: associated.filter((s) => s.status === 'connected').length,
    waiting: associated.filter((s) => s.status === 'waiting_content').length,
    offline: associated.filter((s) => s.status !== 'connected' && s.status !== 'waiting_content').length,
  }), [associated]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return associated
      .filter((s) => {
        if (filter === 'online') return s.status === 'connected';
        if (filter === 'waiting') return s.status === 'waiting_content';
        if (filter === 'offline') return s.status !== 'connected' && s.status !== 'waiting_content';
        return true;
      })
      .filter((s) => !q || s.name?.toLowerCase().includes(q) || s.playlist_name?.toLowerCase().includes(q))
      .sort((a, b) => (b.status === 'connected') - (a.status === 'connected') || String(a.name).localeCompare(String(b.name), 'fr'));
  }, [associated, filter, query]);

  const coverFor = (screen) => {
    const pl = playlists.find((p) => String(p.id) === String(screen.playlist_id));
    return pl ? playlistCover(pl, library) : null;
  };

  const handleSync = async (screen) => {
    try {
      await api.post(`/screens/${screen.id}/sync`);
      toast.success(`Synchronisation demandée à « ${screen.name} ».`);
    } catch (err) {
      toast.error(err.message || 'Synchronisation impossible.');
    }
  };

  const handleDelete = async (screen) => {
    const ok = await confirm({
      tone: 'danger',
      title: `Dissocier « ${screen.name} » ?`,
      message: 'L’écran cessera de diffuser et affichera de nouveau son code d’association. Vos playlists et médias ne sont pas supprimés.',
      confirmLabel: 'Dissocier',
    });
    if (!ok) return;
    try {
      await api.delete(`/screens/${screen.id}`);
      toast.success(`« ${screen.name} » a été dissocié.`);
      fetchScreens();
    } catch (err) {
      toast.error(err.message || 'Suppression impossible.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Écrans"
        description="Associez vos télévisions, suivez leur état en direct et choisissez ce qu’elles diffusent."
        actions={<Button variant="primary" icon={Plus} onClick={() => setAssociate({})}>Associer un écran</Button>}
      />

      {/* Newly detected screens */}
      {pending.length > 0 && (
        <section
          aria-label="Nouveaux écrans détectés"
          className="relative overflow-hidden rounded-3xl border border-primary/30 bg-brand-gradient-soft p-5 sm:p-6"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand-gradient opacity-20 blur-3xl" aria-hidden="true" />
          <div className="relative mb-4 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-btn"><Sparkles className="size-5" /></div>
            <div>
              <h2 className="font-display text-base font-bold">
                {pending.length} {plural(pending.length, 'nouvel écran détecté', 'nouveaux écrans détectés')}
              </h2>
              <p className="text-[13px] text-muted">Vérifiez que le code correspond à celui affiché sur la TV, puis associez-la.</p>
            </div>
          </div>
          <ul className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pending.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="min-w-0">
                  <p className="font-mono text-2xl font-extrabold tracking-[0.18em]">{s.code}</p>
                  <p className="mt-1 truncate text-xs text-muted">{s.ip_address || 'Adresse inconnue'} · {relativeTime(s.last_activity)}</p>
                </div>
                <Button size="sm" variant="primary" icon={Link2} onClick={() => setAssociate({ screen: s })}>Associer</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Toolbar */}
      {associated.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="-mx-1 overflow-x-auto px-1">
            <Segmented
              label="Filtrer par statut"
              value={filter}
              onChange={setFilter}
              size="sm"
              options={[
                { value: 'all', label: 'Tous', count: counts.all },
                { value: 'online', label: 'En ligne', count: counts.online },
                { value: 'waiting', label: 'Sans contenu', count: counts.waiting },
                { value: 'offline', label: 'Hors ligne', count: counts.offline },
              ]}
            />
          </div>
          <Input
            icon={Search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un écran…"
            aria-label="Rechercher un écran"
            wrapperClassName="sm:w-72"
          />
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[340px] rounded-2xl" />)}
        </div>
      ) : associated.length === 0 ? (
        <Card>
          <EmptyState
            icon={Tv}
            title="Connectez votre première télévision"
            description="Ouvrez l’adresse ci-dessous dans le navigateur de la TV (ou sur un Fire TV Stick, Android TV, mini-PC). Un code à 6 caractères s’affiche : saisissez-le ici."
            action={<Button variant="primary" icon={Plus} onClick={() => setAssociate({})}>Associer avec un code</Button>}
          />
          <div className="mx-auto -mt-4 max-w-md px-6 pb-10"><TvAddress /></div>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={WifiOff} title="Aucun écran ne correspond" description="Essayez un autre filtre ou une autre recherche." action={<Button onClick={() => { setFilter('all'); setQuery(''); }}>Réinitialiser</Button>} />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => (
            <ScreenCard
              key={s.id}
              screen={s}
              cover={coverFor(s)}
              onRename={setRenaming}
              onAssign={setAssigning}
              onSync={handleSync}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {associated.length > 0 && (
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold">Ajouter une autre télévision</p>
            <p className="text-[13px] text-muted">Ouvrez cette adresse sur l’appareil, puis associez-le avec son code.</p>
          </div>
          <TvAddress className="sm:w-96" />
        </Card>
      )}

      {associate && (
        <AssociateModal
          screen={associate.screen}
          prefill={associate.prefill}
          playlists={playlists}
          onClose={() => setAssociate(null)}
          onDone={() => { setAssociate(null); fetchScreens(); }}
        />
      )}
      {renaming && (
        <RenameModal screen={renaming} onClose={() => setRenaming(null)} onDone={() => { setRenaming(null); fetchScreens(); }} />
      )}
      {assigning && (
        <AssignModal
          screen={assigning}
          playlists={playlists}
          onClose={() => setAssigning(null)}
          onDone={() => { setAssigning(null); fetchScreens(); }}
        />
      )}
    </div>
  );
}

function RenameModal({ screen, onClose, onDone }) {
  const toast = useToast();
  const [name, setName] = useState(screen.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Le nom ne peut pas être vide.');
    setBusy(true);
    try {
      await api.put(`/screens/${screen.id}/rename`, { name: name.trim() });
      toast.success('Écran renommé.');
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
      title="Renommer l’écran"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" form="rename-form" loading={busy}>Enregistrer</Button>
        </>
      }
    >
      <form id="rename-form" onSubmit={submit}>
        <Field label="Nouveau nom" error={error}>
          {(p) => <Input {...p} data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}
        </Field>
      </form>
    </Modal>
  );
}

function AssignModal({ screen, playlists, onClose, onDone }) {
  const toast = useToast();
  const [playlistId, setPlaylistId] = useState(screen.playlist_id ? String(screen.playlist_id) : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/screens/${screen.id}/assign-playlist`, { playlistId: playlistId || null });
      toast.success(playlistId ? 'Playlist affectée : l’écran se met à jour.' : 'Diffusion suspendue sur cet écran.');
      onDone();
    } catch (err) {
      toast.error(err.message || 'Affectation impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={ListVideo}
      title="Affecter une playlist"
      description={`Ce que « ${screen.name} » doit diffuser.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" form="assign-form" loading={busy}>Affecter</Button>
        </>
      }
    >
      <form id="assign-form" onSubmit={submit}>
        <Field label="Playlist">
          {(p) => (
            <Select {...p} data-autofocus value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
              <option value="">Aucune — suspendre la diffusion</option>
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.name} ({pl.media_count || 0} médias)</option>
              ))}
            </Select>
          )}
        </Field>
        {playlists.length === 0 && <p className="mt-3 text-sm text-muted">Vous n’avez pas encore de playlist : créez-en une depuis la page Playlists.</p>}
      </form>
    </Modal>
  );
}
