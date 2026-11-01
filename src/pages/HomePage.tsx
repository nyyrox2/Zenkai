import { useEffect, useMemo } from 'react'
import { fetchHome } from '../services/anilist'
import { fetchMalTop } from '../services/jikan'
import { useAsync } from '../hooks/useAsync'
import { malToCard, mediaToCard } from '../lib/mappers'
import { getSeason, humanize } from '../lib/utils'
import { ProfileCard } from '../components/ProfileCard'
import { ContinueRow } from '../components/ContinueRow'
import { AnimeRow } from '../components/AnimeRow'
import { AppPromo } from '../components/AppPromo'
import { ErrorState } from '../components/ErrorState'
import { GenreMarquee } from '../components/GenreMarquee'
import { HeroCarousel } from '../components/HeroCarousel'
import { HeroLoader } from '../components/HeroLoader'

export default function HomePage() {
  const home = useAsync(fetchHome, [])
  const malTop = useAsync(() => fetchMalTop(18).catch(() => null), [])
  const { season, year } = getSeason()

  useEffect(() => {
    document.title = 'Zenkai — Watch Anime Online Free in HD · English Sub & Dub'
  }, [])

  const heroItems = useMemo(() => {
    const list = home.data?.trending ?? []
    const withBanner = list.filter((m) => m.bannerImage)
    return (withBanner.length >= 3 ? withBanner : list).slice(0, 6)
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
      {home.loading ? (
        <div className="relative h-[88svh] max-h-[900px] min-h-[580px] overflow-hidden lg:h-[92svh] lg:max-h-[860px]">
          <HeroLoader />
        </div>
      ) : err ? (
        <div className="grid min-h-[70svh] place-items-center px-4 pt-24">
          <ErrorState message={err} onRetry={home.reload} />
        </div>
      ) : (
        <HeroCarousel items={heroItems} />
      )}

      <div className="relative z-10 mt-10 space-y-12 pb-20 sm:space-y-16">
        <ProfileCard />
        <ContinueRow />
        <GenreMarquee />

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
        <AnimeRow
          id="mal"
          eyebrow="MyAnimeList"
          title="Top on MyAnimeList"
          items={rows.mal}
          loading={malTop.loading}
        />
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
