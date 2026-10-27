import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { fetchCatalog, type CatalogParams } from '../services/anilist'
import type { AniCardMedia } from '../types/anime'
import { GENRES } from '../lib/constants'
import { mediaToCard } from '../lib/mappers'
import { humanize } from '../lib/utils'
import { AnimeCard } from '../components/AnimeCard'
import { ErrorState } from '../components/ErrorState'
import { GradientText } from '../components/GradientText'
import { CustomSelect, type Option } from '../components/CustomSelect'
import { Skeleton } from '../components/Skeleton'

type Preset = 'trending' | 'popular' | 'top' | 'browse'

const COPY: Record<Preset, { eyebrow: string; title: string; sub: string; sort: string; minPopularity?: number }> = {
  trending: { eyebrow: 'Right now', title: 'Trending', sub: 'What everyone is watching this week.', sort: 'TRENDING_DESC' },
  popular: { eyebrow: 'Fan favourites', title: 'Popular', sub: 'The most-loved anime of all time.', sort: 'POPULARITY_DESC' },
  top: { eyebrow: 'Highest rated', title: 'Top Rated', sub: 'Best scored anime on AniList (with a real audience).', sort: 'SCORE_DESC', minPopularity: 10000 },
  browse: { eyebrow: 'Find your next watch', title: 'Browse', sub: 'Filter by genre, year, season, format and more.', sort: 'POPULARITY_DESC' },
}

const FORMATS = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'TV_SHORT']
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
const STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED']
const SORTS: [string, string][] = [
  ['POPULARITY_DESC', 'Most popular'],
  ['TRENDING_DESC', 'Trending'],
  ['SCORE_DESC', 'Highest rated'],
  ['START_DATE_DESC', 'Newest'],
  ['FAVOURITES_DESC', 'Most favourited'],
]
const YEARS = Array.from({ length: new Date().getFullYear() + 2 - 1980 }, (_, i) => new Date().getFullYear() + 1 - i)

const opts = (label: string, items: Option[]): Option[] => [{ value: '', label: `Any ${label.toLowerCase()}` }, ...items]
const FILTERS = [
  { key: 'genre', label: 'Genre', options: opts('Genre', GENRES.map((g) => ({ value: g.name, label: g.name }))) },
  { key: 'format', label: 'Format', options: opts('Format', FORMATS.map((f) => ({ value: f, label: f === 'TV_SHORT' ? 'TV Short' : ['TV', 'OVA', 'ONA'].includes(f) ? f : humanize(f) }))) },
  { key: 'year', label: 'Year', options: opts('Year', YEARS.map((y) => ({ value: String(y), label: String(y) }))) },
  { key: 'season', label: 'Season', options: opts('Season', SEASONS.map((x) => ({ value: x, label: humanize(x) }))) },
  { key: 'status', label: 'Status', options: opts('Status', STATUSES.map((x) => ({ value: x, label: humanize(x) }))) },
]
const SORT_OPTIONS: Option[] = SORTS.map(([v, l]) => ({ value: v === 'POPULARITY_DESC' ? '' : v, label: l }))

