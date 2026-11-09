import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ListVideo, Loader2, Smartphone, Tv, WifiOff } from 'lucide-react';
import { initSocket, getSocket, disconnectSocket, randomHex } from '../services/socket';
import { api, mediaUrl } from '../services/api';
import { getServerUrl } from '../services/serverConfig';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import QrCode from '../components/QrCode';
import { LogoMark } from '../components/ui/Logo';
import { cn } from '../utils/cn';

const MEDIA_CACHE = 'media-cache';
const CACHE_AVAILABLE = typeof caches !== 'undefined'; // only in secure contexts (HTTPS / localhost)

// Friendly 6-char pairing code (no ambiguous characters like O/0/I/1)
function generatePairingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < 6; i++) result += chars.charAt(bytes[i] % chars.length); // 32 chars: no modulo bias
  return result;
}

const generateScreenId = () => 'scr-' + randomHex(12);

/** Stable fingerprint of a playlist so identical re-sends (reconnections) don't restart playback. */
function playlistSignature(p) {
  return JSON.stringify([
    p.id, p.transition, p.duration, p.random_order,
    (p.media || []).map((m) => [m.id, m.filepath, m.custom_duration]),
  ]);
}

/* ═══════════════════════════ Views (TV-sized, no heavy effects) ═══════════════════════════ */

const TV_BG = {
  backgroundImage:
    'radial-gradient(60% 55% at 12% 0%, rgba(106,92,246,.28), transparent 70%),' +
    'radial-gradient(55% 50% at 100% 100%, rgba(217,70,239,.20), transparent 70%)',
};

function Shell({ children, className }) {
  return (
    <div data-theme="dark" style={TV_BG} className={cn('fixed inset-0 z-50 select-none overflow-hidden bg-[#06070c] text-fg', className)}>
      {children}
    </div>
  );
}

