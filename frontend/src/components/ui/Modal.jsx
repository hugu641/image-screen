import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl', full: 'sm:max-w-5xl' };
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: portal, focus trap, Escape/backdrop to close, scroll lock, focus restore.
 * On phones it behaves like a bottom sheet.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  tone = 'primary',
  size = 'md',
  footer,
  dismissible = true,
  className,
  children,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const first = panel?.querySelector('[data-autofocus]') || panel?.querySelectorAll(FOCUSABLE)[1] || panel;
    first?.focus?.();

    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        closeRef.current?.();
      } else if (e.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, dismissible]);

  if (!open) return null;

  const tones = {
    primary: 'bg-primary/10 text-brand',
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-pop flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-pop outline-none sm:rounded-3xl',
          SIZES[size],
          className
        )}
      >
        {(title || dismissible) && (
          <div className="flex items-start gap-3.5 px-6 pt-6">
            {Icon && (
              <div className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', tones[tone])}>
                <Icon className="size-5" />
              </div>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              {title && <h2 id={titleId} className="font-display text-lg font-bold tracking-tight">{title}</h2>}
              {description && <p id={descId} className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="-mr-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-xl text-subtle transition hover:bg-surface-3 hover:text-fg"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2.5 border-t border-line bg-surface-2/50 px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
