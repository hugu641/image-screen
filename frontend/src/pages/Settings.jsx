import { useEffect, useRef, useState } from 'react';
import { Check, Clock, KeyRound, Lock, Palette, Server, ShieldAlert, Store, Tv, Upload } from 'lucide-react';
import { api, mediaUrl } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { setStoreSettings, useStoreSettings } from '../hooks/useStoreSettings';
import { useTheme } from '../hooks/useTheme';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { clearServerUrl, getServerUrl, isNativeApp } from '../services/serverConfig';
import Button from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Field, Input, PasswordInput, PasswordMeter } from '../components/ui/Field';
import { PageHeader } from '../components/ui/Misc';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/Confirm';
import TvAddress from '../components/TvAddress';
import { cn } from '../utils/cn';

function ThemeCard({ value, label, active, onSelect, preview }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(value)}
      className={cn(
        'group rounded-2xl border p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        active ? 'border-primary bg-primary/5 shadow-glow' : 'border-line hover:border-line-strong'
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-black/10">{preview}</div>
      <div className="mt-2.5 flex items-center justify-between px-1">
        <span className="text-[13px] font-bold">{label}</span>
        {active && <Check className="size-4 text-brand" strokeWidth={3} />}
      </div>
    </button>
  );
}

function MiniUi({ bg, card, line, text, accent = '#6a5cf6' }) {
  return (
    <div className="flex h-full w-full" style={{ background: bg }}>
      <div className="w-1/4 space-y-1.5 p-2" style={{ background: card, borderRight: `1px solid ${line}` }}>
        <div className="h-1.5 w-3/4 rounded-full" style={{ background: accent }} />
        <div className="h-1.5 w-full rounded-full" style={{ background: line }} />
        <div className="h-1.5 w-2/3 rounded-full" style={{ background: line }} />
      </div>
      <div className="flex-1 space-y-2 p-2.5">
        <div className="h-2 w-1/2 rounded-full" style={{ background: text }} />
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-7 rounded-md" style={{ background: card, border: `1px solid ${line}` }} />
          <div className="h-7 rounded-md" style={{ background: card, border: `1px solid ${line}` }} />
        </div>
        <div className="h-9 rounded-md" style={{ background: card, border: `1px solid ${line}` }} />
      </div>
    </div>
  );
}

const LIGHT = { bg: '#f6f7fb', card: '#ffffff', line: '#e2e5f0', text: '#1b2036' };
const DARK = { bg: '#08090e', card: '#0f111a', line: '#23273a', text: '#eef0f7' };