function Brand({ storeName, logoUrl, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  const big = size === 'lg';
  return (
    <div className="flex items-center gap-4">
      {logoUrl && !broken ? (
        <img src={mediaUrl(logoUrl)} alt="" onError={() => setBroken(true)} className={cn('rounded-2xl bg-white/5 object-contain p-1.5', big ? 'size-20' : 'size-12')} />
      ) : (
        <LogoMark className={big ? 'size-20' : 'size-12'} />
      )}
      <div className="leading-tight">
        <p className={cn('font-display font-extrabold tracking-tight', big ? 'text-4xl' : 'text-2xl')}>{storeName || 'ImageScreen'}</p>
        <p className={cn('font-medium text-muted', big ? 'text-lg' : 'text-sm')}>Affichage dynamique</p>
      </div>
    </div>
  );
}

function StatusChip({ online, children }) {
  return (
    <span className={cn('inline-flex items-center gap-3 rounded-full border px-5 py-2.5 text-base font-semibold', online ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-300')}>
      {online ? <span className="live-dot" /> : <WifiOff className="size-5" />}
      {children}
    </span>
  );
}

function Splash({ storeName, logoUrl, message, online }) {
  return (
    <Shell className="grid place-items-center">
      <div className="flex flex-col items-center gap-10 text-center">
        <Brand storeName={storeName} logoUrl={logoUrl} size="lg" />
        <div className="flex items-center gap-4 text-xl font-semibold text-muted">
          <Loader2 className="size-7 animate-spin text-brand" />
          {message}
        </div>
      </div>
      {!online && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <StatusChip online={false}>Recherche du réseau…</StatusChip>
        </div>
      )}
    </Shell>
  );
}

// Videos above this size are streamed from the server instead of being loaded into the TV's
// memory (a multi-GB file would crash the device). Images and small videos are kept offline.
const CACHE_MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const isCacheable = (item) => !String(item.mime_type || '').startsWith('video/') || Number(item.size || 0) <= CACHE_MAX_VIDEO_BYTES;

function PairingView({ code, screenId, storeName, logoUrl, online }) {
  const server = getServerUrl();
  const qrTarget = `${server}/screens?code=${code}`;
  return (
    <Shell>
      <div className="relative z-10 mx-auto grid h-full max-w-[1800px] items-center gap-[clamp(1.5rem,4vw,5rem)] px-[clamp(1.25rem,5vw,6rem)] py-[clamp(1.25rem,4vh,4rem)] lg:grid-cols-[1.05fr_1fr]">
        {/* Left: welcome + steps */}
        <div className="flex flex-col justify-center gap-[clamp(1.5rem,5vh,3.5rem)]">
          <Brand storeName={storeName} logoUrl={logoUrl} size="lg" />
          <div>
            <h1 className="font-display text-[clamp(2rem,4.4vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight">
              Associons cet écran<span className="text-gradient"> en 3 étapes</span>
            </h1>
          </div>
          <ol className="space-y-[clamp(0.75rem,2.2vh,1.5rem)] text-[clamp(1rem,1.6vw,1.6rem)]">
            {[
              <>Sur un ordinateur ou un téléphone, ouvrez :<b className="mt-2 block w-fit max-w-full break-all rounded-xl bg-white/[0.07] px-4 py-1.5 font-mono !text-brand ring-1 ring-white/10">{server}</b></>,
              <>Connectez-vous, puis allez dans <b>Écrans</b></>,
              <>Cliquez sur <b>Associer un écran</b> et saisissez ce code</>,
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-5">
                <span className="grid size-[clamp(2rem,3vw,3.25rem)] shrink-0 place-items-center rounded-2xl bg-white/8 font-display text-[clamp(1rem,1.6vw,1.6rem)] font-extrabold text-brand ring-1 ring-white/10">{i + 1}</span>
                <span className="pt-[0.2em] leading-snug text-muted [&_b]:font-semibold [&_b]:text-fg">{text}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Right: code + QR */}
        <div className="flex flex-col items-center gap-[clamp(1rem,3vh,2rem)]">
          <div className="w-full max-w-[44rem] rounded-[2rem] border border-white/10 bg-white/[0.04] p-[clamp(1.25rem,3vw,3rem)] text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
            <p className="text-[clamp(0.75rem,1vw,1rem)] font-bold uppercase tracking-[0.22em] text-subtle">Code d’association</p>
            <div className="mt-[clamp(1rem,2.5vh,1.75rem)] flex justify-center gap-[clamp(0.35rem,0.9vw,0.9rem)]" aria-label={`Code ${code.split('').join(' ')}`}>
              {code.split('').map((ch, i) => (
                <span
                  key={i}
                  className="grid aspect-[3/4] w-[clamp(2.4rem,5.6vw,6.2rem)] place-items-center rounded-[clamp(0.6rem,1.2vw,1.4rem)] bg-gradient-to-b from-white/[0.12] to-white/[0.04] font-mono text-[clamp(1.8rem,4.4vw,4.8rem)] font-extrabold text-white ring-1 ring-white/15"
                >
                  {ch}
                </span>
              ))}
            </div>
            <div className="mt-[clamp(1.25rem,3vh,2.25rem)] flex items-center justify-center gap-[clamp(1rem,2vw,2rem)] border-t border-white/10 pt-[clamp(1.25rem,3vh,2.25rem)]">
              <QrCode value={qrTarget} size={320} alt="QR code d’association" className="size-[clamp(6rem,11vw,12rem)] shrink-0" />
              <div className="max-w-[16rem] text-left">
                <p className="flex items-center gap-2 text-[clamp(0.9rem,1.3vw,1.3rem)] font-bold"><Smartphone className="size-[1.2em] text-brand" /> Depuis votre téléphone</p>
                <p className="mt-1.5 text-[clamp(0.8rem,1.1vw,1.1rem)] leading-snug text-muted">Scannez ce QR code pour ouvrir l’association directement.</p>
              </div>
            </div>
          </div>
          <StatusChip online={online}>{online ? 'Connecté au serveur — en attente d’association' : 'Serveur injoignable — nouvelle tentative…'}</StatusChip>
          <p className="font-mono text-sm text-subtle">ID {screenId.slice(0, 14)}…</p>
        </div>
      </div>
    </Shell>
  );
}

function WaitingView({ screenName, storeName, logoUrl, message, online }) {
  return (
    <Shell className="grid place-items-center">
      <div className="flex max-w-3xl flex-col items-center gap-9 px-8 text-center">
        <Brand storeName={storeName} logoUrl={logoUrl} size="lg" />
        <div className="grid size-28 place-items-center rounded-[2rem] bg-white/[0.06] ring-1 ring-white/10">
          {message ? <Loader2 className="size-12 animate-spin text-brand" /> : <ListVideo className="size-12 text-brand" />}
        </div>
        <div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight">{screenName}</h1>
          <p className="mt-4 flex items-center justify-center gap-3 text-2xl text-muted">
            {message || 'Connecté — en attente de contenu'}
          </p>
        </div>
        <StatusChip online={online}>{online ? 'En ligne' : 'Hors ligne — lecture locale'}</StatusChip>
      </div>
    </Shell>
  );
}

/* ═══════════════════════════ Player ═══════════════════════════ */

export default function TVPlayer() {
  useDocumentTitle('Lecteur TV');

  // Device identity
  const [screenId, setScreenId] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [screenName, setScreenName] = useState('Écran Kiosque');

  // Store branding
  const [storeName, setStoreName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Connection & association
  const [isOnline, setIsOnline] = useState(false);
  const [isAssociated, setIsAssociated] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Playback
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [slides, setSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [transitionStyle, setTransitionStyle] = useState('fade');
  const [randomOrder, setRandomOrder] = useState(false);
  const [hud, setHud] = useState(false);

  const slideTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const blobUrlsRef = useRef([]);
  const signatureRef = useRef('');
  const slidesLenRef = useRef(0);
  const randomRef = useRef(false);
  const screenNameRef = useRef(screenName);
  const hudTimer = useRef(null);

  useEffect(() => { slidesLenRef.current = slides.length; }, [slides]);
  useEffect(() => { randomRef.current = randomOrder; }, [randomOrder]);
  useEffect(() => { screenNameRef.current = screenName; }, [screenName]);

  const replaceSlides = useCallback((next) => {
    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    blobUrlsRef.current = next.filter((s) => s.localUrl?.startsWith('blob:')).map((s) => s.localUrl);
    setSlides(next);
    setCurrentSlideIndex(0);
  }, []);

  useEffect(() => () => blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const clearPlayback = useCallback(() => {
    signatureRef.current = '';
    replaceSlides([]);
    setActivePlaylist(null);
    localStorage.removeItem('cached_playlist');
    localStorage.removeItem('cached_slides');
  }, [replaceSlides]);

  /* Slides from Cache Storage (offline boot) */
  const loadSlidesFromCache = useCallback(async (list) => {
    const loaded = [];
    let cache = null;
    try { if (CACHE_AVAILABLE) cache = await caches.open(MEDIA_CACHE); } catch { cache = null; }
    for (const item of list) {
      const url = mediaUrl(item.filepath);
      let localUrl = url;
      try {
        const match = cache && isCacheable(item) && (await cache.match(url));
        if (match) localUrl = URL.createObjectURL(await match.blob());
      } catch { /* fall back to network URL */ }
      loaded.push({ ...item, localUrl });
    }
    replaceSlides(loaded);
  }, [replaceSlides]);

  /* Boot: identity, branding, offline resume */
  useEffect(() => {
    let id = localStorage.getItem('screen_id');
    let code = localStorage.getItem('pairing_code');
    if (!id) { id = generateScreenId(); localStorage.setItem('screen_id', id); }
    if (!code) { code = generatePairingCode(); localStorage.setItem('pairing_code', code); }
    setScreenId(id);
    setPairingCode(code);

    // Branding of the store this screen belongs to: the screen id tells the server which store
    api.get(`/settings?screenId=${encodeURIComponent(id)}`)
      .then((d) => { setStoreName(d.store_name || ''); setLogoUrl(d.logo || ''); })
      .catch((err) => console.error('Failed to load settings:', err));

    // Resume from the local cache right away (the server confirms or corrects once connected)
    const wasAssociated = localStorage.getItem('is_associated') === '1';
    const cachedPlaylist = localStorage.getItem('cached_playlist');
    const cachedSlides = localStorage.getItem('cached_slides');
    if (wasAssociated) {
      setIsAssociated(true);
      setScreenName(localStorage.getItem('screen_name') || 'Écran');
    }
    if (wasAssociated && cachedPlaylist && cachedSlides) {
      try {
        const pl = JSON.parse(cachedPlaylist);
        const sl = JSON.parse(cachedSlides);
        setActivePlaylist(pl);
        setTransitionStyle(pl.transition || 'fade');
        setRandomOrder(Boolean(pl.random_order));
        signatureRef.current = playlistSignature({ ...pl, media: sl });
        loadSlidesFromCache(sl);
      } catch (err) {
        console.error('Failed to parse offline cache data:', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Download media into Cache Storage, then play */
  const processAndCachePlaylist = useCallback(async (playlist) => {
    const mediaList = playlist.media || [];
    const signature = playlistSignature(playlist);
    if (signature === signatureRef.current && slidesLenRef.current > 0) return; // identical re-send: keep playing

    setActivePlaylist(playlist);
    setTransitionStyle(playlist.transition || 'fade');
    setRandomOrder(Boolean(playlist.random_order));

    if (mediaList.length === 0) {
      signatureRef.current = signature;
      replaceSlides([]);
      setSyncMessage('');
      localStorage.removeItem('cached_playlist');
      localStorage.removeItem('cached_slides');
      return;
    }

    // Keep the current slides on screen while updating; only show a message on first load
    if (slidesLenRef.current === 0) setSyncMessage('Téléchargement des médias…');

    let cache = null;
    try { if (CACHE_AVAILABLE) cache = await caches.open(MEDIA_CACHE); } catch { cache = null; }

    const loaded = [];
    for (const item of mediaList) {
      const url = mediaUrl(item.filepath);
      let localUrl = url;
      if (cache && isCacheable(item)) {
        try {
          if (!(await cache.match(url))) await cache.add(url);
          const cached = await cache.match(url);
          if (cached) localUrl = URL.createObjectURL(await cached.blob());
        } catch (e) {
          console.error(`Failed to cache ${item.filename}:`, e);
        }
      }
      loaded.push({ ...item, localUrl });
    }

    try {
      localStorage.setItem('cached_playlist', JSON.stringify(playlist));
      localStorage.setItem('cached_slides', JSON.stringify(mediaList));
    } catch (e) {
      console.warn('Could not persist playlist for offline use:', e);
    }

    signatureRef.current = signature;
    replaceSlides(loaded);
    setSyncMessage('');
  }, [replaceSlides]);

  /* Socket + heartbeat */
  useEffect(() => {
    if (!screenId || !pairingCode) return undefined;

    const socket = initSocket('screen', screenId);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsOnline(true);
      socket.emit('screen:register', { id: screenId, code: pairingCode, name: screenNameRef.current });
    });
    socket.on('disconnect', () => setIsOnline(false));
    socket.on('connect_error', () => setIsOnline(false));

    // The server refuses new unpaired screens when too many are already waiting
    socket.on('screen:error', (e) => {
      if (e?.code === 'too_many_pending_screens') setSyncMessage('Trop d’écrans en attente sur ce serveur. Réessayez plus tard.');
    });

    // Authoritative association state (sent after every register, and on association changes)
    socket.on('screen:associated', async (data) => {
      if (!data?.name) {
        // Not (or no longer) associated: back to the pairing screen
        setIsAssociated(false);
        localStorage.removeItem('is_associated');
        localStorage.removeItem('screen_name');
        setSyncMessage('');
        clearPlayback();
        return;
      }
      setIsAssociated(true);
      setScreenName(data.name);
      localStorage.setItem('is_associated', '1');
      localStorage.setItem('screen_name', data.name);

      if (data.playlistDetails) await processAndCachePlaylist(data.playlistDetails);
      else { clearPlayback(); setSyncMessage(''); }
    });

    socket.on('screen:update_playlist', async (data) => {
      if (data?.playlistDetails) await processAndCachePlaylist(data.playlistDetails);
      else { clearPlayback(); setSyncMessage(''); }
    });

    // Force synchronize: clear the media cache and reload
    socket.on('screen:force_sync', async () => {
      try {
        if (CACHE_AVAILABLE) {
          const cache = await caches.open(MEDIA_CACHE);
          for (const request of await cache.keys()) await cache.delete(request);
        }
      } catch (e) {
        console.error(e);
      }
      window.location.reload();
    });

    const heartbeat = setInterval(() => {
      if (socket.connected) socket.emit('screen:heartbeat', { id: screenId });
    }, 10000);

    return () => {
      clearInterval(heartbeat);
      disconnectSocket();
    };
  }, [screenId, pairingCode, processAndCachePlaylist, clearPlayback]);

  /* Playback loop */
  const advanceSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => {
      const len = slidesLenRef.current;
      if (len <= 1) return prev;
      if (randomRef.current) {
        const n = Math.floor(Math.random() * len);
        return n === prev ? (prev + 1) % len : n;
      }
      return (prev + 1) % len;
    });
  }, []);

  useEffect(() => {
    clearTimeout(slideTimeoutRef.current);
    if (slides.length === 0) return undefined;
    const slide = slides[currentSlideIndex];
    if (!slide) return undefined;

    // Report the current slide for the admin's live preview
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('screen:preview_slide', { id: screenId, mediaId: slide.id, index: currentSlideIndex, total: slides.length, progress: 0 });
    }

    const isVideo = slide.mime_type.startsWith('video/');
    // Videos advance on `ended`; the timeout is a safety net for stuck/broken files
    const ms = isVideo ? 45000 : (slide.custom_duration || activePlaylist?.duration || 5) * 1000;
    slideTimeoutRef.current = setTimeout(advanceSlide, ms);
    return () => clearTimeout(slideTimeoutRef.current);
  }, [slides, currentSlideIndex, activePlaylist, advanceSlide, screenId]);

  /* Info overlay on remote-control / touch input */
  useEffect(() => {
    const show = () => {
      setHud(true);
      clearTimeout(hudTimer.current);
      hudTimer.current = setTimeout(() => setHud(false), 7000);
    };
    window.addEventListener('keydown', show);
    window.addEventListener('pointerdown', show);
    return () => {
      window.removeEventListener('keydown', show);
      window.removeEventListener('pointerdown', show);
      clearTimeout(hudTimer.current);
    };
  }, []);

  /* ── Render ─────────────────────────────────────────────────────────── */
  if (!screenId) return <Splash storeName={storeName} logoUrl={logoUrl} message="Initialisation…" online={isOnline} />;

  if (!isAssociated) {
    if (syncMessage) return <Splash storeName={storeName} logoUrl={logoUrl} message={syncMessage} online={isOnline} />;
    return <PairingView code={pairingCode} screenId={screenId} storeName={storeName} logoUrl={logoUrl} online={isOnline} />;
  }

  const slide = slides[currentSlideIndex];
  if (!slide) {
    return <WaitingView screenName={screenName} storeName={storeName} logoUrl={logoUrl} message={syncMessage} online={isOnline} />;
  }

  const transitionClass = { zoom: 'animate-zoom-in', slide: 'animate-slide-in' }[transitionStyle] || 'animate-fade-in';

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen cursor-none select-none overflow-hidden bg-black">
      <div key={currentSlideIndex} className={cn('h-full w-full', transitionClass)}>
        {slide.mime_type.startsWith('video/') ? (
          <video
            src={slide.localUrl}
            autoPlay
            muted // muted so autoplay works reliably on every TV browser
            playsInline
            loop={slides.length === 1}
            onEnded={advanceSlide}
            onError={advanceSlide}
            className="h-full w-full object-cover"
          />
        ) : (
          <img src={slide.localUrl} alt="" onError={advanceSlide} className="h-full w-full object-cover" />
        )}
      </div>

      {!isOnline && (
        <div data-theme="dark" className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-300">
          <WifiOff className="size-4" /> Mode hors ligne
        </div>
      )}

      {/* Device info — appears for a few seconds when a button is pressed */}
      <div
        data-theme="dark"
        aria-hidden={!hud}
        className={cn(
          'absolute bottom-6 left-6 max-w-[min(34rem,90vw)] rounded-3xl border border-white/10 bg-black/80 p-5 text-fg shadow-2xl transition-all duration-300',
          hud ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        )}
      >
        <div className="flex items-center gap-4">
          {logoUrl ? <img src={mediaUrl(logoUrl)} alt="" className="size-12 rounded-xl bg-white/5 object-contain p-1" /> : <LogoMark className="size-12" />}
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-extrabold">{screenName}</p>
            <p className="flex items-center gap-2 truncate text-sm text-muted">
              <ListVideo className="size-4 shrink-0" /> {activePlaylist?.name || 'Aucune playlist'} · {currentSlideIndex + 1}/{slides.length}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/10 pt-3 text-xs text-muted">
          <span className={cn('inline-flex items-center gap-1.5 font-semibold', isOnline ? 'text-emerald-300' : 'text-amber-300')}>
            {isOnline ? <CheckCircle2 className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {isOnline ? 'Connecté' : 'Hors ligne'}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono"><Tv className="size-3.5" />{getServerUrl().replace(/^https?:\/\//, '')}</span>
        </div>
      </div>
    </div>
  );
}
