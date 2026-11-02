import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, mediaUrl } from '../services/api';
import {
  LayoutDashboard,
  Tv,
  PlaySquare,
  Image as ImageIcon,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  Shield
} from 'lucide-react';
import { getSocket, initSocket } from '../services/socket';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storeSettings, setStoreSettings] = useState({ store_name: 'Mon Magasin', logo: '' });
  const [socketConnected, setSocketConnected] = useState(false);

  // Fetch settings for dynamic logo/name
  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await api.get('/settings');
        setStoreSettings(settings);
      } catch (err) {
        console.error('Failed to load layout settings:', err);
      }
    }
    loadSettings();

    // Listen to settings update event if socket is connected
    const socket = getSocket() || initSocket('admin');
    setSocketConnected(socket.connected);

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    
    // Listen to logs or setting broadcasts if applicable
    
    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Tableau de bord', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Écrans', path: '/screens', icon: Tv },
    { name: 'Playlists', path: '/playlists', icon: PlaySquare },
    { name: 'Médiathèque', path: '/media', icon: ImageIcon },
    { name: 'Paramètres', path: '/settings', icon: SettingsIcon },
    ...(isAdmin ? [{ name: 'Admin', path: '/admin', icon: Shield, adminOnly: true }] : []),
  ];

  return (
    <div className="min-h-screen bg-dark-950 flex text-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-dark-900 border-r border-slate-800 p-4 shrink-0 justify-between">
        <div>
          {/* Logo Brand */}
          <div className="flex items-center gap-3 px-2 py-4 mb-6">
            {storeSettings.logo ? (
              <img
                src={storeSettings.logo.startsWith('http') || storeSettings.logo.startsWith('/') ? storeSettings.logo : mediaUrl(storeSettings.logo)}
                alt="Logo"
                className="w-10 h-10 object-contain rounded-md"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '';
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/30">
                DS
              </div>
            )}
            <div>
              <h1 className="font-semibold text-base tracking-wide truncate max-w-[150px]">
                {storeSettings.store_name}
              </h1>
              <p className="text-xs text-slate-500 font-medium">Affichage Dynamique</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    item.adminOnly
                      ? isActive
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                        : 'text-violet-400/70 hover:text-violet-300 hover:bg-violet-500/10 border border-transparent mt-2'
                      : isActive
                        ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                  {item.adminOnly && <span className="ml-auto text-[9px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded">admin</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info / Logout */}
        <div className="border-t border-slate-800 pt-4 px-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="truncate max-w-[140px] font-medium">{user?.email}</span>
            <div className="flex items-center gap-1">
              {socketConnected ? (
                <span className="flex items-center text-emerald-500" title="Réseau connecté">
                  <Wifi className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span className="flex items-center text-amber-500" title="Réseau déconnecté">
                  <WifiOff className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Sidebar Mobile Modal */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />

          <aside className="relative flex flex-col w-64 bg-dark-900 border-r border-slate-850 p-4 h-full z-10 animate-slide-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Logo Brand Mobile */}
            <div className="flex items-center gap-3 px-2 py-4 mb-6">
              {storeSettings.logo ? (
                <img
                  src={storeSettings.logo.startsWith('http') || storeSettings.logo.startsWith('/') ? storeSettings.logo : mediaUrl(storeSettings.logo)}
                  alt="Logo"
                  className="w-10 h-10 object-contain rounded-md"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-white shadow-lg">
                  DS
                </div>
              )}
              <div>
                <h1 className="font-semibold text-base truncate max-w-[140px]">{storeSettings.store_name}</h1>
                <p className="text-xs text-slate-500">Affichage Dynamique</p>
              </div>
            </div>

            <nav className="space-y-1.5 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      item.adminOnly
                        ? isActive
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'text-violet-400/70 hover:text-violet-300 hover:bg-violet-500/10 border border-transparent mt-2'
                        : isActive
                          ? 'bg-brand-500 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                    {item.adminOnly && <span className="ml-auto text-[9px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded">admin</span>}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-800 pt-4 px-2 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="truncate">{user?.email}</span>
                {socketConnected ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Mobile */}
        <header className="md:hidden bg-dark-900 border-b border-slate-850 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-slate-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-semibold text-slate-200">{storeSettings.store_name}</span>
          </div>
          {socketConnected ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </header>

        {/* Dynamic Page Rendering Slot */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
