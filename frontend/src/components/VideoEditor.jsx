import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Scissors, RotateCcw } from 'lucide-react';
import { api, mediaUrl } from '../services/api';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import { formatDuration } from '../utils/format';

const STEP = 0.1;
const MIN_LENGTH = 0.5;

/** mm:ss.d — precise enough to cut a video. */
function clock(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(1).padStart(4, '0');
  return `${String(m).padStart(2, '0')}:${rest}`;
}

/**
 * Non-destructive video editor: choose the start and end of the excerpt to play.
 * The file is never modified; the excerpt is what the TV plays.
 */
export default function VideoEditor({ item, onClose, onDone }) {
  const toast = useToast();
  const video = useRef(null);
  const [duration, setDuration] = useState(item.duration || 0);
  const [current, setCurrent] = useState(0);
  const [start, setStart] = useState(item.trim_start || 0);
  const [end, setEnd] = useState(item.trim_end || item.duration || 0);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const src = useMemo(() => mediaUrl(item.filepath), [item.filepath]);
  const length = Math.max(0, end - start);

  // Video metadata gives the real duration
  const onMeta = () => {
    const d = video.current?.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    setDuration(d);
    if (!item.trim_end) setEnd(d);
    video.current.currentTime = start;
  };

  // Preview of the excerpt: play from start, stop at end
  const onTime = () => {
    const v = video.current;
    if (!v) return;
    setCurrent(v.currentTime);
    if (previewing && v.currentTime >= end) {
      v.pause();
      setPreviewing(false);
      v.currentTime = start;
    }
  };

  useEffect(() => {
    if (previewing && video.current) video.current.currentTime = start;
  }, [previewing, start]);

  const setStartValue = (value) => {
    const v = Math.min(Number(value), end - MIN_LENGTH);
    setStart(Math.max(0, Math.round(v * 10) / 10));
  };
  const setEndValue = (value) => {
    const v = Math.max(Number(value), start + MIN_LENGTH);
    setEnd(Math.min(duration, Math.round(v * 10) / 10));
  };

  const playExcerpt = () => {
    const v = video.current;
    if (!v) return;
    v.currentTime = start;
    setPreviewing(true);
    v.play().catch(() => setPreviewing(false));
  };

  const reset = () => {
    setStart(0);
    setEnd(duration);
  };

  const isFullLength = () => start < 0.05 && end >= duration - 0.05;

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      await api.put(`/media/${item.id}/trim`, {
        start,
        end: Math.min(end, duration),
        duration,
      });
      toast.success(isFullLength() ? 'Vidéo complète.' : `Extrait enregistré : ${formatDuration(length)}.`);
      onDone();
    } catch (err) {
      setError(err.message || 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={Scissors}
      title="Monter la vidéo"
      description={`${item.original_name} — le fichier reste intact, seul l’extrait diffusé change.`}
      footer={
        <>
          <Button variant="ghost" icon={RotateCcw} onClick={reset}>Tout garder</Button>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={busy} onClick={save} disabled={!duration}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl bg-black">
          <video
            ref={video}
            src={src}
            preload="metadata"
            controls
            playsInline
            onLoadedMetadata={onMeta}
            onTimeUpdate={onTime}
            className="aspect-video w-full"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-mono text-muted">Position : {clock(current)} / {clock(duration)}</span>
          <span className="font-semibold">
            Extrait : {clock(start)} → {clock(end)} · {formatDuration(length)}
          </span>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 flex justify-between text-sm font-semibold"><span>Début de l’extrait</span><span className="font-mono">{clock(start)}</span></span>
            <input type="range" min={0} max={Math.max(0, duration)} step={STEP} value={start} disabled={!duration}
              onChange={(e) => setStartValue(e.target.value)} className="w-full accent-brand" aria-label="Début de l’extrait" />
          </label>
          <label className="block">
            <span className="mb-1 flex justify-between text-sm font-semibold"><span>Fin de l’extrait</span><span className="font-mono">{clock(end)}</span></span>
            <input type="range" min={0} max={Math.max(0, duration)} step={STEP} value={end} disabled={!duration}
              onChange={(e) => setEndValue(e.target.value)} className="w-full accent-brand" aria-label="Fin de l’extrait" />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setStart(Math.round(current * 10) / 10)} disabled={!duration || current >= end - MIN_LENGTH}>
            Début ici
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEnd(Math.round(current * 10) / 10)} disabled={!duration || current <= start + MIN_LENGTH}>
            Fin ici
          </Button>
          <Button size="sm" variant="secondary" icon={Play} onClick={playExcerpt} disabled={!duration || previewing}>
            Lire l’extrait
          </Button>
        </div>

        {error && <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <p className="text-xs text-subtle">Un extrait dure au moins 0,5 seconde. La télévision commencera la vidéo à « Début » et passera au média suivant à « Fin ».</p>
      </div>
    </Modal>
  );
}
