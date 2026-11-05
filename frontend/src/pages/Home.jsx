import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  ChevronDown,
  Cloud,
  Cpu,
  Images,
  Link2,
  ListVideo,
  Menu,
  Monitor,
  QrCode,
  Radio,
  ShieldCheck,
  Tv,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { LogoMark } from '../components/ui/Logo';
import { ThemeToggleButton } from '../components/ui/ThemeSwitch';
import { TvMock } from '../components/AuthShowcase';
import Button from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { cn } from '../utils/cn';

/* ── Scroll reveal ────────────────────────────────────────────────────── */
function Reveal({ children, className, delay = 0, as: Tag = 'div' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) { el.classList.add('is-visible'); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('is-visible'); io.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={cn('reveal', className)} style={{ transitionDelay: `${delay}ms` }}>{children}</Tag>;
}

function SectionHead({ eyebrow, title, children }) {
  return (
    <Reveal className="mx-auto mb-14 max-w-2xl text-center">
      <p className="eyebrow mb-3 text-brand">{eyebrow}</p>
      <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-base leading-relaxed text-muted">{children}</p>}
    </Reveal>
  );
}

/* ── Navbar ───────────────────────────────────────────────────────────── */
function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [['#features', 'Fonctionnalités'], ['#how', 'Comment ça marche'], ['#selfhost', 'Auto-hébergé'], ['#faq', 'FAQ']];

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled || open ? 'glass border-b border-line' : 'border-b border-transparent')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label="ImageScreen — accueil">
          <LogoMark className="size-9" />
          <span className="font-display text-lg font-extrabold tracking-tight">ImageScreen</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-fg">{label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <Button to="/login" variant="primary" size="sm" className="hidden sm:inline-flex" iconRight={ArrowRight}>Se connecter</Button>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu" className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg md:hidden">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-rise border-t border-line px-5 pb-5 pt-3 md:hidden">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-[15px] font-semibold text-muted hover:bg-surface-2 hover:text-fg">{label}</a>
          ))}
          <Button to="/login" variant="primary" className="mt-3 w-full">Se connecter</Button>
        </div>
      )}
    </header>
  );
}

