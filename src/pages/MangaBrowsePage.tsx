import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { GENRES } from '../lib/constants'
import { cn, humanize } from '../lib/utils'
import { fetchMangaCatalog, findOnServersHref, MANGA_KINDS, type AniMangaHit, type MangaCatalogParams, type MangaKind } from '../services/manga'
import { BookCard, type BookCardItem } from '../components/BookCard'
import { CustomSelect, type Option } from '../components/CustomSelect'
import { ErrorState } from '../components/ErrorState'
import { GradientText } from '../components/GradientText'
import { Skeleton } from '../components/Skeleton'

const FORMATS: Option[] = [
  { value: '', label: 'Any format' },
  { value: 'MANGA', label: 'Series' },
  { value: 'ONE_SHOT', label: 'One-shot' },
]
const STATUSES = ['RELEASING', 'FINISHED', 'HIATUS', 'CANCELLED', 'NOT_YET_RELEASED']
const TAGS = ['Isekai', 'Reincarnation', 'Martial Arts', 'School', 'Villainess', 'Time Manipulation', 'Cultivation', 'Anti-Hero', 'Female Protagonist', 'Survival', 'Dungeon', 'Revenge', 'Video Games', 'Tragedy', 'Gore', 'Monster Boy']
const SORTS: [string, string][] = [
  ['POPULARITY_DESC', 'Most popular'],
  ['TRENDING_DESC', 'Trending'],
  ['SCORE_DESC', 'Highest rated'],
  ['START_DATE_DESC', 'Newest'],
  ['FAVOURITES_DESC', 'Most favourited'],
  ['CHAPTERS_DESC', 'Most chapters'],
]
const YEARS = Array.from({ length: new Date().getFullYear() + 2 - 1950 }, (_, i) => new Date().getFullYear() + 1 - i)
const any = (label: string, items: Option[]): Option[] => [{ value: '', label: `Any ${label.toLowerCase()}` }, ...items]

const FILTERS = [
  { key: 'genre', label: 'Genre', options: any('Genre', GENRES.map((g) => ({ value: g.name, label: g.name }))) },
  { key: 'tag', label: 'Theme', options: any('Theme', TAGS.map((t) => ({ value: t, label: t }))) },
  { key: 'format', label: 'Format', options: FORMATS },
  { key: 'year', label: 'Year', options: any('Year', YEARS.map((y) => ({ value: String(y), label: String(y) }))) },
  { key: 'status', label: 'Status', options: any('Status', STATUSES.map((x) => ({ value: x, label: humanize(x) }))) },
]
const SORT_OPTIONS: Option[] = SORTS.map(([v, l]) => ({ value: v === 'POPULARITY_DESC' ? '' : v, label: l }))

const toCard = (m: AniMangaHit): BookCardItem => ({
  key: `anilist:${m.id}`,
  href: findOnServersHref(m),
  title: m.title,
  image: m.cover,
  score: m.score ? m.score.toFixed(1) : null,
  badge: m.kind,
  caption: [m.year, m.chapters ? `${m.chapters} ch` : m.status].filter(Boolean).join(' · '),
})

/** The manga counterpart of Browse: filter the whole AniList catalogue, open a title and it is looked up on every server. */
export default function MangaBrowsePage() {
  const [sp, setSp] = useSearchParams()
  const get = (k: string) => sp.get(k) ?? ''

  const [text, setText] = useState(get('q'))
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

  const kind = (MANGA_KINDS as readonly string[]).includes(get('kind')) ? (get('kind') as MangaKind) : undefined
  const params: MangaCatalogParams = useMemo(
    () => ({
      search: get('q') || undefined,
      kind,
      genre: get('genre') || undefined,
      tag: get('tag') || undefined,
      format: get('format') || undefined,
      year: Number(get('year')) || undefined,
      status: get('status') || undefined,
      sort: get('sort') || 'POPULARITY_DESC',
    }),
    [sp], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const key = JSON.stringify(params)

  const [items, setItems] = useState<AniMangaHit[]>([])
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
    fetchMangaCatalog(params, page)
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
    document.title = 'Browse manga — Zenkai'
  }, [])

  const cards = useMemo(() => items.map(toCard), [items])
  const filtered = ['kind', 'genre', 'tag', 'format', 'year', 'status', 'q', 'sort'].some((k) => get(k))

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6">
      <header>
        <p className="mb-2 eyebrow text-accent">Find your next read</p>
        <h1 className="font-display text-4xl font-black tracking-tight">
          <GradientText>Browse</GradientText>
        </h1>
        <p className="mt-3 max-w-xl text-muted">Filter manga, manhwa and manhua by genre, theme, year and status. Open a title and it is looked up on every server.</p>
      </header>

      <div className="sticky top-[4.5rem] z-30 -mx-4 mt-8 border-y border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <label className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search title…"
              className="h-10 w-44 rounded-full border border-border bg-card/60 pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-56"
            />
          </label>
          <div role="group" aria-label="Kind" className="flex shrink-0 gap-1 rounded-full border border-border bg-card/60 p-1">
            {[undefined, ...MANGA_KINDS].map((k) => (
              <button
                key={k ?? 'all'}
                type="button"
                aria-pressed={kind === k}
                onClick={() => set({ kind: k ?? '' })}
                className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium transition active:scale-95', kind === k ? 'bg-foreground text-background' : 'text-muted hover:text-foreground')}
              >
                {k ?? 'All'}
              </button>
            ))}
          </div>
          {FILTERS.map(({ key: k, label, options }) => (
            <CustomSelect key={k} label={label} placeholder={label} value={get(k)} options={options} onChange={(v) => set({ [k]: v })} />
          ))}
          <CustomSelect label="Sort" placeholder="Most popular" value={get('sort')} options={SORT_OPTIONS} onChange={(v) => set({ sort: v })} />
          {filtered && (
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
              <BookCard key={c.key} item={c} fluid index={i % 24} />
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