export default function CatalogPage({ preset }: { preset: Preset }) {
  const copy = COPY[preset]
  const [sp, setSp] = useSearchParams()
  const get = (k: string) => sp.get(k) ?? ''

  const [text, setText] = useState(get('q'))
  useEffect(() => setText(get('q')), [preset]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (text !== get('q')) set({ q: text })
    }, 400)
    return () => window.clearTimeout(t)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(patch: Record<string, string>) {
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
        return next
      },
      { replace: true },
    )
  }

  const params: CatalogParams = useMemo(
    () => ({
      search: get('q') || undefined,
      genre: get('genre') || undefined,
      format: get('format') || undefined,
      year: Number(get('year')) || undefined,
      season: get('season') || undefined,
      status: get('status') || undefined,
      sort: (preset === 'browse' && get('sort')) || copy.sort,
      minPopularity: copy.minPopularity,
    }),
    [sp, preset], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const key = JSON.stringify(params)

  const [items, setItems] = useState<AniCardMedia[]>([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    setItems([])
    setPage(1)
    setHasNext(true)
    setError(undefined)
  }, [key])

  useEffect(() => {
    let off = false
    setLoading(true)
    fetchCatalog(params, page)
      .then((r) => {
        if (off) return
        setItems((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          return [...prev, ...r.items.filter((m) => !seen.has(m.id))]
        })
        setHasNext(r.hasNext)
        setError(undefined)
      })
      .catch((e: Error) => !off && setError(e.message))
      .finally(() => !off && setLoading(false))
    return () => {
      off = true
    }
  }, [key, page, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const sentinel = useRef<HTMLDivElement>(null)
  const more = useCallback(() => setPage((p) => p + 1), [])
  useEffect(() => {
    const el = sentinel.current
    if (!el || loading || !hasNext || error) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && more(), { rootMargin: '700px' })
    io.observe(el)
    return () => io.disconnect()
  }, [loading, hasNext, error, more, items.length])

  useEffect(() => {
    document.title = `${copy.title} — Zenkai`
  }, [copy.title])

  const cards = useMemo(() => items.map(mediaToCard), [items])
  const filtered = ['genre', 'format', 'year', 'season', 'status', 'q'].some((k) => get(k))
  const ranked = preset !== 'browse' && !filtered

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6">
      <header>
        <p className="mb-2 eyebrow text-accent">{copy.eyebrow}</p>
        <h1 className="font-display text-4xl font-black tracking-tight">
          <GradientText>{copy.title}</GradientText>
        </h1>
        <p className="mt-3 max-w-xl text-muted">{copy.sub}</p>
      </header>

      <div className="sticky top-[4.5rem] z-30 -mx-4 mt-8 border-y border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          {preset === 'browse' && (
            <label className="relative shrink-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search title…"
                className="h-10 w-44 rounded-full border border-border bg-card/60 pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-56"
              />
            </label>
          )}
          {FILTERS.map(({ key, label, options }) => (
            <CustomSelect key={key} label={label} placeholder={label} value={get(key)} options={options} onChange={(v) => set({ [key]: v })} />
          ))}
          {preset === 'browse' && (
            <CustomSelect label="Sort" placeholder="Most popular" value={get('sort')} options={SORT_OPTIONS} onChange={(v) => set({ sort: v })} />
          )}
          {(filtered || get('sort')) && (
            <button
              type="button"
              onClick={() => {
                setText('')
                setSp({}, { replace: true })
              }}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background transition active:scale-95"
            >
              <X className="size-4" /> Reset
            </button>
          )}
        </div>
      </div>

      {error && !items.length ? (
        <div className="grid min-h-[40svh] place-items-center">
          <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {cards.map((c, i) => (
              <AnimeCard key={c.id} item={c} fluid index={i % 24} rank={ranked && i < 99 ? i + 1 : undefined} />
            ))}
            {loading &&
              Array.from({ length: 12 }, (_, i) => (
                <div key={`s${i}`}>
                  <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                  <Skeleton className="mt-3 h-4 w-4/5" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
              ))}
          </div>

          {!loading && !items.length && (
            <div className="grid min-h-[40svh] place-items-center text-center">
              <div>
                <p className="font-display text-2xl font-bold">Nothing matches</p>
                <p className="mt-2 text-muted">Try removing a filter.</p>
              </div>
            </div>
          )}
          {error && items.length > 0 && (
            <div className="mt-10 text-center">
              <button type="button" onClick={() => setNonce((n) => n + 1)} className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background active:scale-95">
                Couldn’t load more — retry
              </button>
            </div>
          )}
          <div ref={sentinel} className="h-10" />
          {!hasNext && items.length > 0 && <p className="mt-6 text-center text-sm text-muted">That’s everything — {items.length} titles.</p>}
        </>
      )}
    </main>
  )
}
