import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { BookGrid } from '../components/BookGrid'
import { ErrorState } from '../components/ErrorState'
import { Meteors } from '../components/Meteors'
import { Tabs } from '../components/Tabs'
import { useDebounced } from '../hooks/useDebounced'
import { toMovieCard } from '../lib/movieCards'
import { cn } from '../lib/utils'
import { browse, MOVIE_GENRES, SORTS, TV_GENRES, type MediaType, type MovieItem, type SortId } from '../services/movies'

const YEARS = Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() - i))

export default function MoviesBrowsePage() {
  const [params, setParams] = useSearchParams()
  const type: MediaType = params.get('type') === 'tv' ? 'tv' : 'movie'
  const genre = Number(params.get('genre')) || null
  const year = params.get('year') ?? ''
  const sort = (SORTS.find((s) => s.id === params.get('sort'))?.id ?? 'popularity.desc') as SortId
  const urlQuery = params.get('q') ?? ''

  const [query, setQuery] = useState(urlQuery)
  const term = useDebounced(query.trim(), 400)
  const genres = type === 'tv' ? TV_GENRES : MOVIE_GENRES

  const [items, setItems] = useState<MovieItem[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)
  const seq = useRef(0)

  function patch(next: Record<string, string | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) v ? p.set(k, v) : p.delete(k)
    setParams(p, { replace: true })
  }

  // keep ?q= in sync with the (debounced) search box
  useEffect(() => {
    if (term !== urlQuery) patch({ q: term || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  useEffect(() => {
    document.title = `${type === 'tv' ? 'TV Shows' : 'Movies'} — Zenkai`
  }, [type])

  // Any filter change restarts the list; "Load more" appends the next page.
  const key = useMemo(() => [type, genre, year, sort, urlQuery].join('|'), [type, genre, year, sort, urlQuery])
  useEffect(() => {
    const my = ++seq.current
    setLoading(true)
    setError(null)
    setItems([])
    setPage(1)
    browse({ type, genre, year, sort, query: urlQuery, page: 1 })
      .then((r) => {
        if (my !== seq.current) return
        setItems(r.items)
        setPages(r.totalPages)
      })
      .catch((e: unknown) => my === seq.current && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => my === seq.current && setLoading(false))
  }, [key, nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const [more, setMore] = useState(false)
  async function loadMore() {
    const my = seq.current
    setMore(true)
    try {
      const r = await browse({ type, genre, year, sort, query: urlQuery, page: page + 1 })
      if (my !== seq.current) return
      setItems((cur) => {
        const seen = new Set(cur.map((m) => m.id))
        return [...cur, ...r.items.filter((m) => !seen.has(m.id))]
      })
      setPage(r.page)
      setPages(r.totalPages)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setMore(false)
    }
  }

  const searching = !!urlQuery
  const chip = (active: boolean) =>
    cn('shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95', active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card/60 text-muted hover:text-foreground')

  return (
    <main>
      <section className="relative overflow-hidden px-4 pb-8 pt-28 sm:px-6 sm:pb-10 sm:pt-36">
        <Meteors number={12} />
        <span aria-hidden className="pointer-events-none absolute -right-4 top-16 select-none font-display text-[9rem] font-black leading-none text-foreground/[0.04]">映画</span>
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-3 eyebrow text-accent">Browse</p>
          <h1 className="font-display text-4xl font-black tracking-tight">{type === 'tv' ? 'TV Shows' : 'Movies'}</h1>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <label className="relative block w-full sm:max-w-md">
              <span className="sr-only">Search</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${type === 'tv' ? 'series' : 'movies'}…`}
                className="h-12 w-full rounded-full border border-border bg-card/70 pl-11 pr-11 text-sm outline-none backdrop-blur transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-foreground/10 hover:text-foreground">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <Tabs
              tabs={[
                { id: 'movie' as MediaType, label: 'Movies' },
                { id: 'tv' as MediaType, label: 'TV Shows' },
              ]}
              value={type}
              onChange={(t) => patch({ type: t === 'tv' ? 'tv' : null, genre: null })}
            />
          </div>
        </div>
      </section>

      <div className="relative z-10 space-y-6 pb-28 md:pb-20">
        {!searching && (
          <>
            <div role="group" aria-label="Genre" className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 sm:px-6">
              <button type="button" aria-pressed={!genre} onClick={() => patch({ genre: null })} className={chip(!genre)}>All genres</button>
              {genres.map((g) => (
                <button key={g.id} type="button" aria-pressed={genre === g.id} onClick={() => patch({ genre: String(g.id) })} className={chip(genre === g.id)}>
                  {g.name}
                </button>
              ))}
            </div>
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 sm:px-6">
              <Tabs tabs={SORTS.map((s) => ({ id: s.id, label: s.label }))} value={sort} onChange={(s) => patch({ sort: s === 'popularity.desc' ? null : s })} />
              <label className="relative">
                <span className="sr-only">Release year</span>
                <select
                  value={year}
                  onChange={(e) => patch({ year: e.target.value || null })}
                  className="h-11 appearance-none rounded-full border border-border bg-card/60 pl-4 pr-9 text-sm font-medium outline-none backdrop-blur focus:border-accent"
                >
                  <option value="">Any year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">▾</span>
              </label>
            </div>
          </>
        )}

        <div className="pt-4">
          {error && items.length === 0 ? (
            <ErrorState message={error.message} onRetry={() => setNonce((n) => n + 1)} />
          ) : (
            <BookGrid items={items.map(toMovieCard)} loading={loading} empty={searching ? `Nothing found for “${urlQuery}”.` : 'Nothing matches these filters.'} />
          )}
          {!loading && items.length > 0 && page < pages && (
            <div className="mt-10 flex justify-center">
              <button type="button" onClick={loadMore} disabled={more} className="rounded-full border border-border bg-card/70 px-8 py-3 text-sm font-semibold transition hover:bg-foreground hover:text-background active:scale-95 disabled:opacity-60">
                {more ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
