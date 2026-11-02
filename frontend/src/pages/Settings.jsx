import React, { useState, useEffect, useRef } from 'react';
import Layout from '../layouts/Layout';
import { api, mediaUrl } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { getServerUrl, isNativeApp, clearServerUrl } from '../services/serverConfig';
import {
  Settings as SettingsIcon,
  Store,
  Lock,
  Upload,
  Clock,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export default function Settings() {
  const { changePassword, mustChangePassword, isAdmin } = useAuth();
  
  // Settings Form state
  const [storeName, setStoreName] = useState('');
  const [defaultDuration, setDefaultDuration] = useState(5);
  const [logo, setLogo] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  
  // Password Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Status flags
  const [settingsStatus, setSettingsStatus] = useState({ error: '', success: '', loading: false });
  const [passwordStatus, setPasswordStatus] = useState({ error: '', success: '', loading: false });

  const logoInputRef = useRef(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await api.get('/settings');
        setStoreName(settings.store_name || 'Mon Magasin');
        setDefaultDuration(parseInt(settings.default_duration) || 5);
        setLogo(settings.logo || '');
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSettingsStatus({ error: '', success: '', loading: true });

    try {
      await api.put('/settings', {
        store_name: storeName,
        default_duration: defaultDuration,
        logo
      });
      setSettingsStatus({ error: '', success: 'Paramètres enregistrés avec succès.', loading: false });
      
      // Auto-reload window to update sidebar immediately after 1s
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setSettingsStatus({ error: err.message || 'Erreur lors de la mise à jour.', success: '', loading: false });
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordStatus({ error: '', success: '', loading: true });

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ error: 'Les nouveaux mots de passe ne correspondent pas.', success: '', loading: false });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.', success: '', loading: false });
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordStatus({ error: '', success: 'Mot de passe mis à jour avec succès.', loading: false });
      // Reset fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordStatus({ error: err.message || 'Erreur lors du changement de mot de passe.', success: '', loading: false });
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setSettingsStatus({ error: '', success: '', loading: false });

    const formData = new FormData();
    formData.append('files', file);

    try {
      const result = await api.upload('/media/upload', formData);
      if (result.media && result.media[0]) {
        // Set the path to setting logo
        const newLogoPath = result.media[0].filepath;
        setLogo(newLogoPath);
        setSettingsStatus({ error: '', success: 'Logo téléversé. Pensez à enregistrer les paramètres.', loading: false });
      }
    } catch (err) {
      setSettingsStatus({ error: err.message || 'Erreur lors du téléversement du logo.', success: '', loading: false });
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {mustChangePassword && (
          <div role="alert" className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            <strong>Action requise :</strong> ce compte utilise un mot de passe connu publiquement ou temporaire.
            Choisissez un nouveau mot de passe (8 caractères minimum) pour continuer à utiliser l'application.
          </div>
        )}
        {!isAdmin && (
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 text-xs">
            Les paramètres du magasin ne peuvent être modifiés que par un administrateur.
          </div>
        )}
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Paramètres</h1>
          <p className="text-slate-400 text-sm">
            Personnalisez les informations globales et configurez les mots de passe.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Store Settings Form */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Store className="w-5 h-5 text-brand-500" />
              Configuration du Magasin
            </h2>

            {settingsStatus.error && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                {settingsStatus.error}
              </div>
            )}

            {settingsStatus.success && (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {settingsStatus.success}
              </div>
            )}

            <form onSubmit={handleSettingsSubmit} className="space-y-5">
              {/* Store Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Nom du magasin
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                  placeholder="Ex: Boulangerie Du Pont"
                />
              </div>

              {/* Default slide duration */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Durée par défaut (secondes)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={defaultDuration}
                  onChange={(e) => setDefaultDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                />
              </div>

              {/* Logo Preview & Uploader */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Logo du magasin
                </label>

                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 overflow-hidden relative shrink-0">
                    {logo ? (
                      <img
                        src={mediaUrl(logo)}
                        alt="Logo"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-600 font-bold">Aucun</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3.5 py-2 border border-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      {logoUploading ? (
                        <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      Téléverser une image
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      ref={logoInputRef}
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <p className="text-[10px] text-slate-500">
                      Format PNG, JPG ou WEBP de préférence carré/horizontal.
                    </p>
                  </div>
                </div>
              </div>

              {/* Save settings Button */}
              <button
                type="submit"
                disabled={settingsStatus.loading}
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-md shadow-brand-500/20 transition-all flex justify-center items-center gap-1.5"
              >
                {settingsStatus.loading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Enregistrer la configuration'
                )}
              </button>
            </form>
          </div>

          {/* Server connection (native apps only) */}
          {isNativeApp() && (
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
              <h2 className="text-base font-semibold text-white border-b border-slate-800 pb-3">
                Serveur
              </h2>
              <p className="text-xs text-slate-400">
                Connecté à <span className="font-mono text-slate-200">{getServerUrl()}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  clearServerUrl();
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  window.location.protocol === 'file:'
                    ? (window.location.hash = '#/setup', window.location.reload())
                    : (window.location.href = '/setup');
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-100"
              >
                Changer de serveur
              </button>
            </div>
          )}

          {/* Password Settings Form */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="w-5 h-5 text-violet-400" />
              Sécurité administrateur
            </h2>

            {passwordStatus.error && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                {passwordStatus.error}
              </div>
            )}

            {passwordStatus.success && (
              <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {passwordStatus.success}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Mot de passe actuel
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
                  >
                    {showCurrent ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg glass-input pr-10"
                    placeholder="Min 6 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
                  >
                    {showNew ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                  placeholder="Confirmer"
                />
              </div>

              {/* Password update Button */}
              <button
                type="submit"
                disabled={passwordStatus.loading}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-750 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-md shadow-violet-500/20 transition-all flex justify-center items-center gap-1.5"
              >
                {passwordStatus.loading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Mettre à jour le mot de passe'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
