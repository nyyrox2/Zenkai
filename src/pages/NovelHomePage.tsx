import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { useDebounced } from '../hooks/useDebounced'
import { fetchNovelHome, fetchNovelHomeAll, isNovelSource, NOVEL_SOURCES, searchNovels, searchNovelsEverywhere, type NovelItem, type NovelScope } from '../services/novel'
import type { BookCardItem } from '../components/BookCard'
import { BookGrid } from '../components/BookGrid'
import { BookRow } from '../components/BookRow'
import { ContinueReading } from '../components/ContinueReading'
import { DiscoverHero } from '../components/DiscoverHero'
import { ErrorState } from '../components/ErrorState'
import { Reveal } from '../components/Reveal'
import { Tabs } from '../components/Tabs'
import { cn } from '../lib/utils'

const toCard = (n: NovelItem): BookCardItem => ({
  key: `${n.source}:${n.slug}`,
  href: `/novel/${n.source}/${encodeURIComponent(n.slug)}`,
  title: n.title,
  image: n.cover,
  score: n.rating,
  caption: n.stats,
  genres: n.genres,
})

const dedupe = (list: NovelItem[]) => {
  const seen = new Set<string>()
  return list.filter((n) => !seen.has(n.slug) && seen.add(n.slug))
}

export default function NovelHomePage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('source') ?? undefined
  const source: NovelScope = raw === 'all' ? 'all' : isNovelSource(raw) ? raw : 'novelfire'
  const everywhere = source === 'all'
  const [query, setQuery] = useState('')
  const term = useDebounced(query.trim(), 400)
  const [genre, setGenre] = useState<string | null>(null)

  const home = useAsync(() => (everywhere ? fetchNovelHomeAll() : fetchNovelHome(source)), [source])
  const found = useAsync(() => (!term ? Promise.resolve(null) : everywhere ? searchNovelsEverywhere(term) : searchNovels(source, term)), [term, source])

  useEffect(() => {
    document.title = 'Novels — Zenkai'
  }, [])
  useEffect(() => {
    if (params.get('search') === '1') document.getElementById('discover-search')?.focus()
  }, [params])
  useEffect(() => setGenre(null), [source])

  const all = useMemo(() => dedupe([...(home.data?.rankings ?? []), ...(home.data?.popular ?? []), ...(home.data?.latest ?? [])]), [home.data])
  const genres = useMemo(() => {
    const count = new Map<string, number>()
    for (const n of all) for (const g of n.genres ?? []) count.set(g, (count.get(g) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([g]) => g)
  }, [all])

  // the shelf's own covers, softened into an ambient wash behind the headline
  const backdrop = useMemo(() => all.filter((n) => n.cover).slice(0, 24).map((n) => ({ src: n.cover, title: n.title })), [all])
  const filtered = useMemo(() => (genre ? all.filter((n) => n.genres?.includes(genre)) : null), [all, genre])
  const searching = term.length > 0
  const err = home.error?.message

  function setSource(s: NovelScope) {
    const next = new URLSearchParams(params)
    if (s === 'novelfire') next.delete('source')
    else next.set('source', s)
    next.delete('search')
    setParams(next, { replace: true })
  }

  return (
    <main>
      <DiscoverHero
        eyebrow="Web novels & light novels"
        title="Get lost in a"
        accent="story with no last page."
        subtitle="Web novels and illustrated light novels from four sources, searchable all at once, in a reader built for long sessions."
        kanji="小説"
        query={query}
        onQuery={setQuery}
        placeholder="Search novels…"
        backdrop={backdrop}
        blurBackdrop
      >
        <Tabs tabs={[{ id: 'all' as NovelScope, label: 'All' }, ...NOVEL_SOURCES.map((s) => ({ id: s.id as NovelScope, label: s.label }))]} value={source} onChange={setSource} />
      </DiscoverHero>

      <div className="relative z-10 space-y-12 pb-20 sm:space-y-16">
        {searching ? (
          <section>
            <div className="mx-auto mb-5 max-w-7xl px-4 sm:px-6">
              <p className="mb-1 eyebrow text-accent">Search</p>
              <h2 className="font-display text-2xl font-bold tracking-tight">Results for “{term}”{everywhere && <span className="text-muted"> · all sources</span>}</h2>
            </div>
            {found.error ? (
              <ErrorState message={found.error.message} onRetry={found.reload} />
            ) : (
              <BookGrid items={found.data?.map(toCard)} loading={found.loading} empty={`No novels found for “${term}”${everywhere ? '' : ' on this source'}.`} />
            )}
          </section>
        ) : err ? (
          <ErrorState message={err} onRetry={home.reload} />
        ) : (
          <>
            <ContinueReading kind="novel" />

            {genres.length > 0 && (
              <div className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 sm:px-6">
                {[null, ...genres].map((g) => (
                  <button
                    key={g ?? 'all'}
                    type="button"
                    onClick={() => setGenre(g)}
                    className={cn(
                      'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95',
                      genre === g ? 'border-foreground bg-foreground text-background' : 'border-border bg-card/60 text-muted hover:text-foreground',
                    )}
                  >
                    {g ?? 'All'}
                  </button>
                ))}
              </div>
            )}

            {filtered ? (
              <Reveal>
                <BookGrid items={filtered.map(toCard)} empty={`No ${genre} novels on this source right now.`} />
              </Reveal>
            ) : (
              <>
                <BookRow eyebrow="Highest rated" title="Top Ranked" items={home.data?.rankings.map(toCard)} loading={home.loading} ranked />
                <BookRow eyebrow="Fan favourites" title="Popular Novels" items={home.data?.popular.map(toCard)} loading={home.loading} />
                {(home.data?.latest.length ?? 0) > 0 && (
                  <section>
                    <div className="mx-auto mb-5 max-w-7xl px-4 sm:px-6">
                      <p className="mb-1 eyebrow text-accent">Keep exploring</p>
                      <h2 className="font-display text-2xl font-bold tracking-tight">More to Read</h2>
                    </div>
                    <BookGrid items={home.data?.latest.map(toCard)} />
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
