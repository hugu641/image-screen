import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { needsServerSetup } from './services/serverConfig';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/Confirm';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { LogoMark } from './components/ui/Logo';
import AppShell from './layouts/Layout';

// Pages are loaded on demand: the TV player (/tv) never downloads the admin code, which keeps
// start-up fast on low-power TVs.
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Screens = lazy(() => import('./pages/Screens'));
const Playlists = lazy(() => import('./pages/Playlists'));
const MediaLibrary = lazy(() => import('./pages/MediaLibrary'));
const Settings = lazy(() => import('./pages/Settings'));
const TVPlayer = lazy(() => import('./pages/TVPlayer'));
const LivePreview = lazy(() => import('./pages/LivePreview'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ServerSetup = lazy(() => import('./pages/ServerSetup'));

const APP_MODE = import.meta.env.VITE_APP_MODE || 'web';

// file:// (Electron) has no server-side routing, so use hash URLs there.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

// Native apps with no server chosen yet are sent to /setup before anything else.
function SetupGate({ children }) {
  const location = useLocation();
  if (needsServerSetup() && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }
  return children;
}

function Splash({ label }) {
  return (
    <div className="bg-aurora grid min-h-dvh place-items-center bg-bg">
      <div className="flex flex-col items-center gap-5">
        <LogoMark className="size-14 animate-pulse" />
        <p className="text-sm font-semibold text-muted">{label}</p>
      </div>
    </div>
  );
}

/** Requires a signed-in user and renders the application shell around the nested routes. */
function RequireAuth() {
  const { isAuthenticated, loading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (loading) return <Splash label="Vérification de la session…" />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  // A pending password change (e.g. an account that still had a public default password)
  // blocks everything except the Settings page where it can be done.
  if (mustChangePassword && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace />;
  }
  return <AppShell />;
}

function RequireAdmin() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ErrorBoundary>
            <AuthProvider>
              <Router>
                <SetupGate>
                  <Suspense fallback={<Splash label="Chargement…" />}>
                  <Routes>
                    {/* Server address (native apps, first launch) */}
                    <Route path="/setup" element={<ServerSetup />} />

                    {/* Public */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/tv" element={<TVPlayer />} />
                    {/* The TV app has no landing page: it opens straight on the player */}
                    <Route path="/" element={APP_MODE === 'tv' ? <Navigate to="/tv" replace /> : <Home />} />

                    {/* Administration (signed-in users) */}
                    <Route element={<RequireAuth />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/screens" element={<Screens />} />
                      <Route path="/playlists" element={<Playlists />} />
                      <Route path="/media" element={<MediaLibrary />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/admin/preview/:id" element={<LivePreview />} />
                      <Route element={<RequireAdmin />}>
                        <Route path="/admin" element={<AdminPanel />} />
                      </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                  </Suspense>
                </SetupGate>
              </Router>
            </AuthProvider>
          </ErrorBoundary>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
