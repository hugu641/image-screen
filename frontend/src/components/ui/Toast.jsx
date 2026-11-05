import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleCheck, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../utils/cn';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CircleCheck, ring: 'text-success bg-success/10' },
  danger: { icon: CircleAlert, ring: 'text-danger bg-danger/10' },
  warning: { icon: TriangleAlert, ring: 'text-warning bg-warning/10' },
  info: { icon: Info, ring: 'text-info bg-info/10' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((tone, message, options = {}) => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-3), { id, tone, message, title: options.title }]);
    const duration = options.duration ?? (tone === 'danger' ? 7000 : 4200);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('danger', m, o),
    warning: (m, o) => push('warning', m, o),
    info: (m, o) => push('info', m, o),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[200] flex flex-col items-center gap-2.5 px-4 lg:bottom-6 lg:items-end lg:px-6"
        >
          {toasts.map((t) => {
            const { icon: Icon, ring } = STYLES[t.tone];
            return (
              <div
                key={t.id}
                role={t.tone === 'danger' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm animate-toast items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 pr-2.5 shadow-pop"
              >
                <div className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl', ring)}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  {t.title && <p className="text-sm font-bold">{t.title}</p>}
                  <p className={cn('text-sm', t.title ? 'text-muted' : 'font-medium')}>{t.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Fermer la notification"
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-subtle transition hover:bg-surface-3 hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