export default function Settings() {
  useDocumentTitle('Paramètres');
  const toast = useToast();
  const confirm = useConfirm();
  const { changePassword, mustChangePassword, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const store = useStoreSettings();

  const [storeName, setStoreName] = useState('');
  const [defaultDuration, setDefaultDuration] = useState(5);
  const [logo, setLogo] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const logoInput = useRef(null);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // Fill the form once the shared settings have loaded
  useEffect(() => {
    if (store.loaded && !hydrated) {
      setStoreName(store.store_name || '');
      setDefaultDuration(parseInt(store.default_duration, 10) || 5);
      setLogo(store.logo || '');
      setHydrated(true);
    }
  }, [store, hydrated]);

  const saveStore = async (e) => {
    e.preventDefault();
    if (!storeName.trim()) return toast.error('Le nom du magasin est obligatoire.');
    setSavingStore(true);
    try {
      await api.put('/settings', { store_name: storeName.trim(), default_duration: defaultDuration, logo });
      setStoreSettings({ store_name: storeName.trim(), default_duration: String(defaultDuration), logo });
      toast.success('Paramètres du magasin enregistrés.');
    } catch (err) {
      toast.error(err.message || 'Enregistrement impossible.');
    } finally {
      setSavingStore(false);
    }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await api.upload('/media/upload', fd);
      if (res.media?.[0]) {
        setLogo(res.media[0].filepath);
        toast.info('Logo importé : cliquez sur « Enregistrer » pour l’appliquer.');
      }
    } catch (err) {
      toast.error(err.message || 'Import du logo impossible.');
    } finally {
      setLogoBusy(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.next.length < 8) return setPwError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    if (pw.next !== pw.confirm) return setPwError('Les deux mots de passe ne correspondent pas.');
    if (pw.next === pw.current) return setPwError('Choisissez un mot de passe différent de l’actuel.');
    setPwBusy(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Mot de passe mis à jour. Les autres appareils ont été déconnectés.');
    } catch (err) {
      setPwError(err.message || 'Changement impossible.');
    } finally {
      setPwBusy(false);
    }
  };

  const changeServer = async () => {
    const ok = await confirm({
      tone: 'warning',
      title: 'Changer de serveur ?',
      message: 'Vous serez déconnecté et devrez saisir l’adresse du nouveau serveur.',
      confirmLabel: 'Changer de serveur',
    });
    if (!ok) return;
    clearServerUrl();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (window.location.protocol === 'file:') { window.location.hash = '#/setup'; window.location.reload(); }
    else window.location.href = '/setup';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" description="Personnalisez votre magasin, l’apparence de l’interface et la sécurité de votre compte." />

      {mustChangePassword && (
        <div role="alert" className="flex items-start gap-3.5 rounded-2xl border border-warning/30 bg-warning/10 p-4 sm:p-5">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-bold text-warning">Action requise : changez votre mot de passe</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Ce compte utilise un mot de passe connu publiquement ou temporaire. Choisissez-en un nouveau (8 caractères minimum) pour continuer à utiliser l’application.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {/* Store */}
          <Card>
            <CardHeader icon={Store} title="Votre magasin" description="Nom, logo et durée d’affichage par défaut" />
            <CardBody>
              {!isAdmin && (
                <p className="mb-5 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">
                  Seul un administrateur peut modifier ces paramètres.
                </p>
              )}
              <form onSubmit={saveStore} className="space-y-5">
                <Field label="Nom du magasin" required>
                  {(p) => <Input {...p} icon={Store} value={storeName} onChange={(e) => setStoreName(e.target.value)} disabled={!isAdmin} maxLength={100} placeholder="Ex. Boulangerie du Pont" />}
                </Field>

                <Field label="Durée d’affichage par défaut" hint="Appliquée aux nouvelles playlists (en secondes).">
                  {(p) => (
                    <Input {...p} icon={Clock} type="number" min="1" max="3600" value={defaultDuration} onChange={(e) => setDefaultDuration(Math.max(1, parseInt(e.target.value, 10) || 1))} disabled={!isAdmin} wrapperClassName="sm:max-w-48" />
                  )}
                </Field>

                <div>
                  <p className="label">Logo</p>
                  <div className="flex items-center gap-4">
                    <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2">
                      {logo ? <img src={mediaUrl(logo)} alt="Logo du magasin" className="size-full object-contain p-2" /> : <Store className="size-7 text-subtle" />}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" icon={Upload} loading={logoBusy} disabled={!isAdmin} onClick={() => logoInput.current?.click()}>
                          {logo ? 'Changer le logo' : 'Importer un logo'}
                        </Button>
                        {logo && isAdmin && <Button size="sm" variant="ghost" onClick={() => setLogo('')}>Retirer</Button>}
                      </div>
                      <p className="text-xs text-subtle">PNG, JPG ou WEBP, de préférence carré ou horizontal.</p>
                      <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={uploadLogo} />
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex justify-end border-t border-line pt-5">
                    <Button type="submit" variant="primary" loading={savingStore}>Enregistrer</Button>
                  </div>
                )}
              </form>
            </CardBody>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader icon={Palette} tone="accent" title="Apparence" description="Choisissez le thème de l’interface d’administration" />
            <CardBody>
              <div role="radiogroup" aria-label="Thème" className="grid grid-cols-3 gap-3">
                <ThemeCard value="light" label="Clair" active={theme === 'light'} onSelect={setTheme} preview={<MiniUi {...LIGHT} />} />
                <ThemeCard value="dark" label="Sombre" active={theme === 'dark'} onSelect={setTheme} preview={<MiniUi {...DARK} />} />
                <ThemeCard
                  value="system"
                  label="Automatique"
                  active={theme === 'system'}
                  onSelect={setTheme}
                  preview={
                    <>
                      <div className="absolute inset-0"><MiniUi {...LIGHT} /></div>
                      <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]"><MiniUi {...DARK} /></div>
                    </>
                  }
                />
              </div>
              <p className="mt-4 text-xs text-subtle">« Automatique » suit le réglage clair/sombre de votre appareil.</p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-5">
          {/* Security */}
          <Card>
            <CardHeader icon={Lock} tone="warning" title="Mot de passe" description="Changer le mot de passe de votre compte" />
            <CardBody>
              <form onSubmit={submitPassword} className="space-y-4">
                {pwError && <div role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">{pwError}</div>}
                <Field label="Mot de passe actuel" required>
                  {(p) => <PasswordInput {...p} icon={KeyRound} autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />}
                </Field>
                <Field label="Nouveau mot de passe" required hint="8 caractères minimum.">
                  {(p) => (
                    <>
                      <PasswordInput {...p} icon={Lock} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
                      <PasswordMeter value={pw.next} />
                    </>
                  )}
                </Field>
                <Field label="Confirmer le nouveau mot de passe" required>
                  {(p) => <PasswordInput {...p} icon={Lock} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />}
                </Field>
                <Button type="submit" variant="primary" className="w-full" loading={pwBusy}>Mettre à jour le mot de passe</Button>
              </form>
            </CardBody>
          </Card>

          {/* TV address */}
          <Card>
            <CardHeader icon={Tv} tone="info" title="Connecter une TV" description="Adresse à ouvrir sur vos écrans" />
            <CardBody className="space-y-3">
              <TvAddress />
              <p className="text-[13px] leading-relaxed text-muted">
                Ouvrez cette adresse dans le navigateur de la TV : un code s’affiche, saisissez-le dans « Écrans ».
              </p>
            </CardBody>
          </Card>

          {isNativeApp() && (
            <Card>
              <CardHeader icon={Server} tone="success" title="Serveur" description="Serveur ImageScreen auquel cette application est connectée" />
              <CardBody className="space-y-4">
                <code className="block truncate rounded-xl border border-line bg-surface-2/70 px-3.5 py-2.5 font-mono text-[13px] font-semibold">{getServerUrl()}</code>
                <Button variant="secondary" onClick={changeServer}>Changer de serveur</Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
