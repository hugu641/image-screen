import { useEffect, useState } from 'react';
import { Store, Trash2, UserPlus, Users } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Field, Input } from '../components/ui/Field';
import { EmptyState, PageHeader, Switch } from '../components/ui/Misc';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/Confirm';

/**
 * Accounts page, two views:
 *  - super-admin: the stores and their store admins (accounts only, never the store content);
 *  - store admin: the user accounts of its own store.
 */
export default function Accounts() {
  const { isSuperAdmin, isStoreAdmin } = useAuth();
  useDocumentTitle(isSuperAdmin ? 'Magasins' : 'Comptes');
  if (isSuperAdmin) return <StoresAdmin />;
  if (isStoreAdmin) return <StoreUsers />;
  return <Navigate to="/dashboard" replace />;
}

function PasswordField({ value, onChange }) {
  return (
    <Field label="Mot de passe provisoire" required hint="8 caractères minimum. Le titulaire le changera à sa première connexion.">
      {(p) => <Input {...p} type="password" autoComplete="new-password" minLength={8} required value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

// ─── Super-admin: stores and store admins ────────────────────────────────────

function StoresAdmin() {
  const toast = useToast();
  const [stores, setStores] = useState(null);
  const [form, setForm] = useState({ storeName: '', name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const reload = () => api.get('/admin/stores').then(setStores).catch((err) => toast.error(err.message || 'Chargement impossible.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/stores', form);
      toast.success(`Magasin « ${form.storeName} » créé. Compte : ${form.email}`);
      setForm({ storeName: '', name: '', email: '', password: '' });
      reload();
    } catch (err) {
      toast.error(err.message || 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (account, enabled) => {
    try {
      await api.patch(`/admin/accounts/${account.id}`, { disabled: !enabled });
      toast.success(enabled ? 'Compte réactivé.' : 'Compte désactivé.');
      reload();
    } catch (err) {
      toast.error(err.message || 'Mise à jour impossible.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Super-administration" title="Magasins" description="Chaque magasin a son administrateur. Vous gérez les comptes, sans accès au contenu des magasins." />

      <Card>
        <CardHeader icon={UserPlus} title="Nouveau magasin" description="Crée le magasin et son compte administrateur" />
        <form onSubmit={create} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nom du magasin" required>
            {(p) => <Input {...p} icon={Store} required maxLength={100} value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} placeholder="Boulangerie du Pont" />}
          </Field>
          <Field label="Nom de l'administrateur">
            {(p) => <Input {...p} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>
          <Field label="Email de connexion" required>
            {(p) => <Input {...p} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
          </Field>
          <PasswordField value={form.password} onChange={(password) => setForm({ ...form, password })} />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" variant="primary" icon={UserPlus} loading={busy}>Créer le magasin</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader icon={Store} title="Magasins existants" description={stores ? `${stores.length} magasin(s)` : 'Chargement…'} />
        <div className="divide-y divide-line">
          {stores && stores.length === 0 && <EmptyState icon={Store} title="Aucun magasin" description="Créez le premier magasin ci-dessus." />}
          {(stores || []).map((s) => (
            <div key={s.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{s.name}</p>
                <Badge tone="neutral" icon={Users}>{s.userCount} utilisateur(s)</Badge>
              </div>
              {s.admins.length === 0 && <p className="text-sm text-subtle">Aucun administrateur.</p>}
              {s.admins.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2/60 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.name || a.email}</p>
                    <p className="truncate text-xs text-subtle">{a.email}</p>
                  </div>
                  <Switch checked={!a.disabled} onChange={(on) => toggle(a, on)} label={a.disabled ? 'Désactivé' : 'Actif'} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Store admin: users of the store ─────────────────────────────────────────

function StoreUsers() {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const reload = () => api.get('/store/users').then(setUsers).catch((err) => toast.error(err.message || 'Chargement impossible.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/store/users', form);
      toast.success(`Compte créé pour ${form.email}.`);
      setForm({ name: '', email: '', password: '' });
      reload();
    } catch (err) {
      toast.error(err.message || 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u, enabled) => {
    try {
      await api.patch(`/store/users/${u.id}`, { disabled: !enabled });
      reload();
    } catch (err) {
      toast.error(err.message || 'Mise à jour impossible.');
    }
  };

  const remove = async (u) => {
    const ok = await confirm({ tone: 'danger', title: 'Supprimer ce compte ?', message: `${u.email} ne pourra plus se connecter. Le contenu du magasin n'est pas supprimé.`, confirmLabel: 'Supprimer' });
    if (!ok) return;
    try {
      await api.delete(`/store/users/${u.id}`);
      toast.success('Compte supprimé.');
      reload();
    } catch (err) {
      toast.error(err.message || 'Suppression impossible.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Mon magasin" title="Comptes" description="Les personnes de votre magasin utilisent ces comptes pour gérer les écrans, playlists et médias." />

      <Card>
        <CardHeader icon={UserPlus} title="Nouveau compte" description="Un utilisateur du magasin" />
        <form onSubmit={create} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nom">
            {(p) => <Input {...p} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>
          <Field label="Email de connexion" required>
            {(p) => <Input {...p} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
          </Field>
          <PasswordField value={form.password} onChange={(password) => setForm({ ...form, password })} />
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" variant="primary" icon={UserPlus} loading={busy}>Créer le compte</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader icon={Users} tone="info" title="Utilisateurs du magasin" description={users ? `${users.length} compte(s)` : 'Chargement…'} />
        <div className="divide-y divide-line">
          {users && users.length === 0 && <EmptyState icon={Users} title="Aucun utilisateur" description="Créez le premier compte ci-dessus." />}
          {(users || []).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{u.name || u.email}</p>
                <p className="truncate text-xs text-subtle">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={!u.disabled} onChange={(on) => toggle(u, on)} label={u.disabled ? 'Désactivé' : 'Actif'} />
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(u)} aria-label={`Supprimer ${u.email}`} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
