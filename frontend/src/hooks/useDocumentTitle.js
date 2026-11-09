import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ImageScreen` : 'ImageScreen — Affichage dynamique';
    return () => { document.title = previous; };
  }, [title]);
}
