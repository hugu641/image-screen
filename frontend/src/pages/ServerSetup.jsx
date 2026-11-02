import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Server, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  getServerUrl,
  isNativeApp,
  needsServerSetup,
  setServerUrl,
  testServer,
} from '../services/serverConfig';

/**
 * First-launch screen for the native apps (Electron / Android): the user enters the
 * address of their ImageScreen server once; it is validated, saved, and reused everywhere.
 * Also reachable from Settings to change server later (/setup?change=1).
 */
export default function ServerSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const isChange = new URLSearchParams(location.search).has('change');
  const [value, setValue] = useState(isChange && !needsServerSetup() ? getServerUrl() : '');
  const [status, setStatus] = useState({ loading: false, error: '', ok: false });

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: '', ok: false });
    try {
      const origin = await testServer(value);
      setServerUrl(origin);
      setStatus({ loading: false, error: '', ok: true });
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
      }, 600);
    } catch (err) {
      setStatus({ loading: false, error: err.message, ok: false });
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6 text-slate-100">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-slate-900/70 border border-slate-800 rounded-2xl p-8 space-y-6"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/15 flex items-center justify-center">
            <Server className="w-7 h-7 text-brand-500" />
          </div>
          <h1 className="text-2xl font-bold">Connexion au serveur</h1>
          <p className="text-sm text-slate-400">
            Saisissez l’adresse de votre serveur ImageScreen, par exemple{' '}
            <span className="font-mono text-slate-300">192.168.1.50:5000</span> ou{' '}
            <span className="font-mono text-slate-300">image-screen.app</span>.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="server" className="text-xs font-semibold text-slate-400">
            Adresse du serveur
          </label>
          <input
            id="server"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="192.168.1.50:5000"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/50 focus:outline-none font-mono text-sm"
          />
        </div>

        {status.error && (
          <div className="flex gap-2 items-start text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{status.error}</span>
          </div>
        )}
        {status.ok && (
          <div className="flex gap-2 items-center text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4" />
            <span>Serveur trouvé, connexion…</span>
          </div>
        )}

        <button
          type="submit"
          disabled={status.loading || !value.trim()}
          className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-4 focus:ring-white/70 disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
        >
          {status.loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {status.loading ? 'Test en cours…' : 'Se connecter'}
        </button>

        {isChange && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full text-sm text-slate-400 hover:text-slate-200"
          >
            Annuler
          </button>
        )}

        {!isNativeApp() && !isChange && (
          <p className="text-xs text-center text-slate-500">
            Dans le navigateur, l’application utilise automatiquement le serveur qui l’héberge.
          </p>
        )}
      </form>
    </div>
  );
}
