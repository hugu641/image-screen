import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 ' +
  'select-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ' +
  'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

const VARIANTS = {
  primary: 'bg-brand-gradient text-white shadow-btn hover:brightness-110',
  secondary: 'border border-line bg-surface text-fg shadow-card hover:border-line-strong hover:bg-surface-2',
  outline: 'border border-line-strong text-fg hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  soft: 'bg-primary/10 text-brand hover:bg-primary/15',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  'soft-danger': 'bg-danger/10 text-danger hover:bg-danger/15',
  dark: 'bg-fg text-bg hover:opacity-90',
};

const SIZES = {
  xs: 'h-8 rounded-lg px-3 text-xs',
  sm: 'h-9 rounded-xl px-3.5 text-[13px]',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-2xl px-6 text-[15px]',
};

const ICON_SIZES = {
  xs: 'size-8 rounded-lg',
  sm: 'size-9 rounded-xl',
  md: 'size-10 rounded-xl',
  lg: 'size-12 rounded-2xl',
};

/**
 * Button / link-styled-as-button.
 * <Button variant="primary" icon={Plus} loading={busy}>Créer</Button>
 * <Button to="/screens">…</Button> renders a router <Link>; href renders an <a>.
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  iconOnly = false,
  loading = false,
  to,
  href,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}) {
  const classes = cn(BASE, VARIANTS[variant], iconOnly ? ICON_SIZES[size] : SIZES[size], className);
  const content = (
    <>
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" /> : Icon ? <Icon className="size-4 shrink-0" /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4 shrink-0" /> : null}
    </>
  );

  if (to) return <Link to={to} className={classes} {...rest}>{content}</Link>;
  if (href) return <a href={href} className={classes} {...rest}>{content}</a>;
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={classes} {...rest}>
      {content}
    </button>
  );
}
