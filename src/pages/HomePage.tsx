import { useEffect, useMemo } from 'react'
import { fetchHome, fetchLatestEpisodes } from '../services/anilist'
import { fetchMalTop } from '../services/jikan'
import { useAsync } from '../hooks/useAsync'
import { malToCard, mediaToCard } from '../lib/mappers'
import { getSeason, humanize } from '../lib/utils'
import { ContinueRow } from '../components/ContinueRow'
import { AnimeRow } from '../components/AnimeRow'
import { LatestEpisodesRow } from '../components/LatestEpisodesRow'
import { AppPromo } from '../components/AppPromo'
import { ErrorState } from '../components/ErrorState'
import { GenreMarquee } from '../components/GenreMarquee'
import { HeroCarousel } from '../components/HeroCarousel'
import { HeroLoader } from '../components/HeroLoader'

// module-level: stable identity, so useAsync doesn't re-fire every render
const fetchMal = () => fetchMalTop(18).catch(() => null)

export default function HomePage() {
  const home = useAsync(fetchHome, [])
  const latestEpisodes = useAsync(fetchLatestEpisodes, [])
  const malTop = useAsync(fetchMal, [])

  const { season, year } = getSeason()

  useEffect(() => {
    document.title = 'Zenkai — Watch Anime Online Free in HD'
  }, [])

  const heroItems = useMemo(() => {
    const list = home.data?.trending ?? []
    const withBanner = list.filter((m) => m.bannerImage)
    return (withBanner.length >= 8 ? withBanner : list).slice(0, 14)
  }, [home.data])

  const rows = useMemo(
    () => ({
      trending: home.data?.trending.map(mediaToCard),
      season: home.data?.season.map(mediaToCard),
      popular: home.data?.popular.map(mediaToCard),
      top: home.data?.top.map(mediaToCard),
      upcoming: home.data?.upcoming.map(mediaToCard),
      mal: malTop.data?.map(malToCard),
    }),
    [home.data, malTop.data],
  )

  const err = home.error?.message

  return (
    <main>
      {/* Hero Carousel: 70% viewport height so content peeks through from below */}
      {home.loading ? (
        <div className="relative h-[68svh] max-h-[660px] min-h-[460px] overflow-hidden lg:h-[70svh] lg:max-h-[660px]">
          <HeroLoader />
        </div>
      ) : err ? (
        <div className="grid min-h-[60svh] place-items-center px-4 pt-20">
          <ErrorState message={err} onRetry={home.reload} />
        </div>
      ) : (
        <HeroCarousel items={heroItems} />
      )}

      <div className="relative z-10 mt-8 space-y-12 pb-20 sm:space-y-14">
        {/* Continue Watching Row */}
        <ContinueRow />

        {/* Latest Released Episodes Row */}
        <LatestEpisodesRow
          items={latestEpisodes.data ?? []}
          loading={latestEpisodes.loading}
        />

        <GenreMarquee />

        {/* Trending Anime Shelf */}
        <AnimeRow
          id="trending"
          viewAll="/trending"
          eyebrow="Right now"
          title="Trending Anime"
          items={rows.trending}
          loading={home.loading}
          error={err}
          onRetry={home.reload}
        />

        {/* Airing Season Anime Shelf */}
        <AnimeRow
          id="season"
          viewAll={`/browse?season=${season}&year=${year}`}
          eyebrow={`${humanize(season)} ${year}`}
          title="Airing This Season"
          items={rows.season}
          loading={home.loading}
          error={err}
          onRetry={home.reload}
        />

        {/* All-Time Popular Anime */}
        <AnimeRow
          id="popular"
          viewAll="/popular"
          eyebrow="Fan favourites"
          title="All-Time Popular"
          items={rows.popular}
          loading={home.loading}
          error={err}
          onRetry={home.reload}
        />

        {/* AniList Top 18 */}
        <AnimeRow
          id="top"
          viewAll="/top"
          eyebrow="Highest rated"
          title="Top 18 on AniList"
          items={rows.top}
          loading={home.loading}
          error={err}
          onRetry={home.reload}
          ranked
        />

        {/* MyAnimeList Top */}
        <AnimeRow
          id="mal"
          eyebrow="MyAnimeList"
          title="Top on MyAnimeList"
          items={rows.mal}
          loading={malTop.loading}
        />

        {/* Upcoming Anime */}
        <AnimeRow
          id="upcoming"
          viewAll="/browse?status=NOT_YET_RELEASED"
          eyebrow="Mark your calendar"
          title="Coming Soon"
          items={rows.upcoming}
          loading={home.loading}
          error={err}
          onRetry={home.reload}
        />

        <AppPromo posters={rows.trending?.slice(0, 8).map((c) => c.image)} />
      </div>
    </main>
  )
}