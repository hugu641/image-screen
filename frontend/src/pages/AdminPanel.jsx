import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Calendar,
  Check,
  ChevronDown,
  CircleCheck,
  Clock,
  Copy,
  Hash,
  Infinity as InfinityIcon,
  Key,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import { EmptyState, PageHeader, ProgressBar, Segmented, Skeleton } from '../components/ui/Misc';
import StatCard from '../components/ui/StatCard';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/Confirm';
import { cn } from '../utils/cn';
import { formatDate, plural } from '../utils/format';

const PLANS = [
  { value: 'trial', label: 'Essai', tone: 'neutral' },
  { value: 'starter', label: 'Starter', tone: 'success' },
  { value: 'pro', label: 'Pro', tone: 'primary' },
  { value: 'enterprise', label: 'Enterprise', tone: 'accent' },
];
const planOf = (v) => PLANS.find((p) => p.value === v) || PLANS[0];

function PlanBadge({ plan }) {
  const p = planOf(plan);
  return <Badge tone={p.tone}>{p.label}</Badge>;
}

function KeyStatus({ k }) {
  const expired = k.expires_at && new Date(k.expires_at) < new Date();
  const exhausted = k.uses_count >= k.max_uses;
  if (!k.is_active) return <Badge tone="danger" icon={Ban}>Révoquée</Badge>;
  if (expired) return <Badge tone="warning" icon={Clock}>Expirée</Badge>;
  if (exhausted) return <Badge tone="neutral" icon={Check}>Épuisée</Badge>;
  return <Badge tone="success" icon={CircleCheck}>Active</Badge>;
}

function CopyButton({ text }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copie impossible : sélectionnez la clé manuellement.');
    }
  };
  if (!navigator.clipboard) return null;
  return (
    <button type="button" onClick={copy} aria-label="Copier la clé" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-fg">
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </button>
  );
}

