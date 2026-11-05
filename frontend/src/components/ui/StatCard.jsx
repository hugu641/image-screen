import { cn } from '../../utils/cn';
import { Skeleton } from './Misc';

const TONES = {
  primary: 'from-primary/20 to-primary/5 text-brand',
  success: 'from-success/20 to-success/5 text-success',
  accent: 'from-accent/20 to-accent/5 text-accent',
  warning: 'from-warning/20 to-warning/5 text-warning',
  info: 'from-info/20 to-info/5 text-info',
};

export default function StatCard({ icon: Icon, label, value, suffix, hint, tone = 'primary', loading, children, className }) {
  return (
    <div className={cn('card relative overflow-hidden p-4 sm:p-5', className)}>
      <div
        className={cn('pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-gradient-to-br opacity-60 blur-2xl', TONES[tone])}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted">{label}</p>
          {loading ? (
            <Skeleton className="mt-3 h-9 w-24" />
          ) : (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 font-display text-[28px] font-extrabold leading-none tracking-tight tabular-nums sm:text-[34px]">
              {value}
              {suffix && <span className="text-base font-semibold text-subtle">{suffix}</span>}
            </p>
          )}
          {hint && !loading && <p className="mt-2.5 line-clamp-2 text-xs text-subtle">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br sm:size-11 sm:rounded-2xl', TONES[tone])}>
            <Icon className="size-[18px] sm:size-5" />
          </div>
        )}
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );
}
