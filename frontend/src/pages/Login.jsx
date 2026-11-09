import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Lock, Mail, ShieldCheck, Sparkles, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api, mediaUrl } from '../services/api';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import AuthShowcase from '../components/AuthShowcase';
import Button from '../components/ui/Button';
import { Field, Input, PasswordInput, PasswordMeter } from '../components/ui/Field';
import { Brand } from '../components/ui/Logo';
import { ThemeToggleButton } from '../components/ui/ThemeSwitch';

export default function Login() {
  const { login, register, isAuthenticated, mustChangePassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Where to go after signing in (set by the route guard); only in-app paths are accepted
  const requested = location.state?.from;
  // A super-admin manages accounts; everyone else starts on the dashboard
  const home = user?.role === 'superadmin' ? '/comptes' : '/dashboard';
  const destination = typeof requested === 'string' && /^\/(?![/\\])/.test(requested) ? requested : home;
  const store = useStoreSettings();

  const [mode, setMode] = useState(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [status, setStatus] = useState({ needsSetup: false, needsSetupToken: false, registrationOpen: false });
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', setupToken: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';
  useDocumentTitle(isRegister ? 'Créer un compte' : 'Connexion');

  // Already signed in: go straight to the app
  useEffect(() => {
    if (isAuthenticated) navigate(mustChangePassword ? '/settings' : destination, { replace: true });
  }, [isAuthenticated, mustChangePassword, navigate, destination]);

  // Does this server accept sign-ups? (closed by default; the very first account is the admin)
  useEffect(() => {
    let cancelled = false;
    api.get('/auth/status')
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (s.needsSetup) setMode('register');
        else if (!s.registrationOpen) setMode('login');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setForm((f) => ({ ...f, password: '', confirm: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isRegister) {
      if (form.password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
      if (form.password !== form.confirm) return setError('Les deux mots de passe ne correspondent pas.');
    }
    setBusy(true);
    try {
      if (isRegister) await register(form.email, form.password, form.name, form.setupToken);
      else await login(form.email, form.password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || (isRegister ? 'Création du compte impossible.' : 'Identifiants invalides.'));
    } finally {
      setBusy(false);
    }
  };

  const title = status.needsSetup
    ? 'Bienvenue sur ImageScreen'
    : isRegister ? 'Créer un compte' : 'Content de vous revoir';
  const subtitle = status.needsSetup
    ? 'Créez le compte administrateur pour commencer. Le premier compte créé devient administrateur.'
    : isRegister ? 'Rejoignez votre espace de gestion d’écrans.' : 'Connectez-vous pour gérer vos écrans.';

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1.05fr_1fr]">
      <AuthShowcase />

      <main className="bg-aurora relative flex min-h-dvh flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted transition hover:text-fg">
            <ArrowLeft className="size-4" /> Accueil
          </Link>
          <ThemeToggleButton />
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          <Brand
            name={store.store_name || 'ImageScreen'}
            subtitle="Affichage dynamique"
            logo={store.logo ? mediaUrl(store.logo) : null}
            className="mb-9 lg:hidden"
          />

          <div className="animate-rise">
            {status.needsSetup && (
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-brand">
                <Sparkles className="size-3.5" /> Première installation
              </span>
            )}
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>

            {status.registrationOpen && !status.needsSetup && (
              <div className="mt-7 grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Connexion ou création de compte">
                {[['login', 'Connexion'], ['register', 'Créer un compte']].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => switchMode(value)}
                    className={`rounded-lg py-2 text-[13px] font-semibold transition ${mode === value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={submit} className="mt-7 space-y-4" noValidate={false}>
              {error && (
                <div role="alert" className="animate-pop rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                  {error}
                </div>
              )}

              {isRegister && status.needsSetupToken && (
                <Field label="Code d’installation" required hint="Défini par la variable SETUP_TOKEN sur le serveur.">
                  {(p) => <PasswordInput {...p} icon={KeyRound} autoComplete="off" value={form.setupToken} onChange={set('setupToken')} required />}
                </Field>
              )}

              {isRegister && (
                <Field label="Nom">
                  {(p) => <Input {...p} icon={User} autoComplete="name" value={form.name} onChange={set('name')} placeholder="Votre nom" maxLength={100} />}
                </Field>
              )}

              <Field label="Adresse e-mail" required>
                {(p) => <Input {...p} icon={Mail} type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="vous@exemple.fr" required autoFocus={!isRegister} />}
              </Field>

              <Field label="Mot de passe" required hint={isRegister ? '8 caractères minimum.' : undefined}>
                {(p) => (
                  <>
                    <PasswordInput {...p} icon={Lock} autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} placeholder="••••••••" required />
                    {isRegister && <PasswordMeter value={form.password} />}
                  </>
                )}
              </Field>

              {isRegister && (
                <Field label="Confirmer le mot de passe" required>
                  {(p) => <PasswordInput {...p} icon={Lock} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required />}
                </Field>
              )}

              <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" loading={busy} icon={isRegister ? ShieldCheck : undefined}>
                {isRegister ? (status.needsSetup ? 'Créer le compte administrateur' : 'Créer mon compte') : 'Se connecter'}
              </Button>
              {!isRegister && status.mailEnabled && (
                <p className="text-center text-[13px]">
                  <Link to="/mot-de-passe-oublie" className="font-semibold text-primary hover:underline">Mot de passe oublié ?</Link>
                </p>
              )}
            </form>

            {!status.registrationOpen && (
              <p className="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-center text-[13px] text-muted">
                Les inscriptions sont fermées. Demandez un accès à l’administrateur de votre magasin.
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-subtle">ImageScreen — Affichage dynamique</p>
      </main>
    </div>
  );
}
