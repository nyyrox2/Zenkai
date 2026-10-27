import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { ArrowUpRight, BookOpen, Check, ChevronDown, Film, Library, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { APP_INFO_URL, timeAgo } from '../lib/app'
import { cn, compact } from '../lib/utils'
import { useAppRelease } from '../services/release'
import { ApkButton } from './ApkButton'
import { PhoneMockup, type PhoneScreen } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Skeleton } from './Skeleton'

const TABS: { key: PhoneScreen; label: string; icon: LucideIcon; text: string; chip: string }[] = [
  { key: 'anime', label: 'Anime', icon: Film, text: 'Stream from multiple servers, keep watching in Picture-in-Picture and download episodes for offline.', chip: 'Picture-in-Picture' },
  { key: 'manga', label: 'Manga', icon: BookOpen, text: 'Read left-to-right or right-to-left. Progress stays in sync and chapters download for offline.', chip: 'RTL and LTR modes' },
  { key: 'novels', label: 'Novels', icon: Library, text: 'A clean, distraction-free reader built for long stories.', chip: 'Distraction-free reader' },
]

const DESKTOP = '(max-width: 1023.98px)'
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(DESKTOP)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
/** True below the lg breakpoint. The banner is for phones and tablets, so on laptops it is not rendered at all (and fetches nothing). */
const useHandheld = () => useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => true)

/** Last section of the home page, phones and tablets only. Version, date, notes and counts are live from GitHub. */
export function AppPromo({ posters }: { posters?: string[] }) {
  return useHandheld() ? <AppPromoCard posters={posters} /> : null
}

function AppPromoCard({ posters }: { posters?: string[] }) {
  const { data, failed } = useAppRelease()
  const rel = data?.latest ?? null
  const notes = rel?.sections.flatMap((s) => s.items).slice(0, 6) ?? []
  const [index, setIndex] = useState(0)
  const [auto, setAuto] = useState(true)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-80px' })
  const tab = TABS[index]

  // rotate through the three screens until the visitor takes over
  useEffect(() => {
    if (!auto || !inView || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => setIndex((n) => (n + 1) % TABS.length), 4500)
    return () => window.clearTimeout(t)
  }, [auto, inView, index])

  const go = (n: number) => {
    setAuto(false)
    setIndex((n + TABS.length) % TABS.length)
  }

  const stats = [
    { label: 'Latest', value: rel ? `v${rel.version}` : null },
    { label: 'Downloads', value: data ? compact(data.totalDownloads) : null },
    { label: 'GitHub stars', value: data ? compact(data.stars) : null },
  ]

  return (
    <section id="app" aria-labelledby="app-promo-title" className="mx-auto w-full max-w-xl px-4 sm:px-6">
      <Reveal>
        <div ref={ref} className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-card p-5 sm:p-7">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{ background: 'radial-gradient(80% 45% at 50% 38%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 70%), radial-gradient(60% 30% at 0% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%)' }}
          />

          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3.5 py-1.5 text-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            {rel ? (
              <span className="text-muted">
                <span className="font-semibold text-foreground">v{rel.version}</span> released {timeAgo(rel.publishedAt)}
              </span>
            ) : (
              <span className="text-muted">{failed ? 'Latest release on GitHub' : 'Checking the latest release'}</span>
            )}
          </p>

          <h2 id="app-promo-title" className="mt-4 font-display text-3xl font-black leading-[1.05] tracking-tight [text-wrap:balance]">
            Take Zenkai with you.
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">Anime, manga and novels in one Android app, with your library synced to your account.</p>

          {/* Interactive stage: pick a tab, swipe, or let it rotate */}
          <div role="tablist" aria-label="What the app does" className="relative mt-5 grid grid-cols-3 rounded-full border border-border bg-background/70 p-1">
            {TABS.map((t, i) => {
              const on = i === index
              return (
                <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => go(i)} className={cn('relative flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors', on ? 'text-background' : 'text-muted')}>
                  {on && <motion.span layoutId="apk-tab" aria-hidden className="absolute inset-0 rounded-full bg-foreground" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <t.icon className="relative size-4" />
                  <span className="relative">{t.label}</span>
                </button>
              )
            })}
          </div>

          <motion.div
            className="relative mt-4 h-[300px] overflow-hidden rounded-3xl border border-border bg-background/40 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]"
            style={{ touchAction: 'pan-y' }}
            onPanEnd={(_, info) => {
              if (Math.abs(info.offset.y) > 50) return
              if (info.offset.x < -50) go(index + 1)
              else if (info.offset.x > 50) go(index - 1)
            }}
          >
            <PhoneMockup posters={posters} screen={tab.key} className="absolute left-1/2 top-8 w-[200px] -translate-x-1/2 rotate-[4deg]" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
            <AnimatePresence mode="wait">
              <motion.span
                key={tab.key}
                className="absolute left-3 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3.5 py-2 text-xs font-semibold text-white shadow-xl"
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <Check className="size-3.5 text-emerald-400" />
                {tab.chip}
              </motion.span>
            </AnimatePresence>
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={tab.key} className="mt-4 min-h-[3.75rem] text-[15px] leading-relaxed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {tab.text}
            </motion.p>
          </AnimatePresence>

          <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-background/40 text-center">
            {stats.map((s) => (
              <div key={s.label} className="px-2 py-3">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-xl font-black tabular-nums">{s.value ?? (failed ? '-' : <Skeleton className="mx-auto h-6 w-12" />)}</dd>
                <div aria-hidden className="text-xs text-muted">{s.label}</div>
              </div>
            ))}
          </dl>

          <ApkButton className="mt-5 w-full justify-center" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <a href={APP_INFO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-border bg-background/70 text-sm font-semibold transition active:scale-95">
              Know more
              <ArrowUpRight className="size-4" />
            </a>
            <Link to="/app" className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-background/70 text-sm font-semibold transition active:scale-95">
              Install guide
            </Link>
          </div>

          {notes.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background/40">
              <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold">
                What is new in v{rel?.version}
                <ChevronDown className={cn('size-5 text-muted transition-transform duration-300', open && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="space-y-2.5 overflow-hidden px-4 text-sm text-muted">
                    {notes.map((n, i) => (
                      <li key={n.text} className={cn('flex gap-3', i === 0 && 'pt-1', i === notes.length - 1 && 'pb-4')}>
                        <span aria-hidden className="w-5 shrink-0 text-center">{n.icon ?? <Check className="mx-auto mt-0.5 size-4 text-accent" />}</span>
                        <span>{n.text}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Reveal>
    </section>
  )
}
