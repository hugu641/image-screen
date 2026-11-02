import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { needsServerSetup } from './services/serverConfig';

const APP_MODE = import.meta.env.VITE_APP_MODE || 'web';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Screens from './pages/Screens';
import Playlists from './pages/Playlists';
import MediaLibrary from './pages/MediaLibrary';
import Settings from './pages/Settings';
import TVPlayer from './pages/TVPlayer';
import LivePreview from './pages/LivePreview';
import Home from './pages/Home';
import AdminPanel from './pages/AdminPanel';
import ServerSetup from './pages/ServerSetup';

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

// Protected Route Guard
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-400 font-semibold">Vérification de la session...</span>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Admin Route Guard
function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-slate-100">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-400 font-semibold">Vérification des droits...</span>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <SetupGate>
        <Routes>
          {/* Server address (native apps, first launch) */}
          <Route path="/setup" element={<ServerSetup />} />

          {/* Public Authentication */}
          <Route path="/login" element={<Login />} />

          {/* Fullscreen TV Player */}
          <Route path="/tv" element={<TVPlayer />} />

          {/* Public Home Page (the TV app has no home: it opens straight on the player) */}
          <Route path="/" element={APP_MODE === 'tv' ? <Navigate to="/tv" replace /> : <Home />} />

          {/* Protected Administration Panel */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/screens"
            element={
              <ProtectedRoute>
                <Screens />
              </ProtectedRoute>
            }
          />
          <Route
            path="/playlists"
            element={
              <ProtectedRoute>
                <Playlists />
              </ProtectedRoute>
            }
          />
          <Route
            path="/media"
            element={
              <ProtectedRoute>
                <MediaLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          
          {/* Live Preview */}
          <Route
            path="/admin/preview/:id"
            element={
              <ProtectedRoute>
                <LivePreview />
              </ProtectedRoute>
            }
          />

          {/* Admin Panel */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            }
          />

          {/* Fallback Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SetupGate>
      </Router>
    </AuthProvider>
  );
}
