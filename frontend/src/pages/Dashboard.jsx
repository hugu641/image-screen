import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Check,
  HardDrive,
  Images,
  Link2,
  ListVideo,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  Tv,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useAdminSocket } from '../hooks/useAdminSocket';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import StatCard from '../components/ui/StatCard';
import { Donut, EmptyState, PageHeader, ProgressBar, Skeleton } from '../components/ui/Misc';
import { cn } from '../utils/cn';
import { formatBytes, greeting, plural, relativeTime } from '../utils/format';
import { toneSoft } from '../utils/tones';

function eventMeta(message = '') {
  const t = message.toLowerCase();
  if (t.includes('déconnect')) return { icon: WifiOff, tone: 'warning' };
  if (t.includes('connect')) return { icon: Wifi, tone: 'success' };
  if (t.includes('associé') || t.includes('nouvel écran')) return { icon: Link2, tone: 'primary' };
  if (t.includes('supprim')) return { icon: Trash2, tone: 'danger' };
  if (t.includes('média ajouté')) return { icon: Upload, tone: 'info' };
  if (t.includes('playlist')) return { icon: ListVideo, tone: 'accent' };
  if (t.includes('synchro')) return { icon: RefreshCw, tone: 'info' };
  return { icon: Activity, tone: 'info' };
}

function Legend({ className, label, value }) {
  return (
    <li className="flex items-center justify-between gap-3 text-[13px]">
      <span className="flex items-center gap-2 text-muted">
        <span className={cn('size-2.5 rounded-full bg-current', className)} />
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </li>
  );
}

function ScreenRow({ screen }) {
  const online = screen.status === 'connected';
  return (
    <li>
      <Link
        to="/screens"
        className="flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-2"
      >
        <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', online ? toneSoft.success : toneSoft.neutral)}>
          <Tv className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{screen.name}</p>
          <p className="truncate text-xs text-muted">
            {screen.playlist_name ? `▶ ${screen.playlist_name}` : 'Aucune playlist'} · {relativeTime(screen.last_activity)}
          </p>
        </div>
        <StatusBadge status={screen.status} className="hidden sm:inline-flex" />
      </Link>
    </li>
  );
}