function CreateKeyModal({ onClose, onCreate }) {
  const [plan, setPlan] = useState('starter');
  const [durationDays, setDurationDays] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onCreate({
        plan,
        duration_days: durationDays ? parseInt(durationDays, 10) : null,
        max_uses: parseInt(maxUses, 10) || 1,
        note: note || null,
        expires_at: expiresAt || null,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={KeyRound}
      title="Nouvelle clé d’abonnement"
      description="Générez une clé à transmettre à un utilisateur."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" form="create-key" loading={busy} icon={Key}>Générer la clé</Button>
        </>
      }
    >
      <form id="create-key" onSubmit={submit} className="space-y-5">
        {error && <div role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">{error}</div>}
        <div>
          <p className="label">Plan</p>
          <Segmented label="Plan" value={plan} onChange={setPlan} options={PLANS.map((p) => ({ value: p.value, label: p.label }))} className="flex w-full [&>button]:flex-1" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Durée (jours)" hint="Vide = illimitée">
            {(p) => <Input {...p} type="number" min="1" max="3650" placeholder="30, 365…" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />}
          </Field>
          <Field label="Utilisations maximum" required>
            {(p) => <Input {...p} type="number" min="1" required value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />}
          </Field>
        </div>
        <Field label="Expiration de la clé" hint="Optionnel">
          {(p) => <Input {...p} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />}
        </Field>
        <Field label="Note interne" hint="Optionnel — visible par les administrateurs uniquement.">
          {(p) => <Input {...p} maxLength={200} placeholder="Ex. Offert à Jean Dupont" value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}

function KeyRow({ k, onRevoke, onDelete }) {
  const [open, setOpen] = useState(false);
  const usage = k.max_uses ? k.uses_count / k.max_uses : 0;
  return (
    <li className={cn('transition-opacity', !k.is_active && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-1.5">
          <code className="truncate rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[13px] font-semibold text-brand select-all">{k.key}</code>
          <CopyButton text={k.key} />
        </div>
        <PlanBadge plan={k.plan} />
        <KeyStatus k={k} />
        <div className="hidden w-32 md:block">
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-subtle"><span>Utilisations</span><span className="tabular-nums">{k.uses_count}/{k.max_uses}</span></div>
          <ProgressBar value={usage} className="h-1.5" label="Utilisations de la clé" />
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {k.is_active ? (
            <button type="button" onClick={() => onRevoke(k)} aria-label="Révoquer la clé" title="Révoquer" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-warning/10 hover:text-warning"><Ban className="size-4" /></button>
          ) : null}
          <button type="button" onClick={() => onDelete(k)} aria-label="Supprimer la clé" title="Supprimer" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger"><Trash2 className="size-4" /></button>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Détails" className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-fg">
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>
      {open && (
        <div className="grid animate-rise gap-4 border-t border-line bg-surface-2/40 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
          {[
            ['Durée', k.duration_days ? <><Calendar className="size-3.5" /> {k.duration_days} jours</> : <><InfinityIcon className="size-3.5" /> Illimitée</>],
            ['Expiration de la clé', k.expires_at ? formatDate(k.expires_at, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
            ['Créée le', formatDate(k.created_at, { day: 'numeric', month: 'short', year: 'numeric' })],
            ['Note', k.note || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="eyebrow mb-1">{label}</p>
              <p className="flex items-center gap-1.5 text-sm font-medium">{value}</p>
            </div>
          ))}
          {k.redemptions?.length > 0 && (
            <div className="col-span-full">
              <p className="eyebrow mb-2">Activée par</p>
              <ul className="space-y-1.5">
                {k.redemptions.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-[13px]">
                    <span className="size-1.5 rounded-full bg-success" />
                    <span className="font-semibold">{r.name || r.email}</span>
                    <span className="text-subtle">{r.email}</span>
                    <span className="ml-auto text-subtle">{formatDate(r.redeemed_at, { day: 'numeric', month: 'short' })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function AdminPanel() {
  useDocumentTitle('Administration');
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, s] = await Promise.all([api.get('/admin/keys'), api.get('/admin/stats')]);
      setKeys(k.keys || []);
      setStats(s);
    } catch (err) {
      toast.error(err.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const create = async (data) => {
    const res = await api.post('/admin/keys', data);
    toast.success(`Clé ${res.key.key} créée.`);
    load();
  };

  const revoke = async (k) => {
    const ok = await confirm({ tone: 'warning', title: 'Révoquer cette clé ?', message: 'Elle ne pourra plus être activée. Les comptes qui l’ont déjà utilisée ne sont pas affectés.', confirmLabel: 'Révoquer' });
    if (!ok) return;
    try { await api.patch(`/admin/keys/${k.id}/revoke`); toast.info('Clé révoquée.'); load(); } catch (err) { toast.error(err.message); }
  };

  const remove = async (k) => {
    const ok = await confirm({ tone: 'danger', title: 'Supprimer cette clé ?', message: 'La clé et son historique d’activation seront définitivement supprimés.', confirmLabel: 'Supprimer' });
    if (!ok) return;
    try { await api.delete(`/admin/keys/${k.id}`); toast.info('Clé supprimée.'); load(); } catch (err) { toast.error(err.message); }
  };

  const filtered = useMemo(() => keys.filter((k) => {
    if (status === 'active' && !k.is_active) return false;
    if (status === 'revoked' && k.is_active) return false;
    if (plan !== 'all' && k.plan !== plan) return false;
    const q = query.trim().toLowerCase();
    return !q || k.key.toLowerCase().includes(q) || (k.note || '').toLowerCase().includes(q);
  }), [keys, status, plan, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        badge={<Badge tone="accent" icon={ShieldCheck}>{user?.name || user?.email}</Badge>}
        description="Gérez les clés d’abonnement et suivez les utilisateurs."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={load} aria-label="Actualiser">Actualiser</Button>
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Nouvelle clé</Button>
          </>
        }
      />

      <section aria-label="Statistiques" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard loading={loading && !stats} icon={Key} tone="primary" label="Clés créées" value={stats?.totalKeys ?? 0} />
        <StatCard loading={loading && !stats} icon={CircleCheck} tone="success" label="Clés actives" value={stats?.activeKeys ?? 0} />
        <StatCard loading={loading && !stats} icon={Hash} tone="accent" label="Activations" value={stats?.totalRedemptions ?? 0} />
        <StatCard loading={loading && !stats} icon={Users} tone="warning" label="Utilisateurs" value={stats?.totalUsers ?? 0} />
      </section>

      {stats?.planBreakdown?.length > 0 && (
        <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
          <span className="eyebrow">Répartition par plan</span>
          {stats.planBreakdown.map(({ plan: pl, count }) => (
            <span key={pl} className="flex items-center gap-2"><PlanBadge plan={pl} /><b className="text-sm tabular-nums">×{count}</b></span>
          ))}
        </Card>
      )}

      <Card>
        <CardHeader icon={KeyRound} title="Clés d’abonnement" description={`${filtered.length} ${plural(filtered.length, 'clé', 'clés')}`} />
        <CardBody className="space-y-4 pb-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input icon={Search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une clé ou une note…" aria-label="Rechercher" wrapperClassName="lg:w-80" />
            <div className="flex flex-wrap gap-2.5">
              <Segmented size="sm" label="Statut" value={status} onChange={setStatus} options={[{ value: 'all', label: 'Toutes' }, { value: 'active', label: 'Actives' }, { value: 'revoked', label: 'Révoquées' }]} />
              <Segmented size="sm" label="Plan" value={plan} onChange={setPlan} options={[{ value: 'all', label: 'Tous plans' }, ...PLANS.map((p) => ({ value: p.value, label: p.label }))]} />
            </div>
          </div>
        </CardBody>
        <div className="mt-4 border-t border-line">
          {loading && keys.length === 0 ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Key} title="Aucune clé" description={keys.length ? 'Aucune clé ne correspond à ces filtres.' : 'Créez votre première clé d’abonnement.'} action={!keys.length && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Nouvelle clé</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((k) => <KeyRow key={k.id} k={k} onRevoke={revoke} onDelete={remove} />)}
            </ul>
          )}
        </div>
      </Card>

      {stats?.recentUsers?.length > 0 && (
        <Card>
          <CardHeader icon={Users} tone="info" title="Derniers utilisateurs" description="Comptes les plus récents" />
          <div className="mt-4 overflow-x-auto border-t border-line">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-subtle">
                  <th className="px-5 py-3 font-bold">Utilisateur</th>
                  <th className="px-5 py-3 font-bold">Plan</th>
                  <th className="px-5 py-3 font-bold">Statut</th>
                  <th className="hidden px-5 py-3 font-bold md:table-cell">Inscrit le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.recentUsers.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-surface-2/60">
                    <td className="px-5 py-3"><p className="font-semibold">{u.name || '—'}</p><p className="text-xs text-subtle">{u.email}</p></td>
                    <td className="px-5 py-3">{u.plan ? <PlanBadge plan={u.plan} /> : <span className="text-subtle">—</span>}</td>
                    <td className="px-5 py-3"><Badge tone={u.subscription_status === 'active' ? 'success' : u.subscription_status === 'trialing' ? 'primary' : 'neutral'}>{u.subscription_status || '—'}</Badge></td>
                    <td className="hidden px-5 py-3 text-muted md:table-cell">{formatDate(u.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {creating && <CreateKeyModal onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}
