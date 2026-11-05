import { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Images,
  LayoutDashboard,
  ListVideo,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  ShieldCheck,
  Tv,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { useAdminSocket, useSocketConnected } from '../hooks/useAdminSocket';
import { api, mediaUrl } from '../services/api';
import { Brand } from '../components/ui/Logo';
import { Avatar, Skeleton } from '../components/ui/Misc';
import { Badge } from '../components/ui/Badge';
import { DropdownMenu, MenuItem, MenuLabel, MenuSeparator } from '../components/ui/Menu';
import { ThemeSwitch, ThemeToggleButton } from '../components/ui/ThemeSwitch';
import { cn } from '../utils/cn';

const NAV = [
  { to: '/dashboard', label: 'Tableau de bord', short: 'Accueil', icon: LayoutDashboard },
  { to: '/screens', label: 'Écrans', short: 'Écrans', icon: Tv },
  { to: '/playlists', label: 'Playlists', short: 'Playlists', icon: ListVideo },
  { to: '/media', label: 'Médiathèque', short: 'Médias', icon: Images },
  { to: '/settings', label: 'Paramètres', short: 'Réglages', icon: SettingsIcon },
];

function StoreLogo({ logo, name, collapsed }) {
  const [brokenLogo, setBrokenLogo] = useState(null);
  const broken = brokenLogo === logo;
  return (
    <Brand
      name={name || 'ImageScreen'}
      subtitle="Affichage dynamique"
      logo={logo && !broken ? mediaUrl(logo) : null}
      onLogoError={() => setBrokenLogo(logo)}
      collapsed={collapsed}
      markClassName={collapsed ? 'size-10' : undefined}
    />
  );
}

function SideLink({ to, icon: Icon, label, collapsed, badge, active }) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
        collapsed && 'justify-center px-0',
        active ? 'bg-primary/10 text-brand' : 'text-muted hover:bg-surface-2 hover:text-fg'
      )}
    >
      {active && <span className="absolute -left-3 bottom-2 top-2 w-1 rounded-r-full bg-brand-gradient" aria-hidden="true" />}
      <Icon className={cn('size-[18px] shrink-0 transition-transform group-hover:scale-110', active && 'text-brand')} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-brand-gradient px-1.5 text-[11px] font-bold leading-5 text-white">
          {badge}
        </span>
      )}
      {collapsed && badge > 0 && (
        <span className="absolute right-2 top-1.5 size-2.5 rounded-full bg-brand-gradient ring-2 ring-surface" aria-hidden="true" />
      )}
    </Link>
  );
}

function PageFallback() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
      </div>
    </div>
  );
}

function ConnectionPill({ connected, compact }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold max-sm:px-2.5',
        connected ? 'border-success/25 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning'
      )}
      title={connected ? 'Connecté au serveur en temps réel' : 'Connexion au serveur perdue — reconnexion…'}
    >
      {connected ? <span className="live-dot" /> : <WifiOff className="size-3.5" />}
      {!compact && <span className="max-sm:hidden">{connected ? 'Temps réel' : 'Hors ligne'}</span>}
    </span>
  );
}

function UserMenu({ user, isAdmin, onLogout }) {
  const display = user?.name || user?.email || 'Utilisateur';
  return (
    <DropdownMenu
      width={264}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label="Menu du compte"
          className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-surface-2"
        >
          <Avatar name={display} />
          <ChevronDown className="hidden size-4 text-subtle sm:block" />
        </button>
      )}
    >
      <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
        <Avatar name={display} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{display}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
          <Badge tone={isAdmin ? 'accent' : 'neutral'} className="mt-1.5">{isAdmin ? 'Administrateur' : 'Utilisateur'}</Badge>
        </div>
      </div>
      <MenuSeparator />
      <MenuItem icon={SettingsIcon} to="/settings">Paramètres</MenuItem>
      {isAdmin && <MenuItem icon={ShieldCheck} to="/admin">Administration</MenuItem>}
      <MenuSeparator />
      <MenuLabel>Apparence</MenuLabel>
      <div className="px-2 pb-2">
        <ThemeSwitch size="sm" className="w-full [&>button]:flex-1" />
      </div>
      <MenuSeparator />
      <MenuItem icon={LogOut} tone="danger" onClick={onLogout}>Se déconnecter</MenuItem>
    </DropdownMenu>
  );
}

/**
 * Authenticated application shell: sidebar (desktop), top bar, floating tab dock (mobile).
 * Rendered once for all admin pages (nested routes), so navigation never remounts it.
 */
