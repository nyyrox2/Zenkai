import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Film, Info, Play, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AniMedia, AniTrailer } from '../types/anime'
import { fetchTmdb, tmdbImg, type Tmdb } from '../services/api'
import { useTmdb } from '../hooks/useTmdb'
import { meta as toMeta, toggleList, useListItem } from '../lib/library'
import { mediaToCard } from '../lib/mappers'
import { cn, formatLabel, formatStatus, pickTitle, stripHtml, toScore10 } from '../lib/utils'
import { BlurText } from './BlurText'
import { Magnet } from './Magnet'
import { TrailerModal } from './TrailerModal'

const INTERVAL = 9000

/** Backdrop: AniList banner shows instantly, the TMDB backdrop fades in over it once it has loaded. */
function Backdrop({ item, tmdb }: { item: AniMedia; tmdb: Tmdb | null }) {
  const [ready, setReady] = useState(false)
  const base = item.bannerImage ?? item.coverImage.extraLarge ?? ''
  const hd = tmdbImg(tmdb?.backdrop, 'w1280')
  return (
    <div className="animate-kenburns absolute inset-0 will-change-transform">
      <img src={base} alt="" fetchPriority="high" className={cn('h-full w-full object-cover object-[center_25%]', !item.bannerImage && 'scale-125 blur-2xl')} />
      {hd && (
        <img
          src={hd}
          alt=""
          onLoad={() => setReady(true)}
          className={cn('absolute inset-0 h-full w-full object-cover object-[center_25%] transition-opacity duration-1000', ready ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </div>
  )
}

/** Title: TMDB transparent logo when there is one (centred on phones, left on desktop), blur-in text otherwise. */
function Heading({ title, logo }: { title: string; logo: string | null }) {
  const [ok, setOk] = useState(false)
  const src = tmdbImg(logo, 'w500')
  return (
    <div className="relative flex min-h-[4.5rem] w-full items-end justify-center lg:justify-start">
      {src && (
        <img
          src={src}
          alt={title}
          onLoad={() => setOk(true)}
          onError={() => setOk(false)}
          className={cn(
            'max-h-24 w-auto max-w-[78%] object-contain object-center drop-shadow-[0_6px_28px_rgba(0,0,0,0.7)] transition-all duration-700 sm:max-h-32 lg:max-h-36 lg:max-w-[60%] lg:object-left',
            ok ? 'relative opacity-100' : 'pointer-events-none absolute opacity-0',
          )}
        />
      )}
      {!ok && (
        <BlurText
          text={title}
          className="font-display text-4xl font-black leading-[1.02] tracking-tight text-white drop-shadow-lg [text-wrap:balance] text-center lg:text-left"
        />
      )}
    </div>
  )
}

/** Blur + rise entrance, staggered by `i`. Runs once per slide, which is the only choreographed moment in the hero. */
function Rise({ i, className, children }: { i: number; className?: string; children: ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.1 + i * 0.07, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

const dockBtn = 'grid h-full w-12 place-items-center text-white/90 transition hover:bg-white/15 hover:text-white active:scale-90 focus-visible:bg-white/15 sm:w-14'

function SaveButton({ media }: { media: AniMedia }) {
  const inList = !!useListItem(media.id)
  const Icon = inList ? BookmarkCheck : Bookmark
  const label = inList ? 'Remove from My List' : 'Add to My List'
  return (
    <button type="button" aria-label={label} aria-pressed={inList} title={label} onClick={() => toggleList(toMeta(mediaToCard(media)))} className={cn(dockBtn, inList && 'text-accent hover:text-accent')}>
      <Icon className={cn('size-5', inList && 'fill-current')} />
    </button>
  )
}

/** Full-bleed cinematic hero. Centred stack on phones, left-aligned on desktop; swipe or use the pager to change slide. */
export function HeroCarousel({ items }: { items: AniMedia[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [trailer, setTrailer] = useState<AniTrailer | null>(null)
  const count = items.length
  const item = items[index]
  const bundle = useTmdb(item?.id, item ? pickTitle(item.title) : '', item?.format)
  const tmdb = bundle?.tmdb ?? null

  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count])
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count])
  const pause = useCallback((v: boolean) => {
    setPaused(v)
    if (!v) setEpoch((e) => e + 1)
  }, [])

  // warm the next slide's artwork
  useEffect(() => {
    const n = items[(index + 1) % count]
    if (n) void fetchTmdb(n.id, pickTitle(n.title), n.format)
  }, [index, items, count])

  useEffect(() => {
    const onVis = () => pause(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [pause])

  useEffect(() => {
    if (paused || count < 2 || trailer) return
    const t = window.setTimeout(next, INTERVAL)
    return () => window.clearTimeout(t)
  }, [index, paused, epoch, count, next, trailer])

  if (!item) return null

  const title = pickTitle(item.title)
  // TMDB first, AniList when TMDB has nothing
  const description = tmdb?.overview || stripHtml(item.description)
  const accent = item.coverImage.color ?? '#dc143c'
  const watchable = item.status !== 'NOT_YET_RELEASED'
  const score = tmdb?.rating ?? (item.averageScore ? toScore10(item.averageScore) : null)
  const dot = item.status === 'RELEASING' ? 'bg-emerald-400' : item.status === 'NOT_YET_RELEASED' ? 'bg-amber-400' : 'bg-white/50'
  const facts = [formatLabel(item.format), item.seasonYear, item.genres.slice(0, 2).join(', ')].filter(Boolean)

  return (
    <motion.section
      aria-roledescription="carousel"
      className="relative isolate h-[88svh] max-h-[900px] min-h-[580px] overflow-hidden text-white lg:h-[92svh] lg:max-h-[860px]"
      style={{ touchAction: 'pan-y' }}
      onMouseEnter={() => pause(true)}
      onMouseLeave={() => pause(false)}
      onPanEnd={(_, info) => {
        if (Math.abs(info.offset.y) > 60) return
        if (info.offset.x < -70) next()
        else if (info.offset.x > 70) prev()
      }}
    >
      {/* Media: fades into the page at both ends so the floating navbar and the rows below stay legible in either theme */}
      <div aria-hidden className="absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent,#000_96px,#000_calc(100%_-_80px),transparent)]">
        <AnimatePresence>
          <motion.div key={item.id} className="absolute inset-0" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}>
            <Backdrop item={item} tmdb={tmdb} />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-black/70 via-black/15 to-transparent lg:block" />
        <motion.div
          key={`glow-${item.id}`}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          style={{ background: `radial-gradient(70% 45% at 50% 90%, ${accent}38, transparent 70%)` }}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-7xl flex-col px-5 pb-7 sm:px-8 lg:pb-9">
        <AnimatePresence mode="wait">
          <motion.div key={item.id} className="flex min-w-0 flex-col items-center gap-3.5 text-center lg:items-start lg:text-left" exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <Heading title={title} logo={tmdb?.logo ?? null} />

            <Rise i={1} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[13px] font-medium text-white/75 lg:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn('size-2 rounded-full', dot, item.status === 'RELEASING' && 'animate-pulse')} />
                {formatStatus(item.status)}
              </span>
              {score ? (
                <>
                  <span aria-hidden className="h-3 w-px bg-white/25" />
                  <span className="inline-flex items-center gap-1 text-white">
                    <Star className="size-3.5 fill-amber-300 text-amber-300" />
                    {score}
                  </span>
                </>
              ) : null}
              {tmdb?.certification && (
                <>
                  <span aria-hidden className="h-3 w-px bg-white/25" />
                  <span className="rounded border border-white/40 px-1.5 text-[11px] font-bold leading-4 text-white">{tmdb.certification}</span>
                </>
              )}
              {facts.map((f) => (
                <Fragment key={String(f)}>
                  <span aria-hidden className="h-3 w-px bg-white/25" />
                  <span>{f}</span>
                </Fragment>
              ))}
            </Rise>

            {description && <Rise i={2} className="max-w-md text-sm leading-relaxed text-white/65 lg:max-w-lg"><p className="line-clamp-2">{description}</p></Rise>}

            <Rise i={3} className="mt-1.5 flex items-center justify-center gap-2.5 lg:justify-start">
              <Magnet padding={28}>
                <Link
                  to={watchable ? `/watch/${item.id}` : `/anime/${item.id}`}
                  className="inline-flex h-14 items-center gap-2.5 rounded-full bg-gradient-to-b from-white to-zinc-200 px-8 text-[15px] font-semibold text-black transition active:scale-95"
                  style={{ boxShadow: `0 12px 40px -12px ${accent}` }}
                >
                  {watchable ? <Play className="size-5 fill-current" /> : <Info className="size-5" />}
                  {watchable ? 'Watch now' : 'View details'}
                </Link>
              </Magnet>

              <div className="flex h-14 items-stretch divide-x divide-white/15 overflow-hidden rounded-full border border-white/15 bg-black/45">
                <SaveButton media={item} />
                {item.trailer?.id && (
                  <button type="button" aria-label="Watch trailer" title="Watch trailer" onClick={() => setTrailer(item.trailer)} className={dockBtn}>
                    <Film className="size-5" />
                  </button>
                )}
                {watchable && (
                  <Link to={`/anime/${item.id}`} aria-label="Details" title="Details" className={dockBtn}>
                    <Info className="size-5" />
                  </Link>
                )}
              </div>
            </Rise>
          </motion.div>
        </AnimatePresence>

        {/* Pager: story-style bars on phones, expanding poster strip on desktop */}
        <div role="tablist" aria-label="Featured anime" className="mt-6 flex items-center justify-center gap-1.5 lg:hidden">
          {items.map((it, i) => (
            <button key={it.id} type="button" role="tab" aria-selected={i === index} aria-label={`Show ${pickTitle(it.title)}`} onClick={() => setIndex(i)} className="group flex h-6 max-w-12 flex-1 items-center">
              <span className="relative block h-1 w-full overflow-hidden rounded-full bg-foreground/20">
                {i < index && <span className="absolute inset-0 bg-foreground/60" />}
                {i === index && <span key={`${index}-${epoch}`} className="block h-full origin-left bg-foreground" style={{ animation: `hero-progress ${INTERVAL}ms linear both`, animationPlayState: paused ? 'paused' : 'running' }} />}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-8 hidden items-center gap-4 lg:flex">
          <div role="tablist" aria-label="Featured anime" className="flex items-center gap-2">
            {items.map((it, i) => {
              const on = i === index
              return (
                <motion.button
                  key={it.id}
                  layout
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={`Show ${pickTitle(it.title)}`}
                  onClick={() => setIndex(i)}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  className={cn('relative flex h-[68px] items-center gap-3 overflow-hidden rounded-2xl border bg-black/55 text-left', on ? 'border-white/30 pr-5' : 'border-white/10 opacity-80 hover:opacity-100')}
                >
                  <motion.img layout="position" src={it.coverImage.extraLarge ?? it.bannerImage ?? ''} alt="" loading="lazy" className="h-full w-12 shrink-0 object-cover" />
                  {on && (
                    <span className="min-w-0 max-w-44 pb-1">
                      <span className="line-clamp-1 block text-sm font-semibold text-white">{pickTitle(it.title)}</span>
                      <span className="line-clamp-1 block text-xs text-white/60">{[formatLabel(it.format), it.seasonYear].filter(Boolean).join(' ')}</span>
                    </span>
                  )}
                  {on && (
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
                      <span key={`${index}-${epoch}`} className="block h-full origin-left bg-white" style={{ animation: `hero-progress ${INTERVAL}ms linear both`, animationPlayState: paused ? 'paused' : 'running' }} />
                    </span>
                  )}
                </motion.button>
              )
            })}
          </div>
          <div className="ml-auto flex gap-2">
            {[
              { label: 'Previous', fn: prev, Icon: ChevronLeft },
              { label: 'Next', fn: next, Icon: ChevronRight },
            ].map(({ label, fn, Icon }) => (
              <button key={label} type="button" aria-label={label} onClick={fn} className="grid size-11 place-items-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-white hover:text-black active:scale-90">
                <Icon className="size-5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <TrailerModal trailer={trailer} onClose={() => setTrailer(null)} />
    </motion.section>
  )
}
