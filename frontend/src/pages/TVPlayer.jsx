import React, { useState, useEffect, useRef } from 'react';
import { initSocket, getSocket, disconnectSocket, randomHex } from '../services/socket';
import { api, mediaUrl } from '../services/api';
import { getServerUrl } from '../services/serverConfig';
import { WifiOff, Loader2, Tv } from 'lucide-react';
import OnboardingTutorial from '../components/OnboardingTutorial';
import QrCode from '../components/QrCode';

// Help generate friendly 6-char code
function generatePairingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous chars like O, 0, I, 1
  let result = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(bytes[i] % chars.length); // 32 chars: no modulo bias
  }
  return result;
}

// Pseudo-UUID helper
function generateUUID() {
  return 'scr-' + randomHex(12);
}

export default function TVPlayer() {
  // Device pairing details
  const [screenId, setScreenId] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [screenName, setScreenName] = useState('Écran Kiosque');

  // Store branding
  const [storeName, setStoreName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // UI flags
  const [showTutorial, setShowTutorial] = useState(() => {
    const shown = localStorage.getItem('onboarding_shown') === '1';
    return !shown;
  });

  // Connection & Association status
  const [isOnline, setIsOnline] = useState(false);
  const [isAssociated, setIsAssociated] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initialisation...');

  // Playback items
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [slides, setSlides] = useState([]); // Array of slide objects (with local blob URLs)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [transitionStyle, setTransitionStyle] = useState('fade');
  const [randomOrder, setRandomOrder] = useState(false);

  // References for timeouts & video element
  const slideTimeoutRef = useRef(null);
  const videoRef = useRef(null);
  const socketRef = useRef(null);

  // Fetch store settings & tutorial flag on mount
  useEffect(() => {
    // Load store branding
    api.get('/settings')
      .then(data => {
        setStoreName(data.store_name || '');
        setLogoUrl(data.logo || '');
      })
      .catch(err => console.error('Failed to load settings:', err));


    // Clear any stale association flag – we only trust server events
    localStorage.removeItem('is_associated');
    setIsAssociated(false);
  }, []);



  // Setup pairing variables
  useEffect(() => {
    let id = localStorage.getItem('screen_id');
    let code = localStorage.getItem('pairing_code');

    if (!id) {
      id = generateUUID();
      localStorage.setItem('screen_id', id);
    }
    if (!code) {
      code = generatePairingCode();
      localStorage.setItem('pairing_code', code);
    }

    setScreenId(id);
    setPairingCode(code);

    // Initial fallback check: load playlist details cached from previous offline sessions
    const cachedPlaylist = localStorage.getItem('cached_playlist');
    const cachedSlides = localStorage.getItem('cached_slides');
    // const associated = localStorage.getItem('is_associated') === '1';
    // Do not pre-set association; wait for server event

    if (cachedPlaylist && cachedSlides) {
      try {
        const pl = JSON.parse(cachedPlaylist);
        const sl = JSON.parse(cachedSlides);
        setActivePlaylist(pl);
        setTransitionStyle(pl.transition || 'fade');
        setRandomOrder(pl.random_order === 1);
        
        // Attempt to load media from Cache Storage API
        loadSlidesFromCache(sl, pl);
        setStatusMessage('Lecture en mode hors ligne...');
      } catch (err) {
        console.error('Failed to parse offline cache data:', err);
      }
    } else {
      setStatusMessage('En attente de connexion...');
    }
  }, []);

  // Socket Connection and heartbeat loop
  useEffect(() => {
    if (!screenId) return;

    setStatusMessage('Connexion au serveur...');
    const socket = initSocket('screen', screenId);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsOnline(true);
      setStatusMessage(''); // clear loading message
      // Register device immediately
      socket.emit('screen:register', {
        id: screenId,
        code: pairingCode,
        name: screenName
      });
    });

    socket.on('disconnect', () => {
      setIsOnline(false);
    });

    // The server refuses new unpaired screens when too many are already waiting
    socket.on('screen:error', (e) => {
      if (e?.code === 'too_many_pending_screens') {
        setStatusMessage("Trop d'écrans en attente sur ce serveur. Réessayez plus tard.");
      }
    });

    // Association event
    socket.on('screen:associated', async (data) => {
      if (!data.name) {
        // Un-associated
        setIsAssociated(false);
        localStorage.removeItem('is_associated');
        setActivePlaylist(null);
        setSlides([]);
        localStorage.removeItem('cached_playlist');
        localStorage.removeItem('cached_slides');
        setStatusMessage('Écran non associé');
        return;
      }

      setIsAssociated(true);
      setScreenName(data.name);
      localStorage.setItem('is_associated', '1');

      if (data.playlistDetails) {
        await processAndCachePlaylist(data.playlistDetails);
      } else {
        setActivePlaylist(null);
        setSlides([]);
        setStatusMessage('En attente de contenu...');
      }
    });

    // Playlist update event
    socket.on('screen:update_playlist', async (data) => {
      if (data.playlistDetails) {
        await processAndCachePlaylist(data.playlistDetails);
      } else {
        setActivePlaylist(null);
        setSlides([]);
        setStatusMessage('En attente de contenu...');
      }
    });

    // Force synchronize command (Clear cache and refresh)
    socket.on('screen:force_sync', async () => {
      console.log('Force Sync command received. Clearing cache...');
      try {
        const cache = await caches.open('media-cache');
        const keys = await cache.keys();
        for (const request of keys) {
          await cache.delete(request);
        }
        window.location.reload();
      } catch (e) {
        console.error(e);
        window.location.reload();
      }
    });

    // Setup Heartbeat loop (every 10 seconds)
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('screen:heartbeat', { id: screenId });
      }
    }, 10000);

    return () => {
      clearInterval(heartbeatInterval);
      disconnectSocket();
    };
  }, [screenId, pairingCode]);

  // Load slides into memory using local Cache blob URLs
  async function loadSlidesFromCache(slidesSchema, playlist) {
    try {
      const cache = await caches.open('media-cache');
      const loadedSlides = [];

      for (const item of slidesSchema) {
        const fullUrl = mediaUrl(item.filepath);
        const match = await cache.match(fullUrl);
        
        if (match) {
          const blob = await match.blob();
          const blobUrl = URL.createObjectURL(blob);
          loadedSlides.push({
            ...item,
            localUrl: blobUrl
          });
        } else {
          // If not in cache, fallback to live network URL
          loadedSlides.push({
            ...item,
            localUrl: fullUrl
          });
        }
      }

      setSlides(loadedSlides);
      setCurrentSlideIndex(0);
      setStatusMessage('');
    } catch (err) {
      console.error('Failed to load slides from cache:', err);
    }
  }

  // Download files and sync to Cache Storage
  async function processAndCachePlaylist(playlist) {
    setStatusMessage('Téléchargement des médias en cours...');
    setActivePlaylist(playlist);
    setTransitionStyle(playlist.transition || 'fade');
    setRandomOrder(playlist.random_order === 1);

    const mediaList = playlist.media || [];

    if (mediaList.length === 0) {
      setSlides([]);
      setStatusMessage('La playlist affectée est vide.');
      localStorage.removeItem('cached_playlist');
      localStorage.removeItem('cached_slides');
      return;
    }

    try {
      const cache = await caches.open('media-cache');
      const loadedSlides = [];

      // Download and cache each media file
      for (const item of mediaList) {
        const fullUrl = mediaUrl(item.filepath);
        
        // Try to fetch and cache if not already in cache
        try {
          const match = await cache.match(fullUrl);
          if (!match) {
            console.log(`Caching file: ${item.filename}`);
            await cache.add(fullUrl);
          }
        } catch (e) {
          console.error(`Failed to cache ${item.filename}:`, e);
        }

        // Generate Blob URL
        const cachedRes = await cache.match(fullUrl);
        let localUrl = fullUrl;
        if (cachedRes) {
          const blob = await cachedRes.blob();
          localUrl = URL.createObjectURL(blob);
        }

        loadedSlides.push({
          ...item,
          localUrl
        });
      }

      // Save schema to local storage for offline booting
      localStorage.setItem('cached_playlist', JSON.stringify(playlist));
      localStorage.setItem('cached_slides', JSON.stringify(mediaList));

      setSlides(loadedSlides);
      setCurrentSlideIndex(0);
      setStatusMessage('');
    } catch (error) {
      console.error('Failed to process/cache playlist:', error);
      // Fallback: render using normal network paths
      const fallbackSlides = mediaList.map(item => ({
        ...item,
        localUrl: mediaUrl(item.filepath)
      }));
      setSlides(fallbackSlides);
      setCurrentSlideIndex(0);
      setStatusMessage('');
    }
  }

  // Playback Loop Runner
  useEffect(() => {
    if (slides.length === 0) return;

    // Clear any active playback timer
    if (slideTimeoutRef.current) {
      clearTimeout(slideTimeoutRef.current);
    }

    const currentSlide = slides[currentSlideIndex];
    if (!currentSlide) return;

    // Report current state for Admin Live Preview
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('screen:preview_slide', {
        id: screenId,
        mediaId: currentSlide.id,
        index: currentSlideIndex,
        total: slides.length,
        progress: 0
      });
    }

    // Video Slide vs Image Slide
    if (currentSlide.mime_type.startsWith('video/')) {
      // For videos, let it play. Video ending trigger is bound to <video onEnded={...} />
      // If video loading fails or gets stuck, add a safety timeout (e.g. 30 seconds max)
      slideTimeoutRef.current = setTimeout(() => {
        advanceSlide();
      }, 45000); // 45s safety net
    } else {
      // Image Slide: wait for duration
      const duration = (currentSlide.custom_duration || activePlaylist?.duration || 5) * 1000;
      slideTimeoutRef.current = setTimeout(() => {
        advanceSlide();
      }, duration);
    }

    return () => {
      if (slideTimeoutRef.current) {
        clearTimeout(slideTimeoutRef.current);
      }
    };
  }, [slides, currentSlideIndex]);

  const advanceSlide = () => {
    if (slides.length <= 1) return;

    if (randomOrder) {
      const nextIndex = Math.floor(Math.random() * slides.length);
      // Ensure we don't pick the same slide if possible
      if (nextIndex === currentSlideIndex) {
        setCurrentSlideIndex((currentSlideIndex + 1) % slides.length);
      } else {
        setCurrentSlideIndex(nextIndex);
      }
    } else {
      setCurrentSlideIndex(prev => (prev + 1) % slides.length);
    }
  };

  const getTransitionClass = () => {
    switch (transitionStyle) {
      case 'zoom':
        return 'animate-zoom-in';
      case 'slide':
        return 'animate-slide-in';
      case 'fade':
      default:
        return 'animate-fade-in';
    }
  };

  // 1. Loading State (Init, connecting)
  if (statusMessage) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-slate-100 z-50 p-6 select-none">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold tracking-wide">{statusMessage}</h2>
        
        {/* Offline notice */}
        {!isOnline && (
          <div className="absolute bottom-6 flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-900 border border-slate-800 px-4 py-2 rounded-full">
            <WifiOff className="w-4 h-4 text-amber-500" />
            Mode déconnecté. Recherche du réseau...
          </div>
        )}
      </div>
    );
  }

  // 2. Kiosk Unassociated State (with optional onboarding)
  if (!isAssociated) {
    return (
      <>
        {showTutorial && (
          <OnboardingTutorial
            storeName={storeName}
            logoUrl={logoUrl}
            pairingCode={pairingCode}
            onClose={() => setShowTutorial(false)}
          />
        )}
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-center text-slate-100 z-50 p-6 select-none font-sans">
          <div className="max-w-md w-full glass-card border-slate-800 rounded-3xl p-8 space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto text-brand-500">
              <Tv className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Écran non associé</h2>
            <p className="text-sm text-slate-400">
              Associez cet écran depuis l'administration du magasin en saisissant le code ci-dessous :
            </p>
            <div className="py-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 font-mono text-4xl font-extrabold tracking-[0.3em] text-white pl-4">
              {pairingCode}
            </div>
            <p className="text-xs text-slate-500">
              Identifiant : {screenId.substring(0, 12)}...
            </p>
            {/* Persistent QR code and admin link */}
            <div className="flex flex-col items-center mt-4">
              <QrCode value={`code=${pairingCode}`} alt="QR code de couplage" className="w-48 h-48 mb-2" />
              <span className="text-brand-500 font-mono">
                {getServerUrl()}
              </span>
            </div>
          </div>
          {/* Network indicator */}
          {!isOnline && (
            <div className="absolute bottom-6 flex items-center gap-1.5 text-xs text-amber-500 font-semibold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <WifiOff className="w-3.5 h-3.5" />
              Réseau local inaccessible
            </div>
          )}
        </div>
      </>
    );
  }

  // 3. Playback State
  const activeSlide = slides[currentSlideIndex];
  if (!activeSlide) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-slate-150 z-50 select-none">
        <Tv className="w-12 h-12 text-slate-700 animate-pulse mb-3" />
        <h2 className="text-sm font-semibold tracking-wide">Connecté</h2>
        <p className="text-xs text-slate-500 mt-1">En attente de contenu...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-800 overflow-hidden z-50 select-none cursor-none w-screen h-screen">
      {/* Admin access overlay */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-xl p-2 flex flex-col items-center">
        <QrCode value={`code=${pairingCode}`} size={160} alt="QR de couplage" className="w-24 h-24 mb-1" />
        <span className="text-brand-500 text-xs font-mono">{getServerUrl().replace(/^https?:\/\//, '')}</span>
      </div>
      {/* Slide Container */}
      <div key={currentSlideIndex} className={`w-full h-full ${getTransitionClass()}`}>
        {activeSlide.mime_type.startsWith('video/') ? (
          <video
            ref={videoRef}
            src={activeSlide.localUrl}
            autoPlay
            muted // Muted to allow autoplay reliably in all TV browsers
            onEnded={advanceSlide}
            onError={advanceSlide} // skip on error
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={activeSlide.localUrl}
            alt=""
            onError={advanceSlide} // skip on error
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Offline Badge Overlay */}
      {!isOnline && (
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/75 backdrop-blur-md border border-slate-800 text-[10px] font-bold text-amber-400 uppercase tracking-widest px-3.5 py-2 rounded-full shadow-lg">
          <WifiOff className="w-3.5 h-3.5 text-amber-500" />
          Mode hors ligne
        </div>
      )}
    </div>
  );
}
