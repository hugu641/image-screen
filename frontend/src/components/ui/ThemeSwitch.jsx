import { Moon, Monitor, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Segmented } from './Misc';
import { cn } from '../../utils/cn';

/** Round icon button that flips between light and dark. */
export function ThemeToggleButton({ className }) {
  const { resolved, setTheme } = useTheme();
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={dark ? 'Thème clair' : 'Thème sombre'}
      className={cn(
        'grid size-10 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg',
        className
      )}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

/** Three-way segmented switch: Clair / Sombre / Auto. */
export function ThemeSwitch({ size = 'md', className }) {
  const { theme, setTheme } = useTheme();
  return (
    <Segmented
      label="Thème de l'interface"
      value={theme}
      onChange={setTheme}
      size={size}
      className={className}
      options={[
        { value: 'light', label: 'Clair', icon: Sun },
        { value: 'dark', label: 'Sombre', icon: Moon },
        { value: 'system', label: 'Auto', icon: Monitor },
      ]}
    />
  );
}
