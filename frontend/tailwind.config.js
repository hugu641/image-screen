import defaultTheme from 'tailwindcss/defaultTheme.js';

// Colors come from CSS variables (see src/index.css) so the whole UI switches between the
// light and dark themes without `dark:` variants. `<alpha-value>` keeps `bg-primary/10` working.
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', ...defaultTheme.fontFamily.sans],
        display: ['"Plus Jakarta Sans Variable"', '"Inter Variable"', ...defaultTheme.fontFamily.sans],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        'surface-2': c('surface-2'),
        'surface-3': c('surface-3'),
        line: c('line'),
        'line-strong': c('line-strong'),
        fg: c('fg'),
        muted: c('muted'),
        subtle: c('subtle'),
        primary: c('primary'),
        brand: c('brand'),
        accent: c('accent'),
        success: c('success'),
        warning: c('warning'),
        danger: c('danger'),
        info: c('info'),
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        btn: 'var(--shadow-btn)',
        glow: '0 0 0 4px rgb(var(--c-primary) / 0.18)',
      },
      backgroundImage: {
        'brand-gradient': 'var(--grad)',
        'brand-gradient-soft': 'var(--grad-soft)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pop: { from: { opacity: '0', transform: 'scale(.96) translateY(6px)' }, to: { opacity: '1', transform: 'scale(1) translateY(0)' } },
        sheet: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        toast: { from: { opacity: '0', transform: 'translateY(12px) scale(.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        ping2: { '0%': { transform: 'scale(1)', opacity: '.6' }, '80%,100%': { transform: 'scale(2.4)', opacity: '0' } },
        slides: {
          '0%,28%': { opacity: '1' },
          '33%,95%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        drift: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(2%,-3%,0) scale(1.08)' } },
        progress: { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
      },
      animation: {
        rise: 'rise .45s cubic-bezier(.2,.8,.2,1) both',
        pop: 'pop .22s cubic-bezier(.2,.8,.2,1) both',
        sheet: 'sheet .28s cubic-bezier(.2,.8,.2,1) both',
        toast: 'toast .28s cubic-bezier(.2,.8,.2,1) both',
        float: 'float 6s ease-in-out infinite',
        ping2: 'ping2 1.8s cubic-bezier(0,0,.2,1) infinite',
        drift: 'drift 16s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