/* ── Hero product mock ────────────────────────────────────────────────── */
function DashboardMock() {
  const screens = [
    { name: 'TV Vitrine', pl: 'Promotions', on: true },
    { name: 'TV Caisse', pl: 'Nouveautés', on: true },
    { name: 'TV Hall', pl: 'Menu du midi', on: false },
  ];
  return (
    <div className="card overflow-hidden shadow-pop">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-3">
        <span className="size-3 rounded-full bg-rose-400/80" /><span className="size-3 rounded-full bg-amber-400/80" /><span className="size-3 rounded-full bg-emerald-400/80" />
        <div className="mx-auto hidden h-6 w-2/5 items-center justify-center rounded-md bg-surface-3/80 text-[10px] font-medium text-subtle sm:flex">imagescreen · tableau de bord</div>
      </div>
      <div className="grid grid-cols-[150px_1fr] sm:grid-cols-[170px_1fr]">
        <div className="hidden space-y-1.5 border-r border-line bg-surface-2/40 p-3 sm:block">
          <div className="mb-3 flex items-center gap-2 px-1"><LogoMark className="size-6" /><span className="text-[11px] font-extrabold">Mon Magasin</span></div>
          {[['Tableau de bord', true], ['Écrans'], ['Playlists'], ['Médiathèque'], ['Paramètres']].map(([l, a]) => (
            <div key={l} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold', a ? 'bg-primary/10 text-brand' : 'text-subtle')}>
              <span className="size-3 rounded bg-current opacity-50" />{l}
            </div>
          ))}
        </div>
        <div className="col-span-2 space-y-3.5 p-4 sm:col-span-1 sm:p-5">
          <div className="grid grid-cols-3 gap-2.5">
            {[['2/3', 'Écrans en ligne', 'text-success'], ['24', 'Médias', 'text-brand'], ['4', 'Playlists', 'text-accent']].map(([n, l, c]) => (
              <div key={l} className="rounded-xl border border-line bg-surface p-3">
                <p className={cn('font-display text-xl font-extrabold leading-none', c)}>{n}</p>
                <p className="mt-1.5 text-[10px] font-semibold text-subtle">{l}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-surface p-1.5">
            {screens.map((s) => (
              <div key={s.name} className="flex items-center gap-3 rounded-lg px-2.5 py-2">
                <div className={cn('grid size-8 place-items-center rounded-lg', s.on ? 'bg-success/10 text-success' : 'bg-surface-3 text-subtle')}><Tv className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{s.name}</p>
                  <p className="truncate text-[10px] text-subtle">▶ {s.pl}</p>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold', s.on ? 'bg-success/10 text-success' : 'bg-surface-3 text-subtle')}>
                  <span className="size-1.5 rounded-full bg-current" />{s.on ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="bg-aurora relative overflow-hidden pt-32 sm:pt-40">
      <div className="bg-dots mask-fade-radial pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-xs font-bold text-muted shadow-card backdrop-blur">
              <span className="live-dot text-success" /> Fonctionne même sans Internet
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-7 font-display text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Diffusez vos réalisations sur{' '}
              <span className="text-gradient">tous vos écrans</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              ImageScreen transforme n’importe quelle télévision en écran d’affichage dynamique. Importez vos photos et vidéos,
              composez vos playlists et pilotez tout en temps réel depuis votre navigateur.
            </p>
          </Reveal>
          <Reveal delay={240} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button to="/login" variant="primary" size="lg" iconRight={ArrowRight} className="w-full sm:w-auto">Accéder à l’application</Button>
            <Button href="#how" variant="secondary" size="lg" className="w-full sm:w-auto">Voir comment ça marche</Button>
          </Reveal>
          <Reveal delay={320} className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium text-subtle">
            {['Auto-hébergé', 'Vos données restent chez vous', 'Fire TV · Android TV · Smart TV'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" />{t}</span>
            ))}
          </Reveal>
        </div>

        {/* Product composition */}
        <Reveal delay={200} className="relative mx-auto mt-16 max-w-5xl pb-20 sm:mt-20">
          <div className="absolute inset-x-10 -bottom-4 top-20 rounded-[3rem] bg-brand-gradient opacity-20 blur-3xl" aria-hidden="true" />
          <div className="relative [perspective:1600px]">
            <div className="origin-bottom transition-transform duration-700 sm:[transform:rotateX(6deg)] sm:hover:[transform:rotateX(0deg)]">
              <DashboardMock />
            </div>
          </div>
          <div className="absolute bottom-6 right-0 hidden w-[44%] sm:block lg:-right-8 lg:w-[40%]">
            <TvMock className="animate-float shadow-pop" />
          </div>
          <div className="absolute -top-7 right-8 hidden animate-float items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur-xl lg:flex">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-brand"><Link2 className="size-[18px]" /></div>
            <div>
              <p className="text-[13px] font-bold leading-tight">Nouvel écran détecté</p>
              <p className="font-mono text-xs font-semibold tracking-widest text-muted">A7K9P2</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Compatibility strip ──────────────────────────────────────────────── */
function Compat() {
  const items = [['Fire TV Stick', Tv], ['Android TV', Tv], ['Smart TV', Monitor], ['Mini-PC kiosque', Cpu], ['Navigateur web', Cloud]];
  return (
    <section className="border-y border-line bg-surface/60">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-5 py-8 sm:px-8 lg:flex-row lg:justify-between">
        <p className="eyebrow">Fonctionne sur</p>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {items.map(([label, Icon]) => (
            <li key={label} className="flex items-center gap-2.5 text-sm font-semibold text-muted"><Icon className="size-[18px] text-subtle" />{label}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Features (bento) ─────────────────────────────────────────────────── */
function Feature({ icon: Icon, title, children, className, tone = 'primary', delay = 0, visual }) {
  const tones = { primary: 'bg-primary/10 text-brand', success: 'bg-success/10 text-success', accent: 'bg-accent/10 text-accent', info: 'bg-info/10 text-info', warning: 'bg-warning/10 text-warning' };
  return (
    <Reveal delay={delay} className={cn('card group relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-pop sm:p-7', className)}>
      <div className={cn('mb-5 grid size-11 place-items-center rounded-2xl', tones[tone])}><Icon className="size-5" /></div>
      <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
      {visual}
    </Reveal>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8 sm:py-28">
      <SectionHead eyebrow="Fonctionnalités" title="Tout ce qu’il faut, rien de superflu">
        Un outil pensé pour les commerçants : simple à prendre en main, fiable au quotidien.
      </SectionHead>

      <div className="grid gap-5 md:grid-cols-6">
        <Feature icon={Radio} title="Pilotage en temps réel" tone="success" className="md:col-span-4" visual={
          <div className="mt-6 flex flex-wrap gap-2.5">
            {[['TV Vitrine', true], ['TV Caisse', true], ['TV Hall', false]].map(([n, on]) => (
              <span key={n} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold', on ? 'border-success/25 bg-success/10 text-success' : 'border-line bg-surface-2 text-subtle')}>
                {on ? <span className="live-dot" /> : <WifiOff className="size-3" />}{n}
              </span>
            ))}
          </div>
        }>
          Changez une playlist, renommez un écran ou forcez une synchronisation : la TV réagit en quelques secondes,
          sans rechargement. Suivez l’état de chaque écran depuis le tableau de bord.
        </Feature>

        <Feature icon={WifiOff} title="Mode hors ligne" tone="warning" className="md:col-span-2" delay={80}>
          Les médias sont mis en cache sur la TV. Une coupure réseau n’interrompt pas la diffusion.
        </Feature>

        <Feature icon={ListVideo} title="Playlists soignées" tone="accent" className="md:col-span-2" delay={80}>
          Ordre libre par glisser-déposer, durée par défaut, lecture aléatoire ou en boucle, transitions fondu, zoom ou glissement.
        </Feature>

        <Feature icon={Images} title="Médiathèque intelligente" tone="info" className="md:col-span-2" delay={160}>
          Import par glisser-déposer. Les images sont redimensionnées et optimisées automatiquement pour la TV.
        </Feature>

        <Feature icon={QrCode} title="Association par code" tone="primary" className="md:col-span-2" delay={240}>
          La TV affiche un code à 6 caractères et un QR code. Saisissez-le : l’écran est associé, sans configuration réseau.
        </Feature>

        <Feature icon={BellRing} title="Aperçu et journal d’activité" tone="success" className="md:col-span-3" delay={80}>
          Voyez en direct ce qu’affiche chaque écran, et retrouvez l’historique des connexions et des modifications.
        </Feature>

        <Feature icon={ShieldCheck} title="Sécurisé et privé" tone="accent" className="md:col-span-3" delay={160}>
          Comptes protégés, inscriptions fermées par défaut, fichiers contrôlés à l’import. Vos médias restent sur votre serveur.
        </Feature>
      </div>
    </section>
  );
}

/* ── How it works ─────────────────────────────────────────────────────── */
function How() {
  const steps = [
    { icon: Monitor, title: 'Ouvrez le lecteur sur la TV', text: 'Dans le navigateur de la télévision, ouvrez l’adresse /tv de votre serveur. Un code d’association s’affiche.' },
    { icon: Link2, title: 'Associez l’écran', text: 'Dans « Écrans », saisissez le code et donnez un nom à la TV. Elle apparaît immédiatement dans votre liste.' },
    { icon: Zap, title: 'Diffusez', text: 'Importez vos médias, composez une playlist et affectez-la à l’écran. C’est en ligne dans la seconde.' },
  ];
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-surface-2/40 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHead eyebrow="Comment ça marche" title="En ligne en trois étapes" />
        <ol className="relative grid gap-6 md:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block" aria-hidden="true" />
          {steps.map(({ icon: Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 100} className="relative text-center">
              <div className="relative mx-auto mb-6 w-fit">
                <div className="grid size-16 place-items-center rounded-3xl border border-line bg-surface text-brand shadow-card"><Icon className="size-7" /></div>
                <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-brand-gradient font-display text-xs font-extrabold text-white shadow-btn">{i + 1}</span>
              </div>
              <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Self-hosted ──────────────────────────────────────────────────────── */
function SelfHost() {
  return (
    <section id="selfhost" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8 sm:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="eyebrow mb-3 text-brand">Auto-hébergé</p>
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Chez vous, sur votre matériel</h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            ImageScreen s’installe sur un PC Windows, Linux ou un NAS de votre magasin. La base de données est intégrée :
            aucune configuration, aucun compte cloud, aucun abonnement.
          </p>
          <ul className="mt-7 space-y-3.5">
            {[
              ['Vos médias et vos données restent sur votre serveur', ShieldCheck],
              ['Aucun service tiers : le QR code et les polices sont générés localement', Cloud],
              ['Un seul script pour installer, compiler et démarrer', Zap],
            ].map(([text, Icon]) => (
              <li key={text} className="flex items-start gap-3 text-sm font-medium">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><Icon className="size-3.5" /></span>
                {text}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="relative">
          <div className="absolute -inset-4 rounded-[2.5rem] bg-brand-gradient opacity-15 blur-2xl" aria-hidden="true" />
          <div data-theme="dark" className="relative overflow-hidden rounded-3xl border border-line bg-[#090a11] shadow-pop">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="size-3 rounded-full bg-rose-400/80" /><span className="size-3 rounded-full bg-amber-400/80" /><span className="size-3 rounded-full bg-emerald-400/80" />
              <span className="ml-2 text-xs font-medium text-subtle">terminal</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7 text-fg"><code>
              <span className="text-subtle">$ </span><span className="text-brand">./start-production.sh</span>{'\n'}
              <span className="text-success">✅ Serving React frontend from production build</span>{'\n'}
              {'\n'}
              <span className="text-muted">Administration </span> http://localhost:5000{'\n'}
              <span className="text-muted">Lecteur TV     </span> http://192.168.1.50:5000/tv{'\n'}
              {'\n'}
              <span className="text-success">✓ Prêt — ouvrez le lecteur sur votre première TV</span>
            </code></pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */
const FAQS = [
  { q: 'Comment connecter ma première télévision ?', a: 'Ouvrez l’adresse /tv de votre serveur (par exemple http://192.168.1.50:5000/tv) dans le navigateur de la TV. Elle affiche un code à 6 caractères : saisissez-le dans la page « Écrans » de l’administration pour associer l’écran.' },
  { q: 'Est-ce que ça fonctionne sans Internet ?', a: 'Oui. Dès qu’une playlist est affectée, la TV télécharge les médias et les conserve en cache : la diffusion continue en cas de coupure. Seul le réseau local vers votre serveur est nécessaire pour recevoir les mises à jour.' },
  { q: 'Quels formats de fichiers sont acceptés ?', a: 'Images JPG, PNG et WEBP, et vidéos MP4, jusqu’à 100 Mo par fichier. Les images sont automatiquement redimensionnées et optimisées à l’import.' },
  { q: 'Combien d’écrans puis-je connecter ?', a: 'Le logiciel n’impose pas de limite. En pratique, c’est la puissance de votre serveur et de votre réseau qui comptent ; quelques dizaines d’écrans restent confortables sur un petit serveur.' },
  { q: 'Où sont stockées mes données ?', a: 'Uniquement sur votre serveur : une base SQLite et un dossier pour vos médias. Rien n’est envoyé vers un service tiers.' },
  { q: 'Puis-je l’utiliser sur un Fire TV Stick ou une Android TV ?', a: 'Oui, le lecteur fonctionne dans le navigateur de la plupart des télévisions connectées, Fire TV Stick et Android TV compris, ainsi que sur un mini-PC en mode kiosque.' },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('card overflow-hidden transition-colors', open && 'border-primary/30')}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5">
        <span className="text-[15px] font-bold">{q}</span>
        <ChevronDown className={cn('size-5 shrink-0 text-subtle transition-transform duration-300', open && 'rotate-180 text-brand')} />
      </button>
      <div className={cn('grid transition-all duration-300', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden"><p className="px-5 pb-5 text-sm leading-relaxed text-muted sm:px-6">{a}</p></div>
      </div>
    </div>
  );
}

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-24 sm:px-8 sm:pb-28">
      <SectionHead eyebrow="FAQ" title="Questions fréquentes" />
      <div className="space-y-3">
        {FAQS.map((f, i) => <Reveal key={f.q} delay={i * 50}><FaqItem {...f} /></Reveal>)}
      </div>
    </section>
  );
}

/* ── CTA + footer ─────────────────────────────────────────────────────── */
function Cta() {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
      <Reveal>
        <div data-theme="dark" className="relative overflow-hidden rounded-4xl bg-[#0a0b14] px-6 py-16 text-center text-fg shadow-pop sm:px-12 sm:py-20">
          <div className="absolute -left-20 -top-20 size-80 animate-drift rounded-full bg-indigo-600/40 blur-[90px]" aria-hidden="true" />
          <div className="absolute -bottom-24 -right-16 size-80 animate-drift rounded-full bg-fuchsia-600/35 blur-[90px] [animation-delay:-8s]" aria-hidden="true" />
          <div className="bg-grid mask-fade-radial absolute inset-0 opacity-50" aria-hidden="true" />
          <div className="relative">
            <h2 className="mx-auto max-w-xl font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Prêt à lancer vos écrans&nbsp;?</h2>
            <p className="mx-auto mt-4 max-w-md text-base text-muted">Connectez-vous à votre espace pour importer vos médias et associer votre première télévision.</p>
            <Button to="/login" variant="primary" size="lg" iconRight={ArrowRight} className="mt-8">Accéder à l’application</Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-5 py-8 text-sm text-subtle sm:flex-row sm:px-8">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="font-display font-extrabold text-fg">ImageScreen</span>
          <span className="hidden sm:inline">· Affichage dynamique pour commerces</span>
        </div>
        <nav className="flex gap-6 font-medium" aria-label="Pied de page">
          <a href="#features" className="transition hover:text-fg">Fonctionnalités</a>
          <a href="#faq" className="transition hover:text-fg">FAQ</a>
          <Link to="/login" className="transition hover:text-fg">Connexion</Link>
        </nav>
        <p>© {new Date().getFullYear()} ImageScreen</p>
      </div>
    </footer>
  );
}

export default function Home() {
  useDocumentTitle('');
  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <Navbar />
      <main>
        <Hero />
        <Compat />
        <Features />
        <How />
        <SelfHost />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
