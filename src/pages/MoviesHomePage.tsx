import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Search, X } from 'lucide-react'
import { BookGrid } from '../components/BookGrid'
import { BookRow } from '../components/BookRow'
import { ErrorState } from '../components/ErrorState'
import { Marquee } from '../components/Marquee'
import { MovieHero } from '../components/MovieHero'
import { useAsync } from '../hooks/useAsync'
import { useDebounced } from '../hooks/useDebounced'
import { toMovieCard } from '../lib/movieCards'
import { fetchShelf, MOVIE_GENRES, searchAll, type MediaType, type MovieItem, type Shelf } from '../services/movies'

const SHELVES: { type: MediaType; shelf: Shelf; eyebrow: string; title: string; ranked?: boolean }[] = [
  { type: 'movie', shelf: 'popular', eyebrow: 'Everyone is watching', title: 'Popular Movies', ranked: true },
  { type: 'movie', shelf: 'now_playing', eyebrow: 'In theaters', title: 'Now Playing' },
  { type: 'movie', shelf: 'top_rated', eyebrow: 'All time', title: 'Top Rated Movies' },
  { type: 'movie', shelf: 'upcoming', eyebrow: 'Soon', title: 'Upcoming' },
  { type: 'tv', shelf: 'trending', eyebrow: 'This week', title: 'Trending Series', ranked: true },
  { type: 'tv', shelf: 'popular', eyebrow: 'Binge', title: 'Popular Series' },
  { type: 'tv', shelf: 'top_rated', eyebrow: 'Critics love', title: 'Top Rated Series' },
]

export default function MoviesHomePage() {
  const [query, setQuery] = useState('')
  const term = useDebounced(query.trim(), 400)

  // Every shelf loads independently: one failing shelf never takes the page down.
  const data = useAsync(async () => {
    const [hero, ...rest] = await Promise.all([fetchShelf('movie', 'trending').catch(() => null), ...SHELVES.map((s) => fetchShelf(s.type, s.shelf).catch(() => null))])
    return { hero: hero?.items ?? null, rows: rest.map((r) => r?.items ?? null) }
  }, [])
  const found = useAsync<MovieItem[] | null>(() => (term ? searchAll(term) : Promise.resolve(null)), [term])

  useEffect(() => {
    document.title = 'Movies — Zenkai'
  }, [])

  const allFailed = !!data.data && !data.data.hero && data.data.rows.every((r) => !r)

  return (
    <main>
      <MovieHero items={data.data?.hero ?? undefined} loading={data.loading} />

      <div className="relative z-10 space-y-12 pb-28 sm:space-y-16 md:pb-20">
        <div className="mx-auto -mt-6 flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:px-6">
          <label className="relative block w-full sm:max-w-md">
            <span className="sr-only">Search movies and series</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies & series…"
              className="h-12 w-full rounded-full border border-border bg-card/80 pl-11 pr-11 text-sm outline-none backdrop-blur transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-foreground/10 hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </label>
          <Link to="/movies/browse" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg transition active:scale-95 hover:brightness-110">
            <Compass className="size-4" /> Browse all
          </Link>
        </div>

        {term ? (
          <section>
            <div className="mx-auto mb-5 max-w-7xl px-4 sm:px-6">
              <p className="mb-1 eyebrow text-accent">Search</p>
              <h2 className="font-display text-2xl font-bold tracking-tight">Results for “{term}”</h2>
            </div>
            {found.error ? <ErrorState message={found.error.message} onRetry={found.reload} /> : <BookGrid items={found.data?.map(toMovieCard)} loading={found.loading} empty={`Nothing found for “${term}”.`} />}
          </section>
        ) : allFailed ? (
          <ErrorState message="Couldn't reach the movie database. Check your connection and try again." onRetry={data.reload} />
        ) : (
          <>
            <BookRow eyebrow="Right now" title="Trending Movies" items={data.data?.hero?.map(toMovieCard)} loading={data.loading} ranked />
            {SHELVES.map((s, n) => (
              <BookRow key={s.title} eyebrow={s.eyebrow} title={s.title} items={data.data?.rows[n]?.map(toMovieCard)} loading={data.loading} ranked={s.ranked} />
            ))}
            <section aria-label="Genres" className="mx-auto max-w-7xl">
              <div className="mb-5 px-4 sm:px-6">
                <p className="mb-1 eyebrow text-accent">Pick a mood</p>
                <h2 className="font-display text-2xl font-bold tracking-tight">Genres</h2>
              </div>
              <Marquee duration={46}>
                {MOVIE_GENRES.map((g) => (
                  <Link key={g.id} to={`/movies/browse?type=movie&genre=${g.id}`} className="rounded-full border border-border bg-card/70 px-6 py-3 text-sm font-semibold transition hover:bg-foreground hover:text-background">
                    {g.name}
                  </Link>
                ))}
              </Marquee>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
