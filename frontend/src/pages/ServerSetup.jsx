import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Globe, Server, ShieldCheck, Wifi } from 'lucide-react';
import { getServerUrl, needsServerSetup, setServerUrl, testServer } from '../services/serverConfig';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { LogoMark } from '../components/ui/Logo';
import { ThemeToggleButton } from '../components/ui/ThemeSwitch';

/**
 * First-launch screen for the native apps (Android / desktop): enter the address of your
 * ImageScreen server once; it is validated, saved and reused everywhere.
 * Also reachable from Settings to change server later (/setup?change=1).
 */
export default function ServerSetup() {
  useDocumentTitle('Connexion au serveur');
  const navigate = useNavigate();
  const location = useLocation();
  const isChange = new URLSearchParams(location.search).has('change');
  const [value, setValue] = useState(isChange && !needsServerSetup() ? getServerUrl() : '');
  const [state, setState] = useState({ loading: false, error: '', ok: false });

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: '', ok: false });
    try {
      const origin = await testServer(value);
      setServerUrl(origin);
      setState({ loading: false, error: '', ok: true });
      // Reload so the socket and API clients pick up the new server cleanly.
      setTimeout(() => {
        // Only in-app paths are allowed as redirect target (no open redirect via //evil.com or /\evil.com)
        const requested = new URLSearchParams(location.search).get('next') || '/';
        const target = /^\/(?![/\\])[\w\-./?=&#%]*$/.test(requested) ? requested : '/';
        if (window.location.protocol === 'file:') {
          window.location.hash = `#${target}`;
          window.location.reload();
        } else {
          window.location.href = target;
        }
      }, 700);
    } catch (err) {
      setState({ loading: false, error: err.message, ok: false });
    }
  };

  return (
    <div className="bg-aurora relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-5 py-10">
      <div className="bg-dots mask-fade-radial pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="absolute right-4 top-4"><ThemeToggleButton /></div>

      <form onSubmit={submit} className="card relative w-full max-w-md animate-rise p-7 sm:p-9">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-3xl bg-brand-gradient opacity-40 blur-xl" aria-hidden="true" />
            <LogoMark className="relative size-16" />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Connexion au serveur</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Saisissez l’adresse de votre serveur ImageScreen. Vous ne le ferez qu’une seule fois.
          </p>
        </div>

        <Field
          label="Adresse du serveur"
          error={state.error}
          hint={!state.error ? 'Exemples : 192.168.1.50:5000 — image-screen.app' : undefined}
        >
          {(p) => (
            <Input
              {...p}
              icon={Globe}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="192.168.1.50:5000"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono"
            />
          )}
        </Field>

        {state.ok && (
          <div role="status" className="mt-4 flex animate-pop items-center gap-2.5 rounded-xl border border-success/25 bg-success/10 px-3.5 py-2.5 text-sm font-semibold text-success">
            <CheckCircle2 className="size-4" /> Serveur trouvé, connexion…
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" className="mt-6 w-full focus-visible:ring-white/70" loading={state.loading} disabled={!value.trim() || state.ok} icon={Server}>
          {state.loading ? 'Test en cours…' : 'Se connecter'}
        </Button>

        {isChange && (
          <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => navigate(-1)}>Annuler</Button>
        )}

        <ul className="mt-7 space-y-2.5 border-t border-line pt-6 text-[13px] text-muted">
          <li className="flex items-center gap-2.5"><Wifi className="size-4 text-brand" /> Sur le réseau local, le HTTP simple est accepté.</li>
          <li className="flex items-center gap-2.5"><ShieldCheck className="size-4 text-brand" /> Sur Internet, utilisez toujours une adresse en https://</li>
        </ul>
      </form>
    </div>
  );
}
