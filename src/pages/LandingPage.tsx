import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, BookOpen, Clapperboard, Film, Library, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { AuroraBackground } from '../components/AuroraBackground'
import { BlurText } from '../components/BlurText'
import { DotPattern } from '../components/DotPattern'
import { FadeSlideshow } from '../components/FadeSlideshow'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { useCompact, useShowcase } from '../hooks/useShowcase'
import type { ShowcaseImage } from '../services/showcase'

interface Section {
  key: 'anime' | 'manga' | 'novel' | 'movies'
  name: string
  kanji: string
  icon: LucideIcon
  text: string
  /** where it goes; sections without a web home yet have none */
  to?: string
  badge: string
  hint: string
}

const SECTIONS: Section[] = [
  { key: 'anime', name: 'Anime', kanji: 'アニメ', icon: Film, text: 'Stream the latest shows, sub or dub.', to: '/home', badge: '', hint: '1' },
  { key: 'manga', name: 'Manga', kanji: 'マンガ', icon: BookOpen, text: 'Read chapters, saved as you go.', to: '/manga', badge: '', hint: '2' },
  { key: 'novel', name: 'Novels', kanji: '小説', icon: Library, text: 'A calm reader for long stories.', to: '/novel', badge: '', hint: '3' },
  { key: 'movies', name: 'Movies', kanji: '映画', icon: Clapperboard, text: 'Films and series, on every server.', to: '/movies', badge: '', hint: '4' },
]

/** The opening page: pick what to dive into. Anime, Manga and Novels are all live. */
export default function LandingPage() {
  const navigate = useNavigate()
  const [shake, setShake] = useState<string | null>(null)
  const timers = useRef<number[]>([])
  const pools = useShowcase() // random Luffy / Naruto / cover art for each card
  const compact = useCompact('(min-width: 640px) and (max-width: 1023px)') // tablets get the wide banners; phones show a 2x2 grid of portrait cards

  useEffect(() => {
    document.title = 'Zenkai'
    const t = timers.current
    return () => t.forEach(window.clearTimeout)
  }, [])

  const pick = useCallback(
    (s: Section) => {
      if (s.to) return navigate(s.to)
      setShake(s.key)
      timers.current.forEach(window.clearTimeout)
      timers.current = [window.setTimeout(() => setShake(null), 480)]
    },
    [navigate],
  )

  // 1 – 4 jump straight to a section
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const s = SECTIONS.find((x) => x.hint === e.key)
      if (s) pick(s)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pick])

  return (
    <main className="relative isolate flex min-h-svh flex-col overflow-hidden">
      <AuroraBackground />
      <DotPattern className="-z-10 [mask-image:radial-gradient(700px_circle_at_50%_40%,white,transparent)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
        <Logo size={38} />
        <ThemeToggle />
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-5 sm:px-8 sm:py-8 lg:py-12">
        <div className="text-center">
          <BlurText
            text="What are you in the mood for?"
            delay={0.1}
            className="font-display text-[2rem] font-black leading-[1.02] tracking-tight [text-wrap:balance] sm:text-6xl"
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-9 sm:gap-3.5 lg:grid-cols-4 lg:gap-5">
          {SECTIONS.map((s, i) => (
            <PickCard key={s.key} s={s} index={i} shaking={shake === s.key} onPick={pick} images={pools[s.key]} compact={compact} />
          ))}
        </div>

      </div>

      <div className="h-6 sm:h-10" />
    </main>
  )
}

/**
 * One big card. The tilt and the cursor glow are written straight to the element (CSS variables and a transform),
 * so hovering never triggers a React render. Both only react to a real mouse; touch gets the press feedback.
 */
function PickCard({
  s,
  index,
  shaking,
  onPick,
  images,
  compact,
}: {
  s: Section
  index: number
  shaking: boolean
  onPick: (s: Section) => void
  images: ShowcaseImage[]
  compact: boolean
}) {
  const el = useRef<HTMLElement | null>(null)
  const raf = useRef(0)
  const live = !!s.to

  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !el.current) return
    const node = el.current
    const r = node.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      node.style.setProperty('--mx', `${x * 100}%`)
      node.style.setProperty('--my', `${y * 100}%`)
    })
  }
  const leave = () => {
    cancelAnimationFrame(raf.current)
    if (el.current) el.current.style.transform = ''
  }

  const className = cn(
    'group relative isolate flex min-h-[224px] w-full animate-card-in flex-col justify-between overflow-hidden rounded-[1.5rem] border bg-[#08080a] p-4 text-left text-white outline-none transition-[transform,border-color,box-shadow] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] sm:min-h-[240px] sm:rounded-[1.75rem] sm:p-6 lg:min-h-[340px] lg:p-7',
    live ? 'border-white/15 shadow-[0_24px_60px_-28px_var(--accent)] hover:border-accent/70' : 'border-white/10 hover:border-white/25',
    shaking && 'animate-[shake_0.45s_ease-in-out]',
  )
  const style = { '--mx': '50%', '--my': '40%', animationDelay: `${450 + index * 110}ms` } as CSSProperties

  const inner = (
    <>
      {/* rotating artwork: random order, cross-fades by itself; staggered so the three cards never change together */}
      <FadeSlideshow
        images={images}
        preferWide={compact}
        interval={6800 + index * 1100}
        delay={250 + index * 450}
        className="-z-20"
        imgClassName="transition-transform duration-700 group-hover:scale-105"
      />
      {/* scrim keeps the text readable on any artwork */}
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/65 to-black/15" />
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-transparent to-transparent" />
      {/* cursor glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 mix-blend-screen transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(420px circle at var(--mx) var(--my), color-mix(in srgb, var(--accent) ${live ? 22 : 11}%, transparent), transparent 65%)` }}
      />
      <div className="flex items-start justify-between gap-3">
        <span className={cn('grid size-10 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 sm:size-14 sm:rounded-2xl', live ? 'bg-accent text-accent-fg shadow-lg shadow-accent/30' : 'bg-white/10 text-white')}>
          <s.icon className="size-5 sm:size-7" />
        </span>
      </div>

      <div className="mt-5 lg:mt-auto">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-4xl">{s.name}</h2>
        <p className="mt-1 max-w-[30ch] text-xs leading-snug text-white/75 sm:mt-1.5 sm:text-sm sm:leading-relaxed">{s.text}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold sm:mt-4 sm:gap-2 sm:text-sm">
          {!live ? 'Available in the app' : s.key === 'anime' || s.key === 'movies' ? 'Start watching' : 'Start reading'}
          <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>

    </>
  )

  return live ? (
    <Link ref={(n) => void (el.current = n)} to={s.to!} onPointerMove={move} onPointerLeave={leave} style={style} className={className} aria-label={`${s.name}: open`}>
      {inner}
    </Link>
  ) : (
    <button ref={(n) => void (el.current = n)} type="button" onClick={() => onPick(s)} onPointerMove={move} onPointerLeave={leave} style={style} className={className} aria-label={`${s.name}: coming soon`}>
      {inner}
    </button>
  )
}