function GettingStarted({ steps }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-brand-gradient opacity-20 blur-3xl" aria-hidden="true" />
      <CardHeader icon={Rocket} title="Premiers pas" description={`${done} étape${done > 1 ? 's' : ''} sur ${steps.length} terminée${done > 1 ? 's' : ''}`} />
      <CardBody className="relative space-y-4 pt-4">
        <ProgressBar value={done / steps.length} label="Progression de la configuration" />
        <ol className="space-y-1.5">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Link
                to={s.to}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-2',
                  s.done && 'opacity-60'
                )}
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                    s.done ? 'bg-success text-white' : 'border border-line-strong text-muted'
                  )}
                >
                  {s.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-semibold', s.done && 'line-through')}>{s.title}</span>
                  {!s.done && <span className="block text-xs text-muted">{s.hint}</span>}
                </span>
                {!s.done && <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" />}
              </Link>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

export default function Dashboard() {
  useDocumentTitle('Tableau de bord');
  const { user } = useAuth();
  const [data, setData] = useState({ screens: [], media: [], playlists: [], events: [], usage: null });
  const [loading, setLoading] = useState(true);
  const reloadTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      const [screens, media, playlists, events, usage] = await Promise.all([
        api.get('/screens'),
        api.get('/media'),
        api.get('/playlists'),
        api.get('/events?limit=30'),
        api.get('/media/usage').catch(() => null),
      ]);
      setData({ screens, media, playlists, events, usage });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Several socket events can arrive in a burst: refresh once.
  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(load, 500);
  }, [load]);

  useEffect(() => {
    load();
    return () => clearTimeout(reloadTimer.current);
  }, [load]);

  useAdminSocket({
    'event:new': (e) => {
      setData((d) => ({ ...d, events: [e, ...d.events].slice(0, 30) }));
      scheduleReload();
    },
    'screens:list': scheduleReload,
    'screen:status_update': scheduleReload,
  });

  const { screens, media, playlists, events, usage } = data;
  const associated = useMemo(() => screens.filter((s) => s.is_associated), [screens]);
  const counts = useMemo(() => {
    const online = associated.filter((s) => s.status === 'connected').length;
    const waiting = associated.filter((s) => s.status === 'waiting_content').length;
    const pending = screens.filter((s) => !s.is_associated).length;
    return { online, waiting, pending, offline: associated.length - online - waiting };
  }, [screens, associated]);

  const storage = usage?.used ?? media.reduce((n, m) => n + (m.size || 0), 0);
  const broadcasting = associated.filter((s) => s.playlist_id).length;
  const usedPlaylists = playlists.filter((p) => (p.media_count || 0) > 0).length;
  const eventsToday = events.filter((e) => new Date(e.timestamp).toDateString() === new Date().toDateString()).length;

  const steps = [
    { title: 'Importer vos premiers médias', hint: 'Photos JPG, PNG, WEBP ou vidéos MP4.', to: '/media', done: media.length > 0 },
    { title: 'Créer une playlist', hint: 'Choisissez l’ordre, la durée et la transition.', to: '/playlists', done: usedPlaylists > 0 },
    { title: 'Associer un écran', hint: 'Ouvrez /tv sur la TV puis saisissez son code.', to: '/screens', done: associated.length > 0 },
    { title: 'Lancer la diffusion', hint: 'Affectez une playlist à un écran.', to: '/screens', done: broadcasting > 0 },
  ];
  const onboarding = !loading && steps.some((s) => !s.done);

  const name = user?.name || user?.email?.split('@')[0] || '';
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={today}
        title={`${greeting()}${name ? `, ${name}` : ''}`}
        description="Voici l’état de vos écrans et l’activité de votre magasin en temps réel."
        actions={
          <>
            <Button variant="secondary" icon={Upload} to="/media">Ajouter des médias</Button>
            <Button variant="primary" icon={Plus} to="/playlists">Nouvelle playlist</Button>
          </>
        }
      />

      {/* KPIs */}
      <section aria-label="Indicateurs clés" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          loading={loading}
          icon={Tv}
          tone="success"
          label="Écrans en ligne"
          value={counts.online}
          suffix={`/ ${associated.length}`}
          hint={counts.pending > 0 ? `${counts.pending} en attente d’association` : associated.length ? 'Tous vos écrans sont suivis' : 'Aucun écran associé'}
        />
        <StatCard
          loading={loading}
          icon={Images}
          tone="primary"
          label="Médias"
          value={media.length}
          suffix={plural(media.length, 'fichier', 'fichiers')}
          hint={`${formatBytes(storage)} utilisés`}
        />
        <StatCard
          loading={loading}
          icon={ListVideo}
          tone="accent"
          label="Playlists"
          value={playlists.length}
          hint={broadcasting ? `${broadcasting} ${plural(broadcasting, 'écran diffuse', 'écrans diffusent')} actuellement` : 'Aucune diffusion en cours'}
        />
        <StatCard
          loading={loading}
          icon={Activity}
          tone="info"
          label="Activité aujourd’hui"
          value={eventsToday}
          suffix={plural(eventsToday, 'événement', 'événements')}
          hint="Connexions, modifications, synchros"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <Card>
            <CardHeader
              icon={Tv}
              title="Vos écrans"
              description="Statut en direct de chaque écran associé"
              action={<Button variant="ghost" size="sm" to="/screens" iconRight={ArrowRight}>Tout gérer</Button>}
            />
            <CardBody className="pt-3">
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />)}
                </div>
              ) : associated.length === 0 ? (
                <EmptyState
                  icon={Tv}
                  title="Aucun écran associé"
                  description="Ouvrez l’adresse /tv sur votre télévision : un code à 6 caractères s’affiche. Saisissez-le pour l’associer."
                  action={<Button variant="primary" icon={Link2} to="/screens">Associer un écran</Button>}
                  className="py-8"
                />
              ) : (
                <ul className="-mx-3 space-y-0.5">
                  {[...associated]
                    .sort((a, b) => (b.status === 'connected') - (a.status === 'connected'))
                    .slice(0, 6)
                    .map((s) => <ScreenRow key={s.id} screen={s} />)}
                </ul>
              )}
            </CardBody>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader icon={Wifi} tone="success" title="Répartition" description="Statut de votre parc" />
              <CardBody className="flex items-center gap-6">
                <Donut
                  size={132}
                  thickness={14}
                  segments={[
                    { value: counts.online, className: 'text-success' },
                    { value: counts.waiting, className: 'text-warning' },
                    { value: counts.offline, className: 'text-subtle' },
                    { value: counts.pending, className: 'text-primary' },
                  ]}
                >
                  <div>
                    <p className="font-display text-3xl font-extrabold leading-none tabular-nums">{screens.length}</p>
                    <p className="mt-1 text-[11px] font-semibold text-subtle">{plural(screens.length, 'écran', 'écrans')}</p>
                  </div>
                </Donut>
                <ul className="flex-1 space-y-2.5">
                  <Legend className="text-success" label="En ligne" value={counts.online} />
                  <Legend className="text-warning" label="Sans contenu" value={counts.waiting} />
                  <Legend className="text-subtle" label="Hors ligne" value={counts.offline} />
                  <Legend className="text-primary" label="À associer" value={counts.pending} />
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardHeader icon={HardDrive} tone="info" title="Stockage" description="Espace utilisé par la médiathèque" />
              <CardBody className="space-y-4">
                <p className="font-display text-3xl font-extrabold tabular-nums">{formatBytes(storage)}</p>
                <ProgressBar
                  value={usage ? storage / usage.max : 0}
                  tone={usage && storage / usage.max > 0.9 ? 'danger' : usage && storage / usage.max > 0.7 ? 'warning' : 'primary'}
                  label="Stockage utilisé"
                />
                <div className="flex items-center justify-between text-xs text-subtle">
                  <span>{media.length} {plural(media.length, 'fichier', 'fichiers')}</span>
                  <span>{usage ? `sur ${formatBytes(usage.max)}` : 'Compression automatique des images'}</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          {onboarding && <GettingStarted steps={steps} />}

          <Card>
            <CardHeader
              icon={Activity}
              tone="info"
              title="Activité"
              description="Événements récents"
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                  <span className="live-dot" /> Direct
                </span>
              }
            />
            <CardBody className="pt-3">
              {loading ? (
                <div className="space-y-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : events.length === 0 ? (
                <EmptyState icon={Activity} title="Rien à signaler" description="Les connexions d’écrans et les modifications apparaîtront ici." className="py-8" />
              ) : (
                <ol className="relative max-h-[460px] space-y-4 overflow-y-auto pr-1 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
                  {events.slice(0, 12).map((e) => {
                    const { icon: Icon, tone } = eventMeta(e.message);
                    return (
                      <li key={e.id} className="relative flex items-start gap-3.5">
                        <span className={cn('relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface', toneSoft[tone])}>
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-[13px] font-medium leading-snug">{e.message}</p>
                          <p className="mt-0.5 text-[11px] text-subtle">{relativeTime(e.timestamp)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
