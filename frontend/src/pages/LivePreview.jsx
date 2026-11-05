import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, ListVideo, Radio, Tv, WifiOff } from 'lucide-react';
import { api, mediaUrl } from '../services/api';
import { useAdminSocket } from '../hooks/useAdminSocket';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { EmptyState, PageHeader, Skeleton } from '../components/ui/Misc';
import Button from '../components/ui/Button';
import MediaThumb from '../components/MediaThumb';
import { cn } from '../utils/cn';
import { formatBytes, relativeTime } from '../utils/format';

/** Mirror of what a screen is displaying right now, driven by the TV's own progress reports. */
export default function LivePreview() {
  const { id } = useParams();
  const [screen, setScreen] = useState(null);
  const [playlist, setPlaylist] = useState(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useDocumentTitle(screen ? `Aperçu · ${screen.name}` : 'Aperçu en direct');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const screens = await api.get('/screens');
        const found = screens.find((s) => s.id === id);
        if (!found) return !cancelled && setNotFound(true);
        if (cancelled) return;
        setScreen(found);
        if (found.playlist_id) {
          const pl = await api.get(`/playlists/${found.playlist_id}`);
          if (!cancelled) setPlaylist(pl);
        }
      } catch (err) {
        console.error('Failed to load live preview:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useAdminSocket({
    [`screen:preview:${id}`]: (data) => {
      setIndex(Number(data.index) || 0);
      setScreen((s) => (s ? { ...s, status: 'connected', last_activity: new Date().toISOString() } : s));
    },
    'screen:status_update': (data) => {
      if (data.id === id) setScreen((s) => (s ? { ...s, status: data.status } : s));
    },
  });

  const media = playlist?.media || [];
  const current = media[index] || media[0] || null;
  const online = screen?.status === 'connected';

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="aspect-video w-full max-w-4xl rounded-3xl" />
      </div>
    );
  }

  if (notFound || !screen) {
    return (
      <Card>
        <EmptyState icon={Tv} title="Écran introuvable" description="Cet écran n’existe plus ou a été dissocié." action={<Button variant="primary" to="/screens">Retour aux écrans</Button>} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: '/screens', label: 'Écrans' }}
        title={screen.name}
        badge={<StatusBadge status={screen.status} />}
        description={`Aperçu en direct · ${screen.ip_address || 'adresse inconnue'} · dernière activité ${relativeTime(screen.last_activity)}`}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {/* TV bezel */}
          <div className="rounded-[2rem] bg-gradient-to-b from-zinc-700 to-zinc-900 p-2.5 shadow-pop">
            <div className="relative aspect-video overflow-hidden rounded-[1.4rem] bg-black">
              {current ? (
                current.mime_type.startsWith('video/') ? (
                  <video key={current.id} src={mediaUrl(current.filepath)} autoPlay muted loop playsInline className="size-full object-cover" />
                ) : (
                  <img key={current.id} src={mediaUrl(current.filepath)} alt={current.original_name} className="size-full animate-fade-in object-cover" />
                )
              ) : (
                <div className="grid size-full place-items-center text-slate-500">
                  <div className="flex flex-col items-center gap-3 text-sm">
                    <Tv className="size-10 opacity-50" />
                    {screen.playlist_id ? 'La playlist est vide' : 'Aucune playlist affectée'}
                  </div>
                </div>
              )}

              <div className="absolute left-4 top-4">
                {online ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                    <span className="live-dot text-rose-500" /> EN DIRECT
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white/80 backdrop-blur-md">
                    <WifiOff className="size-3.5" /> HORS LIGNE
                  </span>
                )}
              </div>
              {current && media.length > 0 && (
                <span className="absolute bottom-4 right-4 rounded-lg bg-black/60 px-2.5 py-1 font-mono text-xs font-bold text-white backdrop-blur-md">
                  {Math.min(index, media.length - 1) + 1} / {media.length}
                </span>
              )}
            </div>
          </div>
          <div className="mx-auto h-2.5 w-1/3 rounded-b-2xl bg-gradient-to-b from-zinc-800 to-zinc-900" aria-hidden="true" />

          {current && (
            <p className="mt-5 text-center text-sm text-muted">
              <b className="text-fg">{current.original_name}</b> · {current.mime_type} · {formatBytes(current.size)}
            </p>
          )}
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader icon={Radio} tone="danger" title="Diffusion" description={playlist ? playlist.name : 'Aucune playlist'} />
            <CardBody className="space-y-3 pt-4">
              {playlist && (
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary" icon={Clock}>{playlist.duration || 5} s / média</Badge>
                  <Badge tone="neutral">{{ fade: 'Fondu', zoom: 'Zoom', slide: 'Glissement' }[playlist.transition] || 'Fondu'}</Badge>
                </div>
              )}
              {media.length > 0 ? (
                <ol className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                  {media.map((m, i) => (
                    <li key={`${m.id}-${i}`} className={cn('flex items-center gap-3 rounded-xl p-2 transition-colors', i === index ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-surface-2')}>
                      <span className="w-5 text-center text-[11px] font-bold tabular-nums text-subtle">{i + 1}</span>
                      <MediaThumb media={m} className="h-9 w-14 shrink-0 rounded-lg" />
                      <span className={cn('min-w-0 flex-1 truncate text-[13px]', i === index ? 'font-bold text-brand' : 'font-medium')}>{m.original_name}</span>
                      {i === index && <ListVideo className="size-4 shrink-0 text-brand" />}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-sm text-muted">Rien à afficher pour le moment.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
