import { Img } from './Img'
import { HeroLoader } from './HeroLoader'
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

const INTERVAL = 8500

/** Backdrop: TMDB first; the AniList banner only shows when TMDB has none (or fails to load). */
function Backdrop({ item, tmdb, loaded }: { item: AniMedia; tmdb: Tmdb | null; loaded: boolean }) {
  const [ready, setReady] = useState(false)
  const [bad, setBad] = useState(false)
  const base = item.bannerImage ?? item.coverImage.extraLarge ?? ''
  const hd = tmdbImg(tmdb?.backdrop, 'w1280')
  return (
    <div className="animate-kenburns absolute inset-0 will-change-transform">
      {!loaded || (hd && !bad && !ready) ? <HeroLoader /> : null}
      {loaded && (!hd || bad) && <Img src={base} alt="" fetchPriority="high" className={cn('h-full w-full object-cover object-[center_25%]', !item.bannerImage && 'scale-125 blur-2xl')} />}
      {hd && (
        <img
          src={hd}
          alt=""
          fetchPriority="high"
          onLoad={() => setReady(true)}
          onError={() => setBad(true)}
          className={cn('absolute inset-0 h-full w-full object-cover object-[center_25%] transition-opacity duration-1000', ready ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </div>
  )
}

/** Title: TMDB transparent logo when there is one (centred on phones, left on desktop), blur-in text otherwise. */
function Heading({ title, logo, loaded }: { title: string; logo: string | null; loaded: boolean }) {
  const [ok, setOk] = useState(false)
  const [bad, setBad] = useState(false)
  const src = tmdbImg(logo, 'w500')
  useEffect(() => (setOk(false), setBad(false)), [src])
  const text = loaded && (!src || bad)
  return (
    <div className="relative flex min-h-[4.5rem] w-full items-end justify-center lg:justify-start">
      {loaded && src && !bad && (
        <img
          src={src}
          alt={title}
          onLoad={() => setOk(true)}
          onError={() => setBad(true)}
          className={cn(
            'max-h-24 w-auto max-w-[80%] object-contain object-center drop-shadow-[0_8px_32px_rgba(0,0,0,0.85)] transition-all duration-700 sm:max-h-32 lg:max-h-36 lg:max-w-[60%] lg:object-left',
            ok ? 'relative opacity-100' : 'pointer-events-none absolute opacity-0',
          )}
        />
      )}
      {text && (
        <BlurText
          text={title}
          className="font-display text-4xl font-black leading-[1.02] tracking-tight text-white drop-shadow-lg [text-wrap:balance] text-center lg:text-left"
        />
      )}
    </div>
  )
}

/** Blur + rise entrance, staggered by `i`. */
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

function SaveButton({ media }: { media: AniMedia }) {
  const inList = !!useListItem(media.id)
  const Icon = inList ? BookmarkCheck : Bookmark
  const label = inList ? 'Remove from My List' : 'Add to My List'
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={inList}
      title={label}
      onClick={() => toggleList(toMeta(mediaToCard(media)))}
      className={cn(
        'grid size-12 place-items-center rounded-full border backdrop-blur-md transition active:scale-90',
        inList
          ? 'border-accent bg-accent/25 text-accent shadow-md shadow-accent/20'
          : 'border-white/20 bg-black/40 text-white hover:bg-white/20'
      )}
    >
      <Icon className={cn('size-5', inList && 'fill-current')} />
    </button>
  )
}

/** Cinematic hero carousel with dark background blending and zero harsh center seams. */
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

  // Warm the first slides' TMDB data as soon as the list arrives
  useEffect(() => {
    items.slice(0, 4).forEach((n) => void fetchTmdb(n.id, pickTitle(n.title), n.format))
  }, [items])

  // Warm the next slide's artwork
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
  const description = tmdb?.overview || stripHtml(item.description)
  const watchable = item.status !== 'NOT_YET_RELEASED'
  const score = tmdb?.rating ?? (item.averageScore ? toScore10(item.averageScore) : null)
  const dot = item.status === 'RELEASING' ? 'bg-emerald-400' : item.status === 'NOT_YET_RELEASED' ? 'bg-amber-400' : 'bg-white/50'
  const facts = [formatLabel(item.format), item.seasonYear, item.genres.slice(0, 2).join(', ')].filter(Boolean)

  return (
    <motion.section
      aria-roledescription="carousel"
      className="relative isolate h-[76svh] min-h-[520px] max-h-[760px] w-full overflow-hidden text-white lg:h-[82svh] lg:max-h-[820px]"
      style={{ touchAction: 'pan-y' }}
      onMouseEnter={() => pause(true)}
      onMouseLeave={() => pause(false)}
      onPanEnd={(_, info) => {
        if (Math.abs(info.offset.y) > 60) return
        if (info.offset.x < -70) next()
        else if (info.offset.x > 70) prev()
      }}
    >
      {/* Media & Backdrop */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <AnimatePresence>
          <motion.div
            key={item.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          >
            <Backdrop item={item} tmdb={tmdb} loaded={bundle !== null} />
          </motion.div>
        </AnimatePresence>

        {/* Cinematic dark scrims */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
        <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-black/85 via-black/25 to-transparent" />
      </div>

      {/* Seamless cinematic bottom dark gradient: smoothly blends hero into page background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-1 h-44 sm:h-64 bg-gradient-to-t from-background via-background/95 via-background/60 to-transparent z-10"
      />

      <div className="relative z-20 mx-auto flex h-full w-full max-w-7xl flex-col justify-end px-5 pb-6 sm:px-8 lg:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            className="flex min-w-0 flex-col items-center gap-3.5 text-center lg:items-start lg:text-left"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <Heading title={title} logo={tmdb?.logo ?? null} loaded={bundle !== null} />

            <Rise i={1} className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-[13px] font-medium text-white/80 lg:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn('size-2 rounded-full', dot, item.status === 'RELEASING' && 'animate-pulse')} />
                {formatStatus(item.status)}
              </span>
              {score ? (
                <>
                  <span aria-hidden className="text-white/30">|</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-white">
                    <Star className="size-3.5 fill-amber-300 text-amber-300" />
                    {score}
                  </span>
                </>
              ) : null}
              {tmdb?.certification && (
                <>
                  <span aria-hidden className="text-white/30">|</span>
                  <span className="rounded border border-white/40 px-1.5 text-[11px] font-bold leading-4 text-white">{tmdb.certification}</span>
                </>
              )}
              {facts.map((f) => (
                <Fragment key={String(f)}>
                  <span aria-hidden className="text-white/30">|</span>
                  <span>{f}</span>
                </Fragment>
              ))}
            </Rise>

            {description && (
              <Rise i={2} className="max-w-md text-sm leading-relaxed text-white/70 lg:max-w-xl">
                <p className="line-clamp-2 sm:line-clamp-3">{description}</p>
              </Rise>
            )}

            <Rise i={3} className="mt-2 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Magnet padding={28}>
                <Link
                  to={watchable ? `/watch/${item.id}` : `/anime/${item.id}`}
                  className="inline-flex h-12 sm:h-13 items-center gap-2.5 rounded-full bg-white px-7 sm:px-8 text-[15px] font-bold text-black shadow-xl hover:bg-zinc-200 transition active:scale-95"
                >
                  {watchable ? <Play className="size-4.5 fill-current" /> : <Info className="size-4.5" />}
                  {watchable ? 'Watch now' : 'View details'}
                </Link>
              </Magnet>

              <div className="flex items-center gap-2.5">
                <SaveButton media={item} />
                {item.trailer?.id && (
                  <button
                    type="button"
                    aria-label="Watch trailer"
                    title="Watch trailer"
                    onClick={() => setTrailer(item.trailer)}
                    className="grid size-12 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-90"
                  >
                    <Film className="size-5" />
                  </button>
                )}
                {watchable && (
                  <Link
                    to={`/anime/${item.id}`}
                    aria-label="Details"
                    title="Details"
                    className="grid size-12 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-90"
                  >
                    <Info className="size-5" />
                  </Link>
                )}
              </div>
            </Rise>
          </motion.div>
        </AnimatePresence>

        {/* Pager: story-style pill indicator + dots, perfectly matching mobile & desktop */}
        <div className="mt-6 flex items-center justify-between">
          <div role="tablist" aria-label="Featured anime" className="mx-auto flex items-center gap-2 lg:mx-0">
            {items.slice(0, 10).map((it, i) => (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show ${pickTitle(it.title)}`}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-8 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/70'
                )}
              />
            ))}
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {[
              { label: 'Previous', fn: prev, Icon: ChevronLeft },
              { label: 'Next', fn: next, Icon: ChevronRight },
            ].map(({ label, fn, Icon }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                onClick={fn}
                className="grid size-10 place-items-center rounded-full border border-white/20 bg-black/50 text-white transition hover:bg-white hover:text-black active:scale-90"
              >
                <Icon className="size-4.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <TrailerModal trailer={trailer} onClose={() => setTrailer(null)} />
    </motion.section>
  )
}
