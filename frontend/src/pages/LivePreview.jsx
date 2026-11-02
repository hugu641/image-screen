import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, mediaUrl } from '../services/api';
import { getSocket, initSocket } from '../services/socket';
import { Tv, ArrowLeft, Wifi, WifiOff, Loader } from 'lucide-react';

export default function LivePreview() {
  const { id } = useParams();
  const [screen, setScreen] = useState(null);
  const [playlist, setPlaylist] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(null);
  const [liveInfo, setLiveInfo] = useState({ index: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    async function loadPreviewData() {
      try {
        // Fetch screens and find the active screen
        const screens = await api.get('/screens');
        const activeScreen = screens.find(s => s.id === id);
        if (!activeScreen) {
          alert("Écran introuvable.");
          return;
        }
        setScreen(activeScreen);
        setIsOnline(activeScreen.status === 'connected');

        if (activeScreen.playlist_id) {
          const pl = await api.get(`/playlists/${activeScreen.playlist_id}`);
          setPlaylist(pl);
          if (pl.media && pl.media.length > 0) {
            setCurrentSlide(pl.media[0]);
            setLiveInfo({ index: 0, total: pl.media.length });
          }
        }
      } catch (err) {
        console.error('Failed to load live preview data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPreviewData();

    // Hook Socket connection
    const socket = getSocket() || initSocket('admin');
    
    // Listen for live screen slide changes
    socket.on(`screen:preview:${id}`, (data) => {
      // data contains { mediaId, index, total, progress }
      setLiveInfo({ index: data.index, total: data.total });
      setIsOnline(true);
      
      // Update displayed slide by index or ID
      if (playlist && playlist.media) {
        const matchingSlide = playlist.media[data.index];
        if (matchingSlide) {
          setCurrentSlide(matchingSlide);
        }
      }
    });

    // Listen for connection changes
    socket.on('screen:status_update', (data) => {
      if (data.id === id) {
        setIsOnline(data.status === 'connected');
      }
    });

    return () => {
      socket.off(`screen:preview:${id}`);
      socket.off('screen:status_update');
    };
  }, [id, playlist]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-slate-100">
        <Loader className="w-8 h-8 text-brand-500 animate-spin mb-3" />
        <span className="text-xs text-slate-400 font-semibold">Chargement de l'aperçu...</span>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-slate-150 p-6">
        <h2 className="text-lg font-bold">Écran introuvable</h2>
        <Link to="/screens" className="mt-4 text-xs font-semibold text-brand-400 hover:text-brand-350 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Retour aux écrans
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col p-4 md:p-8">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-850 mb-8 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/screens"
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Tv className="w-5 h-5 text-brand-500" />
              Aperçu en direct : {screen.name}
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Adresse IP : {screen.ip_address} — Identifiant : {screen.id.substring(0, 16)}...
            </p>
          </div>
        </div>

        {/* Live Network Status badge */}
        <div>
          {isOnline ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <Wifi className="w-3.5 h-3.5" />
              Écran Connecté
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-500/10 border border-slate-800 px-3 py-1 rounded-full">
              <WifiOff className="w-3.5 h-3.5" />
              Écran Hors Ligne
            </span>
          )}
        </div>
      </div>

      {/* Main mirror box */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl aspect-video bg-black border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative flex items-center justify-center">
          {currentSlide ? (
            currentSlide.mime_type.startsWith('video/') ? (
              <video
                key={currentSlide.id}
                src={mediaUrl(currentSlide.filepath)}
                autoPlay
                muted
                loop
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                key={currentSlide.id}
                src={mediaUrl(currentSlide.filepath)}
                alt=""
                className="w-full h-full object-cover animate-fade-in"
              />
            )
          ) : (
            <div className="text-slate-500 text-sm flex flex-col items-center gap-2">
              <Tv className="w-10 h-10 text-slate-700 animate-pulse" />
              En attente de contenu...
            </div>
          )}

          {/* Index count overlay */}
          {currentSlide && (
            <div className="absolute bottom-4 right-4 bg-black/75 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold font-mono">
              Diapo {liveInfo.index + 1} / {liveInfo.total}
            </div>
          )}
        </div>

        {/* Current slide details */}
        {currentSlide && (
          <div className="mt-6 text-center space-y-1">
            <h3 className="text-sm font-semibold text-slate-350">{currentSlide.original_name}</h3>
            <p className="text-xs text-slate-550">
              Format: {currentSlide.mime_type} — Playlist active: {playlist?.name || 'Aucune'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
