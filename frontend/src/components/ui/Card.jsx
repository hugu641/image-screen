import { cn } from '../../utils/cn';

export function Card({ className, interactive = false, as: Tag = 'div', children, ...rest }) {
  return (
    <Tag className={cn('card', interactive && 'card-interactive', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Card header with optional icon tile, title, description and right-aligned action. */
export function CardHeader({ title, description, icon: Icon, action, className, tone = 'primary' }) {
  const tones = {
    primary: 'bg-primary/10 text-brand',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-info/10 text-info',
    accent: 'bg-accent/10 text-accent',
  };
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate font-display text-base font-bold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('p-5 sm:p-6', className)}>{children}</div>;
}
