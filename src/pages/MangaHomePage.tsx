import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Compass, Info } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { useDebounced } from '../hooks/useDebounced'
import { useShowcase } from '../hooks/useShowcase'
import { DEFAULT_MANGA_SOURCE, MANGA_SOURCES, isMangaSource, mangaHref, mangaSourceInfo, resolveMangaSource } from '../lib/mangaModels'
import { fetchMangaHome, findOnServersHref, MANGA_KINDS, searchAniListManga, searchManga, type AniMangaHit, type MangaItem, type MangaKind, type MangaScope } from '../services/manga'
import type { BookCardItem } from '../components/BookCard'
import { BookGrid } from '../components/BookGrid'
import { BookRow } from '../components/BookRow'
import { ContinueReading } from '../components/ContinueReading'
import { DiscoverHero } from '../components/DiscoverHero'
import { ErrorState } from '../components/ErrorState'
import { Tabs } from '../components/Tabs'
import { cn } from '../lib/utils'

const SOURCE_KEY = 'zk:manga-source:v1'
const storedSource = (): MangaScope => {
  try {
    const v = localStorage.getItem(SOURCE_KEY)
    return v === 'all' || isMangaSource(v) ? v : DEFAULT_MANGA_SOURCE
  } catch {
    return DEFAULT_MANGA_SOURCE
  }
}

const toCard = (m: MangaItem): BookCardItem => ({
  key: `${m.source}:${m.id}`,
  href: mangaHref(m),
  title: m.title,
  image: m.poster,
  score: m.score ? m.score.toFixed(1) : null,
  badge: m.kind ?? (m.type && m.type.length < 9 ? m.type : null),
  caption: m.latest ?? (m.chapters ? `${m.chapters} chapters` : m.status),
})

const toAniCard = (m: AniMangaHit): BookCardItem => ({
  key: `anilist:${m.id}`,
  href: findOnServersHref(m),
  title: m.title,
  image: m.cover,
  score: m.score ? m.score.toFixed(1) : null,
  badge: m.kind,
  caption: ['Search all servers', m.year].filter(Boolean).join(' · '),
})

