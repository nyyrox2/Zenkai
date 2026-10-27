import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Info, Play, Star } from 'lucide-react'
import { cn } from '../lib/utils'
import { img, movieHref, watchHref, type MovieItem } from '../services/movies'
import { BlurText } from './BlurText'
import { Magnet } from './Magnet'
import { Meteors } from './Meteors'
import { ShimmerButton } from './ShimmerButton'

const INTERVAL = 8000

/** Full-bleed trending carousel for the Movies home: Ken Burns backdrop, meteors, black & white. */
export function MovieHero({ items, loading }: { items?: MovieItem[]; loading?: boolean }) {
  const list = (items ?? []).filter((m) => m.backdrop).slice(0, 6)
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)

  useEffect(() => {
    if (list.length < 2 || hold) return
    const t = window.setTimeout(() => setI((n) => (n + 1) % list.length), INTERVAL)
    return () => window.clearTimeout(t)
  }, [i, list.length, hold])

  const m = list[i % Math.max(list.length, 1)]

  return (
    <section
      className="relative isolate flex min-h-[78svh] items-end overflow-hidden bg-black text-white sm:min-h-[86svh]"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
    >
      <AnimatePresence initial={false}>
        {m && (
          <motion.div key={m.type + m.id} className="absolute inset-0 -z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
            <img src={img(m.backdrop, 'w1280') ?? ''} alt="" fetchPriority="high" className="animate-kenburns h-full w-full object-cover object-[center_20%] grayscale-[0.35]" />
          </motion.div>
        )}
      </AnimatePresence>
      {loading && !m && <div className="skeleton absolute inset-0 -z-20" />}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />
      <span aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-background to-transparent" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/25 to-transparent" />
      <Meteors number={14} />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-32 sm:px-6 sm:pb-24">
        <AnimatePresence mode="wait" initial={false}>
          {m && (
            <motion.div key={m.type + m.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45 }} className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 eyebrow text-white/80">
                <span className="rounded-full border border-white/40 px-2 py-0.5">{m.type === 'tv' ? 'Series' : 'Film'}</span>
                Trending this week
              </p>
              <BlurText text={m.title} className="font-display text-4xl font-black leading-[1.02] tracking-tight drop-shadow-lg [text-wrap:balance]" />
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/85">
                {m.rating && (
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Star className="size-4 fill-current" />
                    {m.rating.toFixed(1)}
                  </span>
                )}
                {m.year && <span>{m.year}</span>}
              </div>
              <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/75">{m.overview}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Magnet padding={30}>
                  <ShimmerButton to={watchHref(m)} className="!bg-white !text-black" icon={<Play className="size-4 fill-current" />}>
                    Play
                  </ShimmerButton>
                </Magnet>
                <Link to={movieHref(m)} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/20 active:scale-95">
                  <Info className="size-4" /> Details
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {list.length > 1 && (
          <div className="mt-10 flex gap-2" role="tablist" aria-label="Trending titles">
            {list.map((x, n) => (
              <button
                key={x.type + x.id}
                type="button"
                role="tab"
                aria-selected={n === i}
                aria-label={x.title}
                onClick={() => setI(n)}
                className="relative h-1.5 w-10 overflow-hidden rounded-full bg-white/25"
              >
                {n === i && (
                  <span
                    key={`${i}-${hold}`}
                    className={cn('absolute inset-0 origin-left rounded-full bg-white', !hold && '[animation:hero-progress_8s_linear_forwards]')}
                    style={hold ? { transform: 'scaleX(1)' } : undefined}
                  />
                )}
                {n < i && <span className="absolute inset-0 rounded-full bg-white/70" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
