import { CheckCircle2, Tv, Wifi, Zap } from 'lucide-react';
import { LogoMark } from './ui/Logo';

/** Slideshow mockup of a TV used on marketing/auth screens (pure CSS, no assets). */
export function TvMock({ className = '' }) {
  const slides = [
    { bg: 'from-indigo-500 via-violet-500 to-fuchsia-500', title: 'Promotion du jour', sub: '-20 % sur toute la vitrine' },
    { bg: 'from-emerald-400 via-teal-500 to-cyan-600', title: 'Nouveautés', sub: 'Collection de saison' },
    { bg: 'from-amber-400 via-orange-500 to-rose-500', title: 'Menu du midi', sub: 'Plat + dessert 14,90 €' },
  ];
  return (
    <div className={`rounded-[1.75rem] bg-gradient-to-b from-zinc-600 to-zinc-900 p-2 shadow-2xl ${className}`}>
      <div className="relative aspect-video overflow-hidden rounded-[1.25rem] bg-black">
        <div className="slideshow absolute inset-0">
          {slides.map((s) => (
            <div key={s.title} className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-br ${s.bg} p-5 sm:p-7`}>
              <div className="absolute -right-10 -top-10 size-44 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute bottom-0 right-0 size-40 translate-x-10 translate-y-10 rounded-full border-[18px] border-white/15" />
              <p className="relative font-display text-xl font-extrabold leading-tight text-white drop-shadow sm:text-3xl">{s.title}</p>
              <p className="relative mt-1 text-xs font-medium text-white/85 sm:text-base">{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
          <span className="live-dot text-emerald-400" /> En ligne
        </div>
      </div>
    </div>
  );
}

const POINTS = [
  { icon: Zap, text: 'Mise à jour instantanée sur tous vos écrans' },
  { icon: Wifi, text: 'Continue de diffuser même sans connexion' },
  { icon: CheckCircle2, text: 'Hébergé chez vous : vos médias restent privés' },
];

/** Dark brand panel shown next to the login form on large screens. */
export default function AuthShowcase() {
  return (
    <aside data-theme="dark" className="relative hidden overflow-hidden bg-[#07080d] text-fg lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div className="absolute -left-32 -top-32 size-[34rem] animate-drift rounded-full bg-indigo-600/30 blur-[120px]" aria-hidden="true" />
      <div className="absolute -bottom-40 -right-24 size-[32rem] animate-drift rounded-full bg-fuchsia-600/25 blur-[120px] [animation-delay:-8s]" aria-hidden="true" />
      <div className="bg-grid mask-fade-radial absolute inset-0 opacity-60" aria-hidden="true" />

      <div className="relative flex items-center gap-3">
        <LogoMark className="size-10" />
        <span className="font-display text-xl font-extrabold tracking-tight">ImageScreen</span>
      </div>

      <div className="relative max-w-xl">
        <h2 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">
          Vos écrans,{' '}
          <span className="text-gradient">pilotés avec élégance.</span>
        </h2>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
          Importez vos photos et vidéos, composez vos playlists et diffusez-les sur toutes vos télévisions en quelques clics.
        </p>
        <div className="relative mt-10">
          <TvMock className="animate-float" />
          <div className="absolute -bottom-9 -left-6 flex items-center gap-3 rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-pop backdrop-blur-xl">
            <div className="grid size-9 place-items-center rounded-xl bg-success/15 text-success"><Tv className="size-[18px]" /></div>
            <div>
              <p className="text-[13px] font-bold leading-tight">TV Vitrine</p>
              <p className="text-[11px] text-muted">Synchronisée à l’instant</p>
            </div>
          </div>
        </div>
      </div>

      <ul className="relative space-y-3">
        {POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm text-muted">
            <Icon className="size-4 shrink-0 text-brand" />
            {text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