export default function MangaHomePage() {
  const [params, setParams] = useSearchParams()
  // ?source= wins, otherwise the server this visitor picked last time
  const urlSource = params.get('source')
  const source: MangaScope = urlSource ? (urlSource === 'all' ? 'all' : resolveMangaSource(urlSource)) : storedSource()
  const everywhere = source === 'all'
  const sourceName = everywhere ? 'any server' : mangaSourceInfo(source).displayName
  const [kind, setKind] = useState<MangaKind | null>(null)
  const [query, setQuery] = useState('')
  const term = useDebounced(query.trim(), 400)
  const home = useAsync(() => fetchMangaHome(source), [source])
  const { manga: art } = useShowcase()
  const backdrop = useMemo(() => art.filter((a) => a.wide), [art])
  const found = useAsync(() => (term ? searchManga(term, source) : Promise.resolve(null)), [term, source])
  const ani = useAsync(() => (term ? searchAniListManga(term) : Promise.resolve(null)), [term])

  function setSource(s: MangaScope) {
    try {
      localStorage.setItem(SOURCE_KEY, s)
    } catch {
      /* blocked storage: the choice lasts for this visit */
    }
    const next = new URLSearchParams(params)
    if (s === DEFAULT_MANGA_SOURCE) next.delete('source')
    else next.set('source', s)
    next.delete('search')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    document.title = 'Manga — Zenkai'
  }, [])
  useEffect(() => {
    if (params.get('search') === '1') document.getElementById('discover-search')?.focus()
  }, [params])

  const byKind = (list?: MangaItem[]) => (kind ? list?.filter((m) => m.kind === kind) : list)
  const rows = useMemo(
    () => ({
      trending: byKind(home.data?.trending)?.map(toCard),
      latest: byKind(home.data?.latest)?.map(toCard),
      fresh: byKind(home.data?.newRelease)?.map(toCard),
    }),
    [home.data, kind], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const aniResults = useMemo(() => (ani.data ?? []).filter((m) => !kind || m.kind === kind).map(toAniCard), [ani.data, kind])
  const results = useMemo(() => byKind(found.data ?? undefined)?.map(toCard), [found.data, kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const kindPicker = (
    <div role="group" aria-label="Filter by kind" className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 sm:px-6">
      {[null, ...MANGA_KINDS].map((k) => (
        <button
          key={k ?? 'all'}
          type="button"
          aria-pressed={kind === k}
          onClick={() => setKind(k)}
          className={cn(
            'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95',
            kind === k ? 'border-foreground bg-foreground text-background' : 'border-border bg-card/60 text-muted hover:text-foreground',
          )}
        >
          {k ?? 'All kinds'}
        </button>
      ))}
      <Link to="/manga/browse" className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition active:scale-95">
        <Compass className="size-4" /> Browse all
      </Link>
    </div>
  )

  return (
    <main>
      <DiscoverHero
        eyebrow="Manga · updated daily"
        title="Binge the latest"
        accent="chapters, the moment they drop."
        subtitle="Manga, manhwa and manhua from five servers, or search them all at once. Webtoon scroll or paged reading, with your place saved automatically."
        kanji="漫画"
        query={query}
        onQuery={setQuery}
        placeholder="Search manga…"
        backdrop={backdrop}
      >
        <Tabs tabs={[{ id: 'all' as MangaScope, label: 'All' }, ...MANGA_SOURCES.map((x) => ({ id: x.id as MangaScope, label: x.displayName }))]} value={source} onChange={setSource} />
      </DiscoverHero>

      <div className="relative z-10 space-y-12 pb-20 sm:space-y-16">
        {term ? (
          <section>
            <div className="mx-auto mb-5 max-w-7xl px-4 sm:px-6">
              <p className="mb-1 eyebrow text-accent">Search</p>
              <h2 className="font-display text-2xl font-bold tracking-tight">Results for “{term}”{everywhere && <span className="text-muted"> · all servers</span>}</h2>
            </div>
            {kindPicker}
            <div className="h-5" />
            {(ani.loading || aniResults.length > 0) && (
              <div className="mb-12">
                <div className="mx-auto mb-4 max-w-7xl px-4 sm:px-6">
                  <h3 className="font-display text-xl font-bold tracking-tight">Find by name</h3>
                  <p className="text-xs text-muted">Matched on AniList. Pick one and it is looked up on every server by all of its names.</p>
                </div>
                <BookGrid items={aniResults} loading={ani.loading} empty="" />
              </div>
            )}
            <div className="mx-auto mb-4 max-w-7xl px-4 sm:px-6">
              <h3 className="font-display text-xl font-bold tracking-tight">On {sourceName}</h3>
            </div>
            {found.error ? (
              <ErrorState message={found.error.message} onRetry={found.reload} />
            ) : (
              <BookGrid items={results} loading={found.loading} empty={`Nothing on ${sourceName} under “${term}”.${aniResults.length ? ' Try one of the matches above.' : ''}`} />
            )}
          </section>
        ) : home.error ? (
          <ErrorState message={home.error.message} onRetry={home.reload} />
        ) : (
          <>
            <ContinueReading kind="manga" />
            {kindPicker}
            {home.data?.fallback && (
              <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 text-xs text-muted sm:px-6">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {sourceName === 'any server' ? 'No server answered' : `${sourceName} didn’t answer`}, so this shelf is AniList&rsquo;s trending list. Opening a title looks it up again. You can also try another server above.
              </p>
            )}
            <BookRow eyebrow="Right now" title="Trending Manga" items={rows.trending} loading={home.loading} ranked />
            <BookRow eyebrow="Fresh chapters" title="Latest Updates" items={rows.latest} loading={home.loading} />
            <BookRow eyebrow="Just added" title="New Releases" items={rows.fresh} loading={home.loading} />
          </>
        )}
      </div>
    </main>
  )
}
