import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAsync } from '../hooks/useAsync'
import { fetchCatalog, fetchWatchOrder, type AniLite } from '../services/anilist'
import type { AniCardMedia } from '../types/anime'
import { Img } from './Img'
import { Skeleton } from './Skeleton'
import { cn, formatLabel, pickTitle, stripHtml } from '../lib/utils'

const Label = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-foreground/80 before:h-3 before:w-0.5 before:bg-accent">{children}</p>
)

const Rank = ({ n, top }: { n: number; top?: boolean }) => (
  <span className={cn('w-7 shrink-0 text-center font-display text-xl font-black leading-none tabular-nums', top ? 'text-foreground' : 'text-muted/40')}>{n}</span>
)

const fl = (f?: string | null) => (f ? formatLabel(f) : null)
const meta = (...p: (string | number | null | undefined | false)[]) => p.filter(Boolean).join(' · ')
const countdown = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 } }

/** Left rail: about the show + franchise watch order. */
export function WatchInfoRail({ a, title, id, actions, footer }: { a: AniLite; title: string; id: number; actions?: ReactNode; footer?: ReactNode }) {
  const [more, setMore] = useState(false)
  const next = a.nextAiringEpisode
  return (
    <div className="space-y-5">
      <motion.section {...fade} transition={{ duration: 0.2 }}>
        <Label>About</Label>
        <div className="flex gap-3">
          <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg bg-card-2">
            <Img src={a.coverImage.large ?? ''} alt="" className="size-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-3 text-base font-extrabold leading-snug">{title}</p>
            <p className="mt-1 text-xs font-semibold text-muted">{meta(fl(a.format), a.seasonYear, a.episodes ? `${a.episodes} eps` : null)}</p>
          </div>
        </div>
        {a.genres.length > 0 && <p className="mt-3 text-xs text-muted">{a.genres.slice(0, 4).join(' · ')}</p>}
        {a.description && (
          <p className="mt-2 text-xs font-medium leading-relaxed text-muted">
            <span className={cn(!more && 'line-clamp-4')}>{stripHtml(a.description)}</span>
            <button type="button" onClick={() => setMore((m) => !m)} className="mt-1 block text-[11px] font-semibold text-foreground/70 transition hover:text-foreground">
              {more ? 'Less' : 'More'}
            </button>
          </p>
        )}
        {next && <p className="mt-3 border-t border-border pt-3 text-xs text-muted">Episode {next.episode} airs in <span className="font-semibold text-foreground">{countdown(next.timeUntilAiring)}</span></p>}
        {actions}
      </motion.section>

      <motion.section {...fade} transition={{ duration: 0.2 }}>
        <Label>Watch order</Label>
        <WatchOrder id={id} />
      </motion.section>

      {footer}
    </div>
  )
}

function WatchOrder({ id }: { id: number }) {
  const order = useAsync(() => fetchWatchOrder(id), [id])
  if (order.loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
  const list = order.data ?? []
  if (list.length < 2) return <p className="text-xs text-muted">No other entries in this franchise.</p>
  return (
    <ol className="max-h-[42vh] overflow-y-auto overscroll-contain scrollbar-none">
      {list.map((e, i) => {
        const cur = e.id === id
        return (
          <li key={e.id}>
            <Link
              to={`/watch/${e.id}`}
              aria-current={cur ? 'true' : undefined}
              className={cn('group flex items-center gap-2.5 rounded-md border-l-2 py-1.5 pl-1 pr-1.5 transition-colors hover:bg-card-2', cur ? 'border-accent bg-card-2' : 'border-transparent', !e.main && !cur && 'opacity-60 hover:opacity-100')}
            >
              <Rank n={i + 1} top={cur} />
              <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-lg bg-card-2">
                <Img src={e.image ?? ''} alt="" loading="lazy" className="size-full object-cover" />
              </div>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{pickTitle(e.title)}</span>
                <span className="block truncate text-[11px] font-medium text-muted">{meta(fl(e.format), e.year, e.episodes ? `${e.episodes} eps` : null)}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

function Row({ m, i }: { m: AniCardMedia; i: number }) {
  return (
    <li>
      <Link to={`/anime/${m.id}`} className="group flex items-center gap-2.5 rounded-md py-1.5 pl-1 pr-1.5 transition-colors hover:bg-card-2">
        <Rank n={i + 1} top={i === 0} />
        <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-lg bg-card-2">
          <Img src={m.coverImage.large ?? ''} alt="" loading="lazy" className="size-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13px] font-bold leading-snug text-foreground/90 group-hover:text-foreground">{pickTitle(m.title)}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted">{meta(fl(m.format), m.episodes ? `${m.episodes} eps` : null)}</p>
        </div>
      </Link>
    </li>
  )
}

const Skel = () => <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>

/** Right rail (when no watch party is open): top rated in the same genres + what is trending. */
export function WatchRecsRail({ a, id, cols }: { a: AniLite; id: number; cols?: boolean }) {
  const picks = useAsync(async () => {
    const own = new Set(a.genres)
    const pages = await Promise.all(a.genres.slice(0, 2).map((g) => fetchCatalog({ genre: g, sort: 'SCORE_DESC', minPopularity: 20000 }, 1)))
    const seen = new Set<number>([id])
    const out: AniCardMedia[] = []
    for (const p of pages) for (const m of p.items) if (!seen.has(m.id)) (seen.add(m.id), out.push(m))
    const shared = (m: AniCardMedia) => m.genres.filter((g) => own.has(g)).length
    return out.sort((x, y) => shared(y) - shared(x) || (y.averageScore ?? 0) - (x.averageScore ?? 0)).slice(0, 8)
  }, [id])
  const trending = useAsync(async () => (await fetchCatalog({ sort: 'TRENDING_DESC' }, 1)).items, [])
  const skip = new Set([id, ...(picks.data ?? []).map((m) => m.id)])
  const hot = (trending.data ?? []).filter((m) => !skip.has(m.id)).slice(0, 5)

  return (
    <div className={cn(cols ? 'grid gap-6 sm:grid-cols-2' : 'space-y-5')}>
      <section>
        <Label>More like this</Label>
        {picks.loading ? <Skel /> : (picks.data?.length ?? 0) > 0 ? <ul>{picks.data!.map((m, i) => <Row key={m.id} m={m} i={i} />)}</ul> : <p className="text-xs text-muted">Nothing similar found.</p>}
      </section>
      {(trending.loading || hot.length > 0) && (
        <section>
          <Label>Trending now</Label>
          {trending.loading ? <Skel /> : <ul>{hot.map((m, i) => <Row key={m.id} m={m} i={i} />)}</ul>}
        </section>
      )}
    </div>
  )
}
