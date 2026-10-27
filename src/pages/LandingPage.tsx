import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, MessageSquare, Shuffle, Smartphone } from 'lucide-react'
import { cn } from '../lib/utils'
import { FadeSlideshow } from '../components/FadeSlideshow'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { useCompact, useShowcase } from '../hooks/useShowcase'
import type { ShowcaseImage } from '../services/showcase'

type Key = 'anime' | 'manga' | 'novel' | 'movies'

interface Section {
  key: Key
  name: string
  kanji: string
  text: string
  to: string
  cta: string
  /** the section's own colour, the same identity the site uses once you are inside it */
  tint: string
  /** readable text colour on top of the tint */
  ink: string
}

const SECTIONS: Section[] = [
  { key: 'anime', name: 'Anime', kanji: 'アニメ', text: 'Stream the latest shows, sub or dub.', to: '/home', cta: 'Start watching', tint: '#e8294c', ink: '#ffffff' },
  { key: 'manga', name: 'Manga', kanji: '漫画', text: 'Read chapters, saved as you go.', to: '/manga', cta: 'Start reading', tint: '#8b83ff', ink: '#0b0a1f' },
  { key: 'novel', name: 'Novels', kanji: '小説', text: 'A calm reader for long stories.', to: '/novel', cta: 'Start reading', tint: '#f0a63a', ink: '#1a1205' },
  { key: 'movies', name: 'Movies', kanji: '映画', text: 'Films and series, on every server.', to: '/movies', cta: 'Start watching', tint: '#f5f5f7', ink: '#0b0b0e' },
]

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The opening page. Four doors, one open at a time: hover, focus or tap a section to open it,
 * click it again to go in. Keys: 1-4 jump straight in, arrows move between sections.
 */
