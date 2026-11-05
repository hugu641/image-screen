import { cn } from '../../utils/cn';

const TONES = {
  neutral: 'bg-surface-3 text-muted',
  primary: 'bg-primary/10 text-brand',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  accent: 'bg-accent/10 text-accent',
};

export function Badge({ tone = 'neutral', dot = false, pulse = false, icon: Icon, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none',
        TONES[tone],
        className
      )}
    >
      {dot && (pulse ? <span className="live-dot" /> : <span className="size-1.5 rounded-full bg-current" />)}
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}

const STATUS = {
  connected: { tone: 'success', label: 'En ligne', pulse: true },
  offline: { tone: 'neutral', label: 'Hors ligne' },
  waiting_content: { tone: 'warning', label: 'En attente de contenu' },
  not_associated: { tone: 'primary', label: 'Non associé' },
};

export function StatusBadge({ status, className }) {
  const s = STATUS[status] || { tone: 'danger', label: 'Erreur réseau' };
  return (
    <Badge tone={s.tone} dot pulse={s.pulse} className={className}>
      {s.label}
    </Badge>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const statusTone = (status) => (STATUS[status] || { tone: 'danger' }).tone;
