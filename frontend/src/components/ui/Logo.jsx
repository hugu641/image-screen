import { useId } from 'react';
import { cn } from '../../utils/cn';

/** ImageScreen brand mark (a screen with a play button, on the brand gradient). */
export function LogoMark({ className }) {
  const gid = useId();
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn('size-9', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6A5CF6" />
          <stop offset=".55" stopColor="#9B5CF6" />
          <stop offset="1" stopColor="#D946EF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <rect x="13" y="16" width="38" height="25" rx="6" stroke="#fff" strokeWidth="3.5" />
      <path d="M29 22.5v12l10-6-10-6Z" fill="#fff" />
      <path d="M25 48h14" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + wordmark. Pass `logo` (an <img> URL) to show the store's own logo instead of the mark. */
export function Brand({ name = 'ImageScreen', subtitle, logo, onLogoError, className, markClassName, collapsed = false }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {logo ? (
        <img src={logo} alt="" onError={onLogoError} className={cn('size-9 shrink-0 rounded-xl border border-line bg-surface object-contain p-1', markClassName)} />
      ) : (
        <LogoMark className={cn('shrink-0', markClassName)} />
      )}
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[15px] font-extrabold tracking-tight">{name}</p>
          {subtitle && <p className="truncate text-[11px] font-medium text-subtle">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
