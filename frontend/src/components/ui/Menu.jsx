import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

const MenuContext = createContext(() => {});

/**
 * Dropdown menu rendered in a portal (so it is never clipped by `overflow-hidden` cards).
 * trigger: ({ ref, onClick, 'aria-expanded', 'aria-haspopup' }) => ReactNode
 */
export function DropdownMenu({ trigger, children, align = 'end', width = 220 }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, up: false });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 200;
    const up = r.bottom + menuH + 12 > window.innerHeight && r.top > menuH + 12;
    const left = align === 'end' ? r.right - width : r.left;
    setPos({
      top: up ? r.top - menuH - 8 : r.bottom + 8,
      left: Math.max(12, Math.min(left, window.innerWidth - width - 12)),
      up,
    });
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); triggerRef.current?.focus?.(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
        const i = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    const onScroll = () => close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector('[role="menuitem"]')?.focus();
  }, [open]);

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      {open &&
        createPortal(
          <MenuContext.Provider value={close}>
            <div
              ref={menuRef}
              role="menu"
              style={{ top: pos.top, left: pos.left, width }}
              className={cn(
                'fixed z-[150] animate-pop rounded-2xl border border-line bg-surface p-1.5 shadow-pop',
                pos.up ? 'origin-bottom' : 'origin-top'
              )}
            >
              {children}
            </div>
          </MenuContext.Provider>,
          document.body
        )}
    </>
  );
}

const ITEM =
  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:bg-surface-2';

export function MenuItem({ icon: Icon, tone, to, onClick, disabled, children }) {
  const close = useContext(MenuContext);
  const cls = cn(ITEM, tone === 'danger' ? 'text-danger hover:bg-danger/10 focus-visible:bg-danger/10' : 'text-fg hover:bg-surface-2');
  const content = (
    <>
      {Icon && <Icon className={cn('size-4 shrink-0', tone === 'danger' ? 'text-danger' : 'text-muted')} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );
  if (to) {
    return <Link role="menuitem" to={to} onClick={close} className={cls}>{content}</Link>;
  }
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cls}
      onClick={() => { close(); onClick?.(); }}
    >
      {content}
    </button>
  );
}

export function MenuLabel({ children }) {
  return <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-subtle">{children}</p>;
}

export function MenuSeparator() {
  return <div className="my-1.5 h-px bg-line" role="separator" />;
}
