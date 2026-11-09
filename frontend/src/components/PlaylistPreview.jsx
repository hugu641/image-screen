import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipForward, Film } from 'lucide-react';
import { mediaUrl } from '../services/api';
import { cn } from '../utils/cn';

const TRANSITION_CLASS = { fade: 'animate-fade-in', zoom: 'animate-zoom-in', slide: 'animate-slide-in' };

/**
 * Plays the playlist exactly like the TV does (same duration + transition classes) so the user
 * can check the result before saving. `items` are media objects in playback order.
 */
export default function PlaylistPreview({ items, duration = 5, transition = 'fade', className }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef(null);

  const count = items.length;
  const safeIndex = count ? index % count : 0;
  const current = items[safeIndex];
  const isVideo = current?.mime_type?.startsWith('video/');

  const next = useCallback(() => setIndex((i) => (count ? (i + 1) % count : 0)), [count]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!playing || !current || count < 2) return undefined;
    // Videos advance on `ended`; keep a safety net so a broken file can't freeze the preview.
    const ms = isVideo ? 45000 : Math.max(1, duration) * 1000;
    timer.current = setTimeout(next, ms);
    return () => clearTimeout(timer.current);
  }, [playing, current, count, duration, isVideo, next, safeIndex]);

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line bg-black', className)}>
      <div className="relative aspect-video">
        {current ? (
          <div key={`${safeIndex}-${current.id}-${transition}`} className={cn('absolute inset-0', TRANSITION_CLASS[transition] || TRANSITION_CLASS.fade)}>
            {isVideo ? (
              <video
                src={mediaUrl(current.filepath)}
                muted
                autoPlay
                playsInline
                onEnded={next}
                className="h-full w-full object-cover"
              />
            ) : (
              <img src={mediaUrl(current.filepath)} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-slate-500">
            <div className="flex flex-col items-center gap-2"><Film className="size-8 opacity-50" />Ajoutez des médias pour voir l’aperçu</div>
          </div>
        )}

        {current && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
              <span className="rounded-lg bg-black/55 px-2.5 py-1 font-mono text-[11px] font-bold text-white backdrop-blur-md">
                {safeIndex + 1} / {count}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? 'Mettre en pause' : 'Lire'}
                  className="grid size-8 place-items-center rounded-lg bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75"
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={count < 2}
                  aria-label="Diapositive suivante"
                  className="grid size-8 place-items-center rounded-lg bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75 disabled:opacity-40"
                >
                  <SkipForward className="size-4" />
                </button>
              </div>
            </div>
            {playing && count > 1 && !isVideo && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                <div
                  key={`bar-${safeIndex}-${duration}`}
                  className="h-full origin-left bg-brand-gradient"
                  style={{ animation: `progress ${Math.max(1, duration)}s linear forwards` }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
