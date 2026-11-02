import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, mediaUrl } from '../services/api';
import { Lock, Mail, Eye, EyeOff, User, ArrowLeft, CheckCircle } from 'lucide-react';

export default function Login() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Determine initial mode from URL
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState(initialMode);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [storeName, setStoreName] = useState('ImageScreen');

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');

    async function loadSettings() {
      try {
        const settings = await api.get('/settings');
        if (settings.logo) setLogoUrl(settings.logo);
        if (settings.store_name) setStoreName(settings.store_name);
      } catch (err) {
        console.error(err);
      }
    }
    loadSettings();
  }, [isAuthenticated, navigate]);

  // Does this server accept sign-ups? (closed by default; the very first account is the admin)
  const [authStatus, setAuthStatus] = useState({ needsSetup: false, registrationOpen: false });
  useEffect(() => {
    let cancelled = false;
    api.get('/auth/status')
      .then((s) => {
        if (cancelled) return;
        setAuthStatus(s);
        if (s.needsSetup) setMode('register');
        else if (!s.registrationOpen) setMode('login');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Reset errors on mode change
  const switchMode = (m) => {
    setMode(m);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas.');
        return;
      }
      if (password.length < 8) {
        setError('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || (mode === 'register'
        ? 'Erreur lors de la création du compte.'
        : 'Identifiants invalides. Veuillez réessayer.'));
    } finally {
      setLoading(false);
    }
  };



  const isRegister = mode === 'register';

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-brand-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Back to home */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Retour à l'accueil
        </Link>

        {/* Brand Banner */}
        <div className="flex flex-col items-center mb-8 text-center">
          {logoUrl ? (
            <img
              src={logoUrl.startsWith('http') || logoUrl.startsWith('/') ? logoUrl : mediaUrl(logoUrl)}
              alt="Logo"
              className="w-16 h-16 object-contain rounded-lg mb-4 bg-dark-900/60 p-2 border border-slate-800"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center mb-4 shadow-xl shadow-brand-500/20">
              <span className="text-white font-bold text-xl">IS</span>
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-white">{storeName}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isRegister ? (authStatus.needsSetup ? 'Créez le compte administrateur' : 'Créez votre compte') : 'Espace Administration'}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl overflow-hidden relative">
          {/* Free trial badge (register mode) */}
          {isRegister && (
            <div className="bg-gradient-to-r from-brand-500/20 to-violet-500/20 border-b border-brand-500/20 px-6 py-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-brand-400 shrink-0" />
              <p className="text-xs text-brand-300 font-medium">
                Essai gratuit 3 jours — Sans carte bancaire
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                !isRegister
                  ? 'text-white border-b-2 border-brand-500 -mb-px bg-brand-500/5'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Se connecter
            </button>
            {authStatus.registrationOpen && (
              <button
                onClick={() => switchMode('register')}
                className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                  isRegister
                    ? 'text-white border-b-2 border-brand-500 -mb-px bg-brand-500/5'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {authStatus.needsSetup ? 'Créer le compte administrateur' : 'Créer un compte'}
              </button>
            )}
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field (register only) */}
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Nom / Prénom
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Jean Dupont"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg glass-input text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Adresse Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="vous@exemple.fr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg glass-input text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Mot de Passe
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={isRegister ? 'Min. 8 caractères' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 rounded-lg glass-input text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password (register only) */}
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 rounded-lg glass-input text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 hover:from-brand-600 hover:to-violet-600 active:scale-[0.98] text-white font-semibold text-sm shadow-lg shadow-brand-500/20 transition-all flex justify-center items-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isRegister ? (
                  'Créer mon compte — Essai gratuit'
                ) : (
                  'Se connecter'
                )}
              </button>


            </form>

            {/* Footer hint */}
            <p className="text-center text-xs text-slate-600 mt-6">
              {!authStatus.registrationOpen ? (
                <>Les inscriptions sont fermées. Demandez un accès à l'administrateur.</>
              ) : isRegister ? (
                <>
                  Déjà un compte ?{' '}
                  <button onClick={() => switchMode('login')} className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
                    Se connecter
                  </button>
                </>
              ) : (
                <>
                  Pas encore de compte ?{' '}
                  <button onClick={() => switchMode('register')} className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
                    Créer un compte gratuit
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          ImageScreen — Affichage Dynamique Pro
        </p>
      </div>
    </div>
  );
}
