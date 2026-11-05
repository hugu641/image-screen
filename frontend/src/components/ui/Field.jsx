import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Label + control + hint/error wrapper.
 * Pass a render function as children to receive generated ids:
 *   <Field label="Nom">{(p) => <Input {...p} />}</Field>
 */
export function Field({ label, hint, error, required, className, action, children }) {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;
  const controlProps = { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined };
  return (
    <div className={className}>
      {(label || action) && (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          {label && (
            <label htmlFor={id} className="text-xs font-semibold text-muted">
              {label}
              {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
            </label>
          )}
          {action}
        </div>
      )}
      {typeof children === 'function' ? children(controlProps) : children}
      {error ? (
        <p id={describedBy} role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p id={describedBy} className="mt-1.5 text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ icon: Icon, className, wrapperClassName, ...props }) {
  if (!Icon) return <input className={cn('input', className)} {...props} />;
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input className={cn('input pl-10', className)} {...props} />
    </div>
  );
}

export function PasswordInput({ icon: Icon, className, ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />}
      <input
        {...props}
        type={shown ? 'text' : 'password'}
        className={cn('input pr-11', Icon && 'pl-10', className)}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={shown}
        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-subtle transition hover:bg-surface-3 hover:text-fg"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn('input', className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn('input min-h-24 resize-y', className)} {...props} />;
}

/** Password strength 0-4 for a visual meter (length + variety; not a security boundary). */
// eslint-disable-next-line react-refresh/only-export-components
export function passwordScore(pw = '') {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

export function PasswordMeter({ value }) {
  const score = passwordScore(value);
  const labels = ['Trop court', 'Faible', 'Correct', 'Bon', 'Excellent'];
  const colors = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'];
  if (!value) return null;
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < score ? colors[score] : 'bg-surface-3')} />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-subtle">Robustesse : {labels[score]}</p>
    </div>
  );
}
