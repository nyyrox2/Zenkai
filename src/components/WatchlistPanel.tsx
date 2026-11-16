import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Heart, LayoutGrid, List as ListIcon, Search, Star } from 'lucide-react'
import { STATUS_LABEL, type CustomListDef, type ListStatus } from '../lib/library'
import { cn } from '../lib/utils'

/** Anything that looks like a saved anime (local list items and rows fetched from other users' profiles). */
export interface WatchItem {
  id: number | string
  title: string
  image?: string | null
  score?: number | null
  status?: ListStatus
  progress?: number
  episodes?: number | null
  favorite?: boolean
  customLists?: string[]
  addedAt?: number
}

type Tab = 'all' | ListStatus | 'favorites' | `list:${string}`
type Sort = 'recent' | 'title' | 'score'

const STATUSES = Object.keys(STATUS_LABEL) as ListStatus[]

/**
 * Black-and-white library: status tabs, favourites, custom named lists, search, sort and grid / list views.
 * No brand colour in here on purpose: the posters carry the colour.
 */
export function WatchlistPanel({
  items,
  lists = [],
  onStatus,
  emptyTitle = 'Nothing here yet',
  emptyHint,
}: {
  items: WatchItem[]
  lists?: CustomListDef[]
  /** When given, each card gets a status picker (your own list). */
  onStatus?: (id: number, s: ListStatus) => void
  emptyTitle?: string
  emptyHint?: string
}) {
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const tabs = useMemo(() => {
    const t: { id: Tab; label: string; count: number; heart?: boolean }[] = [
      { id: 'all', label: 'All', count: items.length },
      ...STATUSES.map((s) => ({ id: s as Tab, label: STATUS_LABEL[s], count: items.filter((i) => i.status === s).length })),
      { id: 'favorites', label: 'Favourites', count: items.filter((i) => i.favorite).length, heart: true },
      ...lists.map((l) => ({ id: `list:${l.id}` as Tab, label: l.name, count: items.filter((i) => i.customLists?.includes(l.id)).length })),
    ]
    // Hide empty status tabs, but always keep All and Favourites so the layout stays predictable.
    return t.filter((x) => x.id === 'all' || x.id === 'favorites' || x.count > 0 || x.id.startsWith('list:'))
  }, [items, lists])

  const shown = useMemo(() => {
    let out = items.filter((i) => {
      if (tab === 'all') return true
      if (tab === 'favorites') return !!i.favorite
      if (tab.startsWith('list:')) return !!i.customLists?.includes(tab.slice(5))
      return i.status === tab
    })
    const needle = q.trim().toLowerCase()
    if (needle) out = out.filter((i) => i.title.toLowerCase().includes(needle))
    return [...out].sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : sort === 'score' ? (b.score || 0) - (a.score || 0) : (b.addedAt || 0) - (a.addedAt || 0)))
  }, [items, tab, q, sort])

  const activeLabel = tabs.find((x) => x.id === tab)?.label ?? 'this list'

  return (
    <div className="space-y-4">
      {/* tabs */}
      <div role="tablist" aria-label="Watchlist sections" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0">
        {tabs.map((x) => {
          const on = tab === x.id
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setTab(x.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95',
                on ? 'border-foreground bg-foreground text-background' : 'border-border text-muted hover:border-foreground/40 hover:text-foreground',
              )}
            >
              {x.heart && <Heart className={cn('size-3', on && 'fill-current')} />}
              <span className="max-w-[9rem] truncate">{x.label}</span>
              <span className={cn('tabular-nums', on ? 'opacity-60' : 'text-muted/70')}>{x.count}</span>
            </button>
          )
        })}
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your list"
            aria-label="Search this list"
            className="h-10 w-full rounded-full border border-border bg-transparent pl-10 pr-4 text-sm outline-none placeholder:text-muted focus:border-foreground/60"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort"
          className="h-10 shrink-0 rounded-full border border-border bg-transparent px-3 text-xs font-semibold text-foreground outline-none focus:border-foreground/60"
        >
          <option value="recent">Recent</option>
          <option value="title">A to Z</option>
          <option value="score">Top rated</option>
        </select>
        <div className="flex shrink-0 rounded-full border border-border p-0.5">
          {([['grid', LayoutGrid, 'Grid view'], ['list', ListIcon, 'List view']] as const).map(([id, Icon, label]) => (
            <button key={id} type="button" aria-label={label} aria-pressed={view === id} onClick={() => setView(id)} className={cn('grid size-9 place-items-center rounded-full transition', view === id ? 'bg-foreground text-background' : 'text-muted hover:text-foreground')}>
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {/* content */}
      {shown.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-border px-6 py-14 text-center">
          <Bookmark className="size-9 text-muted/60" />
          <p className="mt-3 text-sm font-semibold">{items.length === 0 ? emptyTitle : q ? `No match for “${q}”` : `Nothing in ${activeLabel} yet`}</p>
          {items.length === 0 && emptyHint && <p className="mt-1 max-w-sm text-xs text-muted">{emptyHint}</p>}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map((i) => {
            const pct = i.progress && i.episodes ? Math.min(100, (i.progress / i.episodes) * 100) : 0
            return (
              <div key={i.id} className="group/card">
                <Link to={`/anime/${i.id}`} className="block outline-none">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-card-2 ring-1 ring-white/10 transition duration-200 group-hover/card:ring-foreground/40 group-active/card:scale-[0.98]">
                    {i.image && <img src={i.image} alt={i.title} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover/card:scale-105" />}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
                    {i.score ? (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                        <Star className="size-2.5 fill-current" />
                        {i.score}
                      </span>
                    ) : null}
                    {i.favorite && (
                      <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md" aria-label="Favourite">
                        <Heart className="size-3 fill-current" />
                      </span>
                    )}
                    <div className="absolute inset-x-2.5 bottom-2.5 text-white">
                      {i.progress ? <p className="text-[10px] font-semibold text-white/80">Ep {i.progress}{i.episodes ? ` / ${i.episodes}` : ''}</p> : null}
                      {pct > 0 && (
                        <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/25">
                          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="mt-2 line-clamp-1 text-xs font-bold sm:text-sm">{i.title}</h3>
                  {i.status && !onStatus && <p className="text-[11px] text-muted">{STATUS_LABEL[i.status]}</p>}
                </Link>
                {onStatus && i.status && (
                  <select aria-label={`Status for ${i.title}`} value={i.status} onChange={(e) => onStatus(Number(i.id), e.target.value as ListStatus)} className="mt-1.5 w-full rounded-full border border-border bg-transparent px-3 py-1 text-[11px] font-medium outline-none focus:border-foreground/60">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border">
          {shown.map((i) => {
            const pct = i.progress && i.episodes ? Math.min(100, (i.progress / i.episodes) * 100) : 0
            return (
              <li key={i.id} className="flex items-center gap-3 p-2.5 transition hover:bg-foreground/[0.04]">
                <Link to={`/anime/${i.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-xl bg-card-2 ring-1 ring-white/10">{i.image && <img src={i.image} alt="" loading="lazy" className="size-full object-cover" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">{i.title}</span>
                      {i.favorite && <Heart className="size-3 shrink-0 fill-current" aria-label="Favourite" />}
                    </span>
                    <span className="block text-xs text-muted">
                      {i.status ? STATUS_LABEL[i.status] : ''}
                      {i.progress ? ` · Ep ${i.progress}${i.episodes ? ` / ${i.episodes}` : ''}` : ''}
                    </span>
                    {pct > 0 && (
                      <span className="mt-1.5 block h-0.5 max-w-[10rem] overflow-hidden rounded-full bg-foreground/15">
                        <span className="block h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </span>
                </Link>
                {i.score ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold tabular-nums">
                    <Star className="size-3 fill-current" />
                    {i.score}
                  </span>
                ) : null}
                {onStatus && i.status && (
                  <select aria-label={`Status for ${i.title}`} value={i.status} onChange={(e) => onStatus(Number(i.id), e.target.value as ListStatus)} className="hidden shrink-0 rounded-full border border-border bg-transparent px-2.5 py-1 text-[11px] font-medium outline-none focus:border-foreground/60 sm:block">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