export default function AppShell() {
  const { user, logout, isAdmin } = useAuth();
  const store = useStoreSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === '1'; } catch { return false; }
  });
  const connected = useSocketConnected();
  const [screens, setScreens] = useState([]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('sidebar_collapsed', c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  // Pending-screen badge on the "Écrans" entry
  useEffect(() => {
    api.get('/screens').then(setScreens).catch(() => {});
  }, []);
  useAdminSocket({
    'screens:list': setScreens,
    'screen:status_update': ({ id, status }) =>
      setScreens((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s))),
  });
  const pending = useMemo(() => screens.filter((s) => !s.is_associated).length, [screens]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // The live preview belongs to the "Écrans" section
  const activeKey = location.pathname.startsWith('/admin/preview') ? '/screens' : location.pathname;
  const isActive = (to) => activeKey === to || activeKey.startsWith(`${to}/`);
  const current = NAV.find((n) => isActive(n.to));
  const sectionLabel =
    current?.label ||
    (location.pathname.startsWith('/admin/preview') ? 'Aperçu en direct' : location.pathname.startsWith('/admin') ? 'Administration' : '');

  return (
    <div className="bg-aurora min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only z-[300] rounded-xl bg-surface px-4 py-2 text-sm font-semibold shadow-pop focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Aller au contenu
      </a>

      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside
        className={cn(
          'glass fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line transition-[width] duration-300 lg:flex',
          collapsed ? 'w-[84px]' : 'w-[272px]'
        )}
      >
        <div className={cn('flex h-[72px] items-center border-b border-line', collapsed ? 'justify-center px-3' : 'px-5')}>
          <StoreLogo logo={store.logo} name={store.store_name} collapsed={collapsed} />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Navigation principale">
          {!collapsed && <p className="eyebrow mb-2 px-3">Gestion</p>}
          {NAV.slice(0, 4).map((n) => (
            <SideLink key={n.to} {...n} active={isActive(n.to)} collapsed={collapsed} badge={n.to === '/screens' ? pending : 0} />
          ))}
          <div className="py-2"><div className="divider" /></div>
          {!collapsed && <p className="eyebrow mb-2 px-3">Système</p>}
          <SideLink {...NAV[4]} active={isActive(NAV[4].to)} collapsed={collapsed} />
          {isAdmin && <SideLink to="/admin" icon={ShieldCheck} label="Administration" active={isActive('/admin')} collapsed={collapsed} />}
        </nav>

        <div className="space-y-3 border-t border-line p-3">
          {!collapsed && (
            <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
              <div className="flex items-center gap-2.5">
                <div className={cn('grid size-8 place-items-center rounded-lg', connected ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                  {connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold leading-tight">{connected ? 'Serveur connecté' : 'Connexion perdue'}</p>
                  <p className="text-[11px] text-subtle">{connected ? 'Synchronisation en direct' : 'Nouvelle tentative…'}</p>
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold text-subtle transition hover:bg-surface-2 hover:text-fg',
              collapsed && 'justify-center px-0'
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && 'Replier le menu'}
          </button>
        </div>
      </aside>

      {/* ── Content column ────────────────────────────────────────────── */}
      <div className={cn('transition-[padding] duration-300', collapsed ? 'lg:pl-[84px]' : 'lg:pl-[272px]')}>
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line px-4 sm:px-6 lg:h-[72px] lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden">
              <StoreLogo logo={store.logo} name={store.store_name} />
            </div>
            <p className="hidden items-center gap-2 text-sm font-medium text-subtle lg:flex">
              <span>{store.store_name || 'ImageScreen'}</span>
              <span aria-hidden="true">/</span>
              <span className="font-bold text-fg">{sectionLabel}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <ConnectionPill connected={connected} compact={false} />
            <ThemeToggleButton className="hidden sm:grid" />
            <UserMenu user={user} isAdmin={isAdmin} onLogout={handleLogout} />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1320px] px-4 pb-32 pt-6 outline-none sm:px-6 lg:px-10 lg:pb-14 lg:pt-9">
          <div key={location.pathname} className="animate-rise">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* ── Floating tab dock (mobile / tablet) ───────────────────────── */}
      <nav
        aria-label="Navigation principale"
        className="glass fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-3xl border border-line p-1.5 shadow-pop lg:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            aria-current={isActive(n.to) ? 'page' : undefined}
            className={cn(
              'relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10.5px] font-bold transition-colors',
              isActive(n.to) ? 'bg-primary/10 text-brand' : 'text-subtle'
            )}
          >
            <n.icon className="size-5" />
            {n.short}
            {n.to === '/screens' && pending > 0 && (
              <span className="absolute right-[22%] top-1.5 size-2.5 rounded-full bg-brand-gradient ring-2 ring-surface" aria-hidden="true" />
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