export default function LandingPage() {
  const navigate = useNavigate()
  const pools = useShowcase()
  const stacked = useCompact('(max-width: 1023px)') // phones and tablets stack the sections as an accordion
  const [active, setActive] = useState<Key>('anime')
  const [picked, setPicked] = useState<Key | null>(null)
  const [now, setNow] = useState<Partial<Record<Key, string>>>({})
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }, [])

  useEffect(() => {
    document.title = 'Zenkai — Watch Anime Online Free in HD · Movies, Manga & Novels'
    return clearTimers
  }, [clearTimers])

  useEffect(() => {
    const step = (d: number) => setActive((k) => SECTIONS[(SECTIONS.findIndex((s) => s.key === k) + d + SECTIONS.length) % SECTIONS.length].key)
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const n = Number(e.key)
      if (n >= 1 && n <= SECTIONS.length) return navigate(SECTIONS[n - 1].to)
      if (e.key === 'ArrowRight' || (stacked && e.key === 'ArrowDown')) (e.preventDefault(), step(1))
      if (e.key === 'ArrowLeft' || (stacked && e.key === 'ArrowUp')) (e.preventDefault(), step(-1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, stacked])

  const onTitle = useCallback((k: Key, title: string) => setNow((p) => (p[k] === title ? p : { ...p, [k]: title })), [])

  /** Can't decide? The doors cycle, slow down, and one stays open. */
  function surprise() {
    clearTimers()
    const start = SECTIONS.findIndex((s) => s.key === active)
    const finish = (k: Key) => {
      setActive(k)
      setPicked(k)
      timers.current.push(window.setTimeout(() => setPicked(null), 1500))
    }
    if (reducedMotion()) return finish(SECTIONS[(start + 1 + Math.floor(Math.random() * (SECTIONS.length - 1))) % SECTIONS.length].key)
    const steps = 7 + Math.floor(Math.random() * SECTIONS.length)
    let t = 0
    for (let i = 1; i <= steps; i++) {
      t += 50 + i * i * 2
      const k = SECTIONS[(start + i) % SECTIONS.length].key
      timers.current.push(window.setTimeout(() => (i === steps ? finish(k) : setActive(k)), t))
    }
  }

  return (
    <main className="relative flex min-h-svh flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
        <Logo size={38} />
        <div className="flex items-center gap-1.5">
          <Link to="/community" className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-muted transition hover:bg-foreground/5 hover:text-foreground active:scale-95">
            <MessageSquare className="size-4" />
            Community
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-6 sm:px-8 lg:py-8">
        <h1 className="animate-card-in text-balance text-center font-display text-[2rem] font-black leading-[1.05] tracking-tight">What are you in the mood for?</h1>

        <div
          role="group"
          aria-label="Choose a section"
          className={cn('mt-6 sm:mt-9', stacked ? 'flex flex-col gap-2.5' : 'flex h-[clamp(26rem,calc(100svh-17rem),38rem)] gap-3')}
        >
          {SECTIONS.map((s, i) => (
            <Panel key={s.key} s={s} index={i} active={active === s.key} picked={picked === s.key} stacked={stacked} images={pools[s.key]} title={now[s.key]} onActivate={setActive} onTitle={onTitle} />
          ))}
        </div>

        <div className="mt-5 flex justify-center sm:mt-6">
          <button type="button" onClick={surprise} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:border-foreground/30 hover:text-foreground active:scale-95">
            <Shuffle className="size-4" />
            Can’t decide? Surprise me
          </button>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 pb-6 text-xs text-muted sm:px-8">
        <Link to="/app" className="inline-flex items-center gap-1.5 font-medium transition hover:text-foreground">
          <Smartphone className="size-3.5" />
          Get the Android app
        </Link>
        <span className="hidden lg:inline">Press 1–4 to jump in, or use the arrow keys to look around</span>
      </footer>
    </main>
  )
}

/**
 * One section. On desktop the open one grows and the others fold into vertical kanji strips;
 * on phones they stack and the open one unfolds. Artwork rotates on its own (see FadeSlideshow).
 * On touch, the first tap opens a section and the second goes in.
 */
function Panel({
  s,
  index,
  active,
  picked,
  stacked,
  images,
  title,
  onActivate,
  onTitle,
}: {
  s: Section
  index: number
  active: boolean
  picked: boolean
  stacked: boolean
  images: ShowcaseImage[]
  title?: string
  onActivate: (k: Key) => void
  onTitle: (k: Key, title: string) => void
}) {
  const onClick = (e: RMouseEvent) => {
    const touchy = stacked || window.matchMedia('(hover: none)').matches
    if (touchy && !active) {
      e.preventDefault()
      onActivate(s.key)
    }
  }

  const style = {
    animationDelay: `${120 + index * 90}ms`,
    background: `linear-gradient(160deg, color-mix(in srgb, ${s.tint} 24%, #08080a), #08080a 72%)`,
    boxShadow: active ? `0 30px 70px -36px ${s.tint}` : undefined,
  } as CSSProperties

  const cta = (
    <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-[gap] group-hover:gap-3" style={{ background: s.tint, color: s.ink }}>
      {s.cta}
      <ArrowUpRight className="size-4" />
    </span>
  )

  return (
    <Link
      to={s.to}
      aria-label={`${s.name}: ${s.cta.toLowerCase()}`}
      aria-current={active ? 'true' : undefined}
      onClick={onClick}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse' && !stacked) onActivate(s.key)
      }}
      onFocus={(e) => {
        if (e.currentTarget.matches(':focus-visible')) onActivate(s.key)
      }}
      style={style}
      className={cn(
        'group relative isolate block animate-card-in overflow-hidden rounded-[1.5rem] text-white outline-none duration-500 ease-[cubic-bezier(.22,.8,.2,1)] focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none sm:rounded-[1.75rem]',
        picked ? 'ring-2 ring-white/80' : 'ring-1 ring-white/10',
        stacked ? cn('w-full shrink-0 transition-[height,box-shadow]', active ? 'h-[min(19rem,44svh)]' : 'h-[4.5rem]') : cn('h-full min-w-[4.75rem] transition-[flex-grow,box-shadow]', active ? 'flex-[4]' : 'flex-1'),
      )}
    >
      <FadeSlideshow
        images={images}
        preferWide={stacked}
        interval={7600 + index * 1300}
        delay={200 + index * 400}
        className="-z-20"
        imgClassName="transition-transform duration-700 group-hover:scale-[1.04]"
        onChange={(im) => onTitle(s.key, im.title)}
      />
      {/* closed sections sit back; the open one lights up */}
      <span aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 bg-black transition-opacity duration-500', active ? 'opacity-0' : 'opacity-55')} />
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />

      {stacked ? (
        <div className={cn('absolute inset-0 flex flex-col p-4 sm:p-5', active ? 'justify-end' : 'justify-center')}>
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-black leading-none" style={{ color: s.tint }}>{s.kanji}</span>
            <h2 className="font-display text-xl font-black tracking-tight">{s.name}</h2>
            <ChevronDown className={cn('ml-auto size-5 text-white/60 transition-transform duration-500', active && 'rotate-180')} />
          </div>
          <div className={cn('grid transition-[grid-template-rows,opacity] duration-500', active ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
            <div className="min-h-0 overflow-hidden" aria-hidden={!active}>
              <p className="max-w-[34ch] text-sm leading-snug text-white/80">{s.text}</p>
              {cta}
              {title && <p className="mt-3 truncate text-xs text-white/55">Now showing: {title}</p>}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* closed: a vertical strip */}
          <div aria-hidden={active} className={cn('absolute inset-0 flex flex-col items-center justify-between py-6 transition-opacity duration-300', active ? 'pointer-events-none opacity-0' : 'opacity-100 delay-200')}>
            <span className="text-xs font-bold tabular-nums text-white/50">{index + 1}</span>
            <span className="font-display text-4xl font-black [writing-mode:vertical-rl]" style={{ color: s.tint }}>{s.kanji}</span>
            <span className="rotate-180 font-display text-sm font-bold tracking-wide text-white/80 [writing-mode:vertical-rl]">{s.name}</span>
          </div>

          {/* open: the full panel */}
          <div aria-hidden={!active} className={cn('absolute inset-0 flex flex-col justify-end overflow-hidden p-8 transition-opacity duration-300', active ? 'opacity-100 delay-200' : 'pointer-events-none opacity-0')}>
            <span aria-hidden className="pointer-events-none absolute right-6 top-4 select-none font-display text-[7rem] font-black leading-none opacity-[0.16] [writing-mode:vertical-rl]" style={{ color: s.tint }}>{s.kanji}</span>
            <kbd className="absolute left-8 top-7 rounded-md border border-white/20 px-1.5 py-0.5 font-sans text-[11px] text-white/60">{index + 1}</kbd>
            <div className="min-w-[20rem]">
              <h2 className="font-display text-5xl font-black tracking-tight">{s.name}</h2>
              <p className="mt-2 max-w-[32ch] text-base leading-snug text-white/80">{s.text}</p>
              {cta}
            </div>
            {title && <p className="absolute bottom-8 right-8 max-w-[40%] truncate text-xs text-white/55">Now showing: {title}</p>}
          </div>
        </>
      )}
    </Link>
  )
}
