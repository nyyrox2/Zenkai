import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpDown, AudioLines, LayoutGrid, List, Play, Search } from 'lucide-react'
import type { EpInfo, EpKind } from '../services/api'
import { cn } from '../lib/utils'
import { Tabs } from './Tabs'

const PAGE = 25
const ctl = 'grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card/60 transition hover:bg-card active:scale-90'

/** Non-canon labels (canon episodes carry none). Shared with the player. */
export const KIND: Record<EpKind, { label: string; cls: string }> = {
  filler: { label: 'Filler', cls: 'border-amber-400/50 bg-amber-400/10 text-amber-300' },
  mixed: { label: 'Mixed', cls: 'border-sky-400/50 bg-sky-400/10 text-sky-300' },
  recap: { label: 'Recap', cls: 'border-violet-400/50 bg-violet-400/10 text-violet-300' },
}

const fmtAir = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null)

/** Episode browser: range pills, list or card layout, search + sort. TMDB/AniList info per episode, cover art when an episode has no still. */
export function EpisodeList({
  total,
  available,
  current,
  hrefFor,
  info,
  fallbackImg,
  defaultRuntime,
  badge = 'Now playing',
  kinds,
  onPick,
}: {
  total: number
  /** highest episode that has aired */
  available: number
  current?: number
  hrefFor: (ep: number) => string
  info: Map<number, EpInfo>
  fallbackImg?: string | null
  defaultRuntime?: number | null
  badge?: string
  /** filler / mixed / recap episodes, canon is absent */
  kinds?: Map<number, EpKind>
  onPick?: (ep: number) => void
}) {
  const pages = Math.ceil(total / PAGE)
  const [page, setPage] = useState(() => Math.max(0, Math.floor(((current ?? 1) - 1) / PAGE)))
  const [card, setCard] = useState(() => localStorage.getItem('zk:eplayout') === 'card')
  const [desc, setDesc] = useState(false)
  const [q, setQ] = useState('')
  const [hideNon, setHideNon] = useState(false)
  const counts = useMemo(() => {
    const c: Record<EpKind, number> = { filler: 0, mixed: 0, recap: 0 }
    kinds?.forEach((k, n) => n <= total && c[k]++)
    return c
  }, [kinds, total])
  const anyKind = counts.filler + counts.mixed + counts.recap > 0
  useEffect(() => {
    if (current) setPage(Math.floor((current - 1) / PAGE))
  }, [current])

  const toggleLayout = () =>
    setCard((c) => {
      try {
        localStorage.setItem('zk:eplayout', c ? 'list' : 'card')
      } catch {
        /* ignore */
      }
      return !c
    })

  const from = page * PAGE + 1
  const to = Math.min(total, from + PAGE - 1)
  const nums = useMemo(() => {
    const term = q.trim().toLowerCase()
    let list = Array.from({ length: total }, (_, i) => i + 1)
    // ponytail: search scans every episode, paging only applies when the box is empty
    list = term ? list.filter((n) => String(n) === term || (info.get(n)?.name ?? '').toLowerCase().includes(term)).slice(0, 60) : list.slice(from - 1, to)
    if (hideNon && kinds) list = list.filter((n) => { const k = kinds.get(n); return k !== 'filler' && k !== 'recap' })
    return desc ? list.reverse() : list
  }, [q, total, from, to, info, desc, hideNon, kinds])

  const ranges = Array.from({ length: pages }, (_, i) => ({ id: String(i), label: `${i * PAGE + 1}–${Math.min(total, (i + 1) * PAGE)}` }))

  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search episode…"
            aria-label="Search episodes"
            className="h-10 w-full rounded-full border border-border bg-card/60 pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        <button type="button" onClick={() => setDesc((d) => !d)} aria-label="Reverse order" aria-pressed={desc} className={cn(ctl, desc && 'border-accent text-accent')}>
          <ArrowUpDown className="size-4" />
        </button>
        <button type="button" onClick={toggleLayout} aria-label={card ? 'Switch to list' : 'Switch to cards'} className={ctl}>
          {card ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
        </button>
      </div>

      {pages > 1 && !q && (
        <div className="mt-3">
          <Tabs tabs={ranges} value={String(page)} onChange={(v) => setPage(Number(v))} />
        </div>
      )}

      <div className="mb-3 mt-5">
        <h2 className="font-display text-xl font-bold sm:text-2xl">Episodes</h2>
        <p className="text-sm text-muted">{q ? `${nums.length} found` : `${from}–${to} of ${total}`}</p>
        {anyKind && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(['filler', 'mixed', 'recap'] as const).map((k) => counts[k] > 0 && <span key={k} className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase', KIND[k].cls)}>{counts[k]} {KIND[k].label}</span>)}
            {counts.filler + counts.recap > 0 && (
              <button type="button" onClick={() => setHideNon((h) => !h)} aria-pressed={hideNon} className={cn('rounded-full border px-3 py-0.5 text-[11px] font-semibold transition', hideNon ? 'border-transparent bg-foreground text-background' : 'border-border text-muted hover:text-foreground')}>
                Hide filler
              </button>
            )}
          </div>
        )}
      </div>

      {nums.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">No episodes match.</p>
      ) : (
        <ul className={cn('gap-3', card ? 'grid sm:grid-cols-2 2xl:grid-cols-3' : 'flex flex-col')}>
          {nums.map((n) => {
            const e = info.get(n)
            const aired = n <= available
            const on = n === current
            const img = e?.image ?? fallbackImg ?? null
            const mins = e?.runtime ?? defaultRuntime
            const air = fmtAir(e?.air ?? null)
            const kind = kinds?.get(n)
            const name = e?.name ?? `Episode ${n}`
            const body = (
              <>
                <div className={cn('relative shrink-0 overflow-hidden rounded-2xl bg-card-2', card ? 'aspect-video w-full' : 'aspect-video w-36 sm:w-52')}>
                  {img && <img src={img} alt="" loading="lazy" decoding="async" className={cn('h-full w-full object-cover transition duration-500', aired && 'group-hover:scale-105', !e?.image && 'opacity-60 blur-[1px]')} />}
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {kind && <span className={cn('absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase backdrop-blur', KIND[kind].cls, 'bg-black/70')}>{KIND[kind].label}</span>}
                  {card ? (
                    <>
                      <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">Episode {n}</span>
                      {mins ? <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{mins}m</span> : null}
                    </>
                  ) : (
                    <span className="absolute bottom-1.5 left-2.5 font-display text-lg font-black text-white drop-shadow">{n}</span>
                  )}
                  {aired && (
                    <span className={cn('absolute grid size-9 place-items-center rounded-full border border-white/30 bg-black/50 text-white backdrop-blur', card ? 'left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2' : 'bottom-1.5 right-2')}>
                      {on ? <AudioLines className="size-4" /> : <Play className="size-4 fill-current" />}
                    </span>
                  )}
                </div>
                <div className={cn('min-w-0 flex-1', card ? 'px-1 pb-1 pt-3' : 'py-0.5')}>
                  <p className={cn('font-semibold leading-snug', card ? 'line-clamp-1 text-lg' : 'line-clamp-2 text-base sm:text-lg')}>{name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted sm:text-sm">
                    {!card && <span>Ep {n}</span>}
                    {!card && mins ? <span>· {mins} min</span> : null}
                    {air && <span>{card ? '' : '· '}{air}</span>}
                    {kind && <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', KIND[kind].cls)}>{KIND[kind].label}</span>}
                    {!aired && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase">Not aired</span>}
                    {on && <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-background">{badge}</span>}
                  </p>
                  {e?.overview && <p className={cn('mt-2 text-sm leading-relaxed text-muted', card ? 'line-clamp-2' : 'line-clamp-2 max-sm:hidden')}>{e.overview}</p>}
                </div>
              </>
            )
            const cls = cn(
              'group flex rounded-3xl border p-2.5 transition sm:p-3',
              card ? 'flex-col' : 'items-center gap-3 sm:gap-4',
              on ? 'border-white/40 bg-white/[0.07]' : 'border-border bg-card/60',
              aired ? 'hover:bg-card active:scale-[0.99]' : 'cursor-not-allowed opacity-45',
            )
            return (
              <li key={n}>
                {aired ? (
                  <Link to={hrefFor(n)} onClick={() => onPick?.(n)} className={cls} aria-current={on ? 'true' : undefined}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls} title="Not aired yet">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
