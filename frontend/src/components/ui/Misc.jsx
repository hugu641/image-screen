import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../utils/cn';
import { hueFrom, initials } from '../../utils/format';

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function Spinner({ className }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={cn('inline-block size-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary', className)}
    />
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl bg-brand-gradient opacity-25 blur-xl" aria-hidden="true" />
        <div className="relative grid size-16 place-items-center rounded-3xl border border-line bg-surface-2 text-brand">
          {Icon && <Icon className="size-7" />}
        </div>
      </div>
      <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, eyebrow, actions, back, badge, className }) {
  return (
    <header className={cn('mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-fg">
            <ArrowLeft className="size-4" />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 max-sm:[&>*]:min-w-[9rem] max-sm:[&>*]:flex-1 sm:shrink-0">{actions}</div>}
    </header>
  );
}

export function ProgressBar({ value = 0, tone = 'primary', className, label }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const tones = {
    primary: 'bg-brand-gradient',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-3', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Donut chart. segments: [{ value, className }] where className sets the stroke color (e.g. 'text-success'). */
export function Donut({ segments, size = 120, thickness = 12, children, className }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-surface-3" />
        {total > 0 &&
          segments.map((s, i) => {
            if (!s.value) return null;
            const len = (s.value / total) * c;
            const gap = segments.filter((x) => x.value).length > 1 ? Math.min(4, len * 0.25) : 0;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={thickness}
                strokeLinecap="round"
                stroke="currentColor"
                className={cn('transition-all duration-700', s.className)}
                strokeDasharray={`${Math.max(len - gap, 0.01)} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Avatar({ name, size = 'md', className }) {
  const sizes = { sm: 'size-8 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-base' };
  const hue = hueFrom(name);
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full font-bold text-white', sizes[size], className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 78% 58%), hsl(${(hue + 50) % 360} 78% 48%))` }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Switch({ checked, onChange, label, description, disabled, id }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          {label && <p className="text-sm font-semibold">{label}</p>}
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-50',
          checked ? 'border-transparent bg-brand-gradient' : 'border-line-strong bg-surface-3'
        )}
      >
        <span
          className={cn(
            'inline-block size-[18px] rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
          )}
        />
      </button>
    </div>
  );
}

/** Radio-style segmented control. options: [{ value, label, icon }] */
export function Segmented({ value, onChange, options, size = 'md', className, label }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface-2 p-1', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-[13px]',
              active ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'
            )}
          >
            {Icon && <Icon className="size-4" />}
            {o.label}
            {o.count !== undefined && (
              <span className={cn('rounded-md px-1.5 text-[11px] font-bold tabular-nums', active ? 'bg-primary/10 text-brand' : 'bg-surface-3 text-subtle')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>;
}
