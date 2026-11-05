import { useState } from 'react';
import { Film, ImageOff } from 'lucide-react';
import { mediaUrl } from '../services/api';
import { cn } from '../utils/cn';

/**
 * Thumbnail for an image or video from the media library. Videos show their first frame.
 * Falls back to an icon if the file cannot be loaded.
 */
export default function MediaThumb({ media, className, imgClassName, alt = '' }) {
  const isVideo = media?.mime_type?.startsWith('video/');
  const src = media?.filepath ? mediaUrl(media.filepath) : '';
  const [brokenSrc, setBrokenSrc] = useState(null);
  const broken = brokenSrc === src; // a different file gets a fresh chance to load

  return (
    <div className={cn('relative overflow-hidden bg-surface-3', className)}>
      {!media || broken || !src ? (
        <div className="grid h-full w-full place-items-center text-subtle">
          {isVideo ? <Film className="size-1/3 min-h-4 min-w-4" /> : <ImageOff className="size-1/3 min-h-4 min-w-4" />}
        </div>
      ) : isVideo ? (
        <video
          src={`${src}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          onError={() => setBrokenSrc(src)}
          className={cn('h-full w-full object-cover', imgClassName)}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setBrokenSrc(src)}
          className={cn('h-full w-full object-cover', imgClassName)}
        />
      )}
    </div>
  );
}

/** First media of a playlist as found in the library, or null. */
// eslint-disable-next-line react-refresh/only-export-components
export function playlistCover(playlist, library) {
  const items = playlist?.items;
  if (!Array.isArray(items) || !items.length) return null;
  const first = [...items].sort((a, b) => a.position - b.position)[0];
  return library.find((m) => String(m.id) === String(first.mediaId)) || null;
}

/** Up to `n` distinct media from a playlist (in order), for mosaics. */
// eslint-disable-next-line react-refresh/only-export-components
export function playlistCovers(playlist, library, n = 4) {
  const items = playlist?.items;
  if (!Array.isArray(items)) return [];
  const byId = new Map(library.map((m) => [String(m.id), m]));
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((i) => byId.get(String(i.mediaId)))
    .filter(Boolean)
    .slice(0, n);
}
