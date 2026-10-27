import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { shareLink } from '../lib/share'
import { useMarkDetails, useSmartBack } from '../lib/backToDetails'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CalendarDays, Crown, ExternalLink, Heart, Play, Share2, ShieldAlert, ShieldCheck, TrendingUp, Users } from 'lucide-react'
import { fetchAnimeByMalId, fetchAnimeById, fetchWatchOrder } from '../services/anilist'
import { tmdbImg } from '../services/api'
import { tmdbBackdrops } from '../services/tmdbDirect'
import { fetchMalFull, fetchMalStats } from '../services/jikan'
import { useAsync } from '../hooks/useAsync'
import { useTmdb } from '../hooks/useTmdb'
import { useEpisodes } from '../hooks/useEpisodes'
import { useFiller } from '../hooks/useFiller'
import { episodeCounts } from '../lib/episodes'
import { lastEpisode } from '../lib/progress'
import { getHistory } from '../lib/library'
import { ListButton } from '../components/ListButton'
import { useSearch } from '../context/SearchContext'
import { mediaToCard, recommendationToCard, relationToCard } from '../lib/mappers'
import { compact, formatDate, formatLabel, formatStatus, humanize, pickTitle, stripHtml } from '../lib/utils'
import type { AniMediaDetails, CardItem, JikanStats } from '../types/anime'
import { AnimeCard } from '../components/AnimeCard'
import { BookCard, type BookCardItem } from '../components/BookCard'
import { AnimeRow } from '../components/AnimeRow'
import { BorderBeam } from '../components/BorderBeam'
import { CharacterCard } from '../components/CharacterCard'
import { Countdown } from '../components/Countdown'
import { DotPattern } from '../components/DotPattern'
import { EpisodeList } from '../components/EpisodeList'
import { Gallery } from '../components/Gallery'
import { StarBorder } from '../components/StarBorder'
import { ErrorState } from '../components/ErrorState'
import { NumberTicker } from '../components/NumberTicker'
import { Reveal } from '../components/Reveal'
import { ScoreChart } from '../components/ScoreChart'
import { ScoreRing } from '../components/ScoreRing'
import { ShimmerButton } from '../components/ShimmerButton'
import { Skeleton } from '../components/Skeleton'
import { SpotlightCard } from '../components/SpotlightCard'
import { StatCard } from '../components/StatCard'
import { StatusBreakdown } from '../components/StatusBreakdown'
import { Tabs } from '../components/Tabs'
import { TrailerModal } from '../components/TrailerModal'

type TabId = 'overview' | 'episodes' | 'order' | 'characters' | 'relations' | 'gallery' | 'stats'

/** AniList's own score / status distributions, shaped like Jikan's so the same charts render when MyAnimeList is slow or down. */
function anilistStats(a: AniMediaDetails): JikanStats | null {
  const s = a.stats
  if (!s) return null
  const n = (k: string) => s.statusDistribution.find((x) => x.status === k)?.amount ?? 0
  const total = s.statusDistribution.reduce((sum, x) => sum + x.amount, 0)
  const votes = s.scoreDistribution.reduce((sum, x) => sum + x.amount, 0)
  if (!total && !votes) return null
  return {
    watching: n('CURRENT') + n('REPEATING'),
    completed: n('COMPLETED'),
    on_hold: n('PAUSED'),
    dropped: n('DROPPED'),
    plan_to_watch: n('PLANNING'),
    total,
    scores: s.scoreDistribution.map((x) => ({ score: x.score / 10, votes: x.amount, percentage: votes ? (x.amount / votes) * 100 : 0 })),
  }
}

/** Landscape gallery artwork slideshow displayed in the details page banner behind the poster. */
function BannerSlideshow({ images, fallback }: { images: string[]; fallback: string }) {
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)

  // Auto-advance every 5.5 seconds (paused when hovered)
  useEffect(() => {
    if (images.length <= 1 || hovered) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length)
    }, 5500)
    return () => clearInterval(timer)
  }, [images.length, hovered])

  // Preload next image in sequence
  useEffect(() => {
    if (images.length <= 1) return
    const nextIdx = (index + 1) % images.length
    const img = new Image()
    img.src = images[nextIdx]
  }, [index, images])

  const cur = images[index] || fallback

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute inset-0 overflow-hidden bg-black select-none"
    >
      <AnimatePresence mode="popLayout">
        <motion.img
          key={cur}
          src={cur}
          alt=""
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="h-full w-full object-cover"
        />
      </AnimatePresence>
    </div>
  )
}

export default function DetailsPage() {
  const params = useParams()
  const location = useLocation()
  useMarkDetails()
  const { openSearch } = useSearch()

  const fromMal = location.pathname.startsWith('/mal/')
  const rawId = Number(params.id)
  const validId = Number.isInteger(rawId) && rawId > 0

  const [tab, setTab] = useState<TabId>('overview')
  const [expanded, setExpanded] = useState(false)
  const [trailerOpen, setTrailerOpen] = useState(false)
  const [logoOk, setLogoOk] = useState(true)

  const anime = useAsync<AniMediaDetails>(
    () =>
      validId
        ? fromMal
          ? fetchAnimeByMalId(rawId)
          : fetchAnimeById(rawId)
        : Promise.reject(new Error('That anime link looks invalid.')),
    [rawId, fromMal],
  )

  const malId = anime.data?.idMal ?? null
  const mal = useAsync(() => (malId ? fetchMalFull(malId).catch(() => null) : Promise.resolve(null)), [malId])
  const stats = useAsync(() => (malId ? fetchMalStats(malId).catch(() => null) : Promise.resolve(null)), [malId])

  const tmdb = useTmdb(anime.data?.id, anime.data ? pickTitle(anime.data.title) : '', anime.data?.format)?.tmdb ?? null
  const eps = useEpisodes(tmdb, anime.data?.streamingEpisodes)
  const kinds = useFiller(anime.data, tab === 'episodes')
  const order = useAsync(async () => (tab === 'order' && anime.data ? fetchWatchOrder(anime.data.id) : undefined), [tab, anime.data?.id])
  const allBackdrops = useAsync(() => (tmdb ? tmdbBackdrops(tmdb.type, tmdb.id) : Promise.resolve([] as string[])), [tmdb?.id, tmdb?.type])

  useEffect(() => {
    setTab('overview')
    setExpanded(false)
    setLogoOk(true)
  }, [rawId, fromMal])

  // land on the episode list for anything watchable
  const loadedId = anime.data?.id
  useEffect(() => {
    if (anime.data && episodeCounts(anime.data).available > 0) setTab('episodes')
  }, [loadedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const a = anime.data
  useEffect(() => {
    document.title = a ? `${pickTitle(a.title)} — Zenkai` : 'Zenkai'
  }, [a])

  const relations: CardItem[] = useMemo(
    () => (a?.relations.edges ?? []).filter((e) => e.node.type === 'ANIME').map(relationToCard),
    [a],
  )
  // The manga / light novel this anime is based on (or spun off from). They open the "where can I read it" page,
  // which looks the title up on every server and lists what is available.
  const print: BookCardItem[] = useMemo(
    () =>
      (a?.relations.edges ?? [])
        .filter((e) => e.node.type === 'MANGA')
        .map((e) => {
          const novel = e.node.format === 'NOVEL'
          const names = [e.node.title.english, e.node.title.romaji].filter((t): t is string => !!t)
          const title = names[0] ?? e.node.title.native ?? 'Untitled'
          const alt = names.filter((n) => n !== title).join('|')
          return {
            key: `${e.node.id}-${e.relationType}`,
            href: `/${novel ? 'novel' : 'manga'}/find?${new URLSearchParams({ title, alt, cover: e.node.coverImage.large ?? '' })}`,
            title,
            image: e.node.coverImage.large ?? '',
            score: e.node.averageScore ? (e.node.averageScore / 10).toFixed(1) : null,
            badge: novel ? 'Light novel' : e.node.format === 'ONE_SHOT' ? 'One shot' : 'Manga',
            caption: humanize(e.relationType),
          }
        }),
    [a],
  )
  const recommendations: CardItem[] = useMemo(
    () => (a?.recommendations.nodes ?? []).map(recommendationToCard).filter((c): c is CardItem => c !== null),
    [a],
  )

  const landscapeImages = useMemo(() => {
    const list: string[] = []
    const tmdbMain = tmdbImg(tmdb?.backdrop, 'w1280')
    if (tmdbMain) list.push(tmdbMain)
    if (a?.bannerImage && !list.includes(a.bannerImage)) list.push(a.bannerImage)
    if (tmdb?.backdrops?.length) {
      for (const b of tmdb.backdrops) {
        const u = tmdbImg(b, 'w1280')
        if (u && !list.includes(u)) list.push(u)
      }
    }
    if (allBackdrops.data?.length) {
      for (const u of allBackdrops.data) {
        if (u && !list.includes(u)) list.push(u)
      }
    }
    for (const ep of a?.streamingEpisodes ?? []) {
      if (ep.thumbnail && !list.includes(ep.thumbnail)) {
        list.push(ep.thumbnail)
      }
    }
    return list
  }, [tmdb, a?.bannerImage, a?.streamingEpisodes, allBackdrops.data])

  const goBack = useSmartBack('/home')

  /* ------------------ loading / error ------------------ */
  if (anime.loading) return <DetailsSkeleton />

  if (anime.error || !a) {
    return (
      <main className="grid min-h-[80svh] place-items-center px-4 pt-24">
        <ErrorState message={anime.error?.message ?? 'Something went wrong.'} onRetry={anime.reload} />
      </main>
    )
  }

  /* ------------------ derived data ------------------ */
  const title = pickTitle(a.title)
  const subtitle = [a.title.native, a.title.romaji !== title ? a.title.romaji : null].filter(Boolean).join(' · ')
  const synopsis = stripHtml(a.description) || stripHtml(mal.data?.synopsis) || tmdb?.overview || ''
  const long = synopsis.length > 420
  const shownSynopsis = long && !expanded ? `${synopsis.slice(0, 420).trimEnd()}…` : synopsis
  const studios = a.studios.edges.filter((e) => e.isMain).map((e) => e.node.name)
  const producers = (mal.data?.producers ?? []).map((p) => p.name)
  const tags = a.tags.filter((t) => !t.isMediaSpoiler).slice(0, 14)
  const malScore = mal.data?.score ?? null
  const ratedRank = a.rankings.find((r) => r.type === 'RATED' && r.allTime)
  const popularRank = a.rankings.find((r) => r.type === 'POPULAR' && r.allTime)
  const aired = [formatDate(a.startDate), formatDate(a.endDate)].filter(Boolean).join(' → ')

  const counts = episodeCounts(a)
  const resume = lastEpisode(a.id)
  const watchable = a.status !== 'NOT_YET_RELEASED' && counts.available > 0
  const last = getHistory(a.id)
  const watchHref = `/watch/${a.id}?ep=${Math.min(resume || 1, counts.available || 1)}${last ? `&server=${last.server}&audio=${last.audio}` : ''}`
  const heroImg = tmdbImg(tmdb?.backdrop, 'w1280') ?? a.bannerImage ?? a.coverImage.extraLarge ?? ''
  const statsView = stats.data ?? anilistStats(a)

  const info: [string, string][] = (
    [
      ['Format', formatLabel(a.format)],
      ['English', a.title?.english || '—'],
      ['Romaji', a.title?.romaji || '—'],
      ['Native', a.title?.native || '—'],
      ['Episodes', a.episodes ? String(a.episodes) : '—'],
      ['Duration', a.duration ? `${a.duration} min` : '—'],
      ['Status', formatStatus(a.status)],
      ['Aired', aired || '—'],
      ['Season', a.season && a.seasonYear ? `${humanize(a.season)} ${a.seasonYear}` : '—'],
      ['Source', a.source ? humanize(a.source) : '—'],
      ['Studio', studios.join(', ') || '—'],
      ['Producers', producers.slice(0, 3).join(', ') || '—'],
      ['Broadcast', mal.data?.broadcast?.string ?? '—'],
      ['Rating', mal.data?.rating ?? '—'],
      ['Country', a.countryOfOrigin ?? '—'],
      ['Network', tmdb?.networks.join(', ') || '—'],
      ['Certification', tmdb?.certification ?? '—'],
      ['Seasons (TMDB)', tmdb?.seasons ? `${tmdb.seasons} · ${tmdb.episodes ?? '?'} eps total` : '—'],
      ['Original language', tmdb?.language ? tmdb.language.toUpperCase() : '—'],
      ['All-time rank', ratedRank?.rank ? `#${ratedRank.rank}` : '—'],
      ['Popularity rank', popularRank?.rank ? `#${popularRank.rank}` : '—'],
    ] as [string, string][]
  ).filter(([, v]) => v !== '—')

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    ...(counts.available > 0 ? [{ id: 'episodes' as const, label: 'Episodes', count: counts.available }] : []),
    { id: 'order', label: 'Watch order' },
    { id: 'characters', label: 'Characters', count: a.characters.edges.length },
    { id: 'relations', label: 'Related', count: relations.length + print.length },
    { id: 'gallery', label: 'Gallery' },
    { id: 'stats', label: 'Stats' },
  ]

  const malLink = malId ? `https://myanimelist.net/anime/${malId}` : null

  return (
    <main>
      {/* ---------- Banner Slideshow ---------- */}
      <div className="relative h-[40svh] min-h-[280px] w-full overflow-hidden">
        <BannerSlideshow images={landscapeImages} fallback={heroImg} />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/10 to-background pointer-events-none" />
        <DotPattern className="[mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />
        <button
          type="button"
          onClick={goBack}
          className="absolute left-4 top-6 z-20 inline-flex items-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-sm font-medium backdrop-blur-xl transition hover:scale-105 active:scale-95 sm:left-6"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
      </div>

      {/* ---------- Body ---------- */}
      <div className="relative mx-auto -mt-24 grid max-w-7xl gap-8 px-4 pb-16 sm:px-6 lg:-mt-32 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-12">
        {/* Sidebar */}
        <aside className="lg:self-start">
          <div className="lg:sticky lg:top-24">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="relative mx-auto aspect-[2/3] w-44 overflow-hidden rounded-3xl border border-border bg-card-2 shadow-2xl shadow-black/30 sm:w-56 lg:w-full"
              style={{ backgroundColor: a.coverImage.color ?? undefined }}
            >
              <img src={a.coverImage.extraLarge ?? a.coverImage.large ?? ''} alt={title} className="h-full w-full object-cover" />
              <BorderBeam size={200} duration={9} />
            </motion.div>

            <div className="mt-5 flex flex-wrap justify-center gap-3 lg:flex-col lg:items-stretch">
              {watchable && (
                <StarBorder to={watchHref} color={a.coverImage.color ?? '#ff6b81'} className="block w-full max-w-xs self-center lg:max-w-none">
                  <Play className="size-4 fill-current" /> {resume > 0 ? `Continue · Ep ${Math.min(resume, counts.available)}` : 'Watch now'}
                </StarBorder>
              )}
              <ListButton item={mediaToCard(a)} className="justify-center rounded-full px-6 py-3 text-sm font-semibold" />
              {a.trailer?.id && (
                <ShimmerButton onClick={() => setTrailerOpen(true)} icon={<Play className="size-4 fill-current" />}>
                  Watch trailer
                </ShimmerButton>
              )}
              <ShimmerButton
                variant="ghost"
                onClick={() => shareLink(`${window.location.origin}/anime/${a.id}`, `${title} — Zenkai`)}
                icon={<Share2 className="size-4" />}
              >
                Share
              </ShimmerButton>
              {a.siteUrl && (
                <ShimmerButton variant="ghost" href={a.siteUrl} icon={<ExternalLink className="size-4" />}>
                  AniList
                </ShimmerButton>
              )}
              {malLink && (
                <ShimmerButton variant="ghost" href={malLink} icon={<ExternalLink className="size-4" />}>
                  MyAnimeList
                </ShimmerButton>
              )}
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0 lg:pt-32">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <div className="text-center lg:text-left">
              <p className="mb-2 eyebrow text-accent">
                {formatLabel(a.format)}
                {a.seasonYear ? ` · ${a.seasonYear}` : ''} · {formatStatus(a.status)}
              </p>
              {tmdb?.logo && logoOk && (
                <img
                  src={tmdbImg(tmdb.logo, 'w500') ?? ''}
                  alt=""
                  onError={() => setLogoOk(false)}
                  className="mx-auto mb-2 max-h-24 w-auto max-w-full object-contain drop-shadow-[0_6px_24px_rgba(0,0,0,0.5)] sm:max-h-28 lg:mx-0 lg:object-left"
                />
              )}
              <h1 className={tmdb?.logo && logoOk ? 'sr-only' : 'font-display text-3xl font-black leading-tight tracking-tight [text-wrap:balance]'}>{title}</h1>
              {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
              {tmdb?.tagline && <p className="mt-2 text-sm italic text-muted">“{tmdb.tagline}”</p>}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
              {a.genres.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => openSearch({ genre: g })}
                  className="rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm backdrop-blur transition hover:bg-foreground hover:text-background active:scale-95"
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Scores */}
            <div className="mt-8 flex items-center justify-center gap-8 lg:justify-start">
              <ScoreRing value={a.averageScore} max={100} label="AniList" suffix="%" />
              <ScoreRing
                value={malScore}
                max={10}
                label="MyAnimeList"
                decimals={2}
                loading={Boolean(malId) && mal.loading}
              />
              {tmdb?.rating ? <ScoreRing value={tmdb.rating} max={10} label="TMDB" decimals={1} /> : null}
              <div className="hidden space-y-1 text-sm md:block">
                {ratedRank && (
                  <p className="flex items-center gap-2">
                    <Crown className="size-4 text-accent" /> <span className="font-semibold">#{ratedRank.rank}</span>
                    <span className="text-muted">highest rated</span>
                  </p>
                )}
                {popularRank && (
                  <p className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-accent" /> <span className="font-semibold">#{popularRank.rank}</span>
                    <span className="text-muted">most popular</span>
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {a.nextAiringEpisode && (
            <Reveal className="mt-8">
              <Countdown airingAt={a.nextAiringEpisode.airingAt} episode={a.nextAiringEpisode.episode} />
            </Reveal>
          )}

          {/* Tabs */}
          <div className="mt-10 flex justify-center lg:justify-start">
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-8"
            >
              {tab === 'overview' && (
                <div className="space-y-10">
                  <section>
                    <h2 className="mb-3 font-display text-xl font-bold">Synopsis</h2>
                    {synopsis ? (
                      <>
                        <p className="whitespace-pre-line leading-relaxed text-muted">{shownSynopsis}</p>
                        {long && (
                          <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            className="mt-3 text-sm font-semibold text-accent hover:underline"
                          >
                            {expanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-muted">No synopsis available yet.</p>
                    )}
                  </section>

                  <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    <StatCard
                      icon={<TrendingUp className="size-3.5" />}
                      label="MAL rank"
                      loading={Boolean(malId) && mal.loading}
                      value={mal.data?.rank ? <>#<NumberTicker value={mal.data.rank} /></> : '—'}
                    />
                    <StatCard
                      icon={<Users className="size-3.5" />}
                      label="Members"
                      loading={Boolean(malId) && mal.loading}
                      value={mal.data?.members ? compact(mal.data.members) : '—'}
                      hint="on MyAnimeList"
                    />
                    <StatCard
                      icon={<Heart className="size-3.5" />}
                      label="Favourites"
                      value={a.favourites ? compact(a.favourites) : '—'}
                      hint="on AniList"
                    />
                    <StatCard
                      icon={<CalendarDays className="size-3.5" />}
                      label="Popularity"
                      value={a.popularity ? compact(a.popularity) : '—'}
                      hint="AniList users"
                    />
                  </section>

                  <section>
                    <h2 className="mb-3 font-display text-xl font-bold">Information</h2>
                    <SpotlightCard>
                      <dl className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
                        {info.map(([k, v], i) => (
                          <div
                            key={k}
                            className={`flex items-baseline justify-between gap-4 px-5 py-3.5 text-sm ${
                              i >= 2 ? 'sm:border-t sm:border-border' : ''
                            }`}
                          >
                            <dt className="shrink-0 text-muted">{k}</dt>
                            <dd className="text-right font-medium">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </SpotlightCard>
                  </section>

                  {tags.length > 0 && (
                    <section>
                      <h2 className="mb-3 font-display text-xl font-bold">Tags</h2>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((t) => (
                          <span key={t.name} className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted">
                            {t.name} <span className="opacity-60">{t.rank}%</span>
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {mal.data && (mal.data.theme.openings.length > 0 || mal.data.theme.endings.length > 0) && (
                    <section className="grid gap-4 md:grid-cols-2">
                      {mal.data.theme.openings.length > 0 && (
                        <ThemeList heading="Openings" items={mal.data.theme.openings} />
                      )}
                      {mal.data.theme.endings.length > 0 && (
                        <ThemeList heading="Endings" items={mal.data.theme.endings} />
                      )}
                    </section>
                  )}

                  {a.staff.edges.length > 0 && (
                    <section>
                      <h2 className="mb-4 font-display text-xl font-bold">Staff</h2>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {a.staff.edges.slice(0, 8).map((s) => (
                          <div key={`${s.node.id}-${s.role}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5">
                            <img src={s.node.image.large ?? ''} alt="" loading="lazy" className="size-11 shrink-0 rounded-full object-cover" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{s.node.name.full}</p>
                              <p className="truncate text-xs text-muted">{s.role ?? 'Staff'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {tmdb && tmdb.cast.length > 0 && (
                    <section>
                      <h2 className="mb-4 font-display text-xl font-bold">Cast</h2>
                      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                        {tmdb.cast.map((c) => (
                          <div key={`${c.name}-${c.character}`} className="w-28 shrink-0">
                            <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-card-2">
                              {c.photo && <img src={tmdbImg(c.photo, 'w185') ?? ''} alt="" loading="lazy" className="h-full w-full object-cover" />}
                            </div>
                            <p className="mt-2 line-clamp-1 text-sm font-medium">{c.name}</p>
                            <p className="line-clamp-1 text-xs text-muted">{c.character}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {tmdb && tmdb.backdrops.length > 1 && (
                    <section>
                      <h2 className="mb-4 font-display text-xl font-bold">Gallery</h2>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {tmdb.backdrops.slice(0, 6).map((b) => (
                          <img key={b} src={tmdbImg(b, 'w500') ?? ''} alt="" loading="lazy" className="aspect-video w-full rounded-2xl border border-border object-cover" />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Where to Watch & Official Sources */}
                  <section className="rounded-3xl border border-border bg-card/40 p-5 sm:p-6 backdrop-blur">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-8 place-items-center rounded-xl bg-accent/15 text-accent">
                          <ShieldCheck className="size-4" />
                        </div>
                        <h2 className="font-display text-lg font-bold">Official Streaming Sources</h2>
                      </div>
                      {tmdb?.watchProviders?.link && (
                        <a
                          href={tmdb.watchProviders.link}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition"
                        >
                          <span>JustWatch</span>
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 sm:p-4 text-xs text-muted leading-relaxed mb-4">
                      <span className="font-semibold text-foreground">Support the Creators:</span> We strongly recommend streaming on official licensed platforms whenever available. Your support helps fund animators, voice actors, and future seasons.
                    </div>

                    {/* TMDB Providers */}
                    {tmdb?.watchProviders?.providers && tmdb.watchProviders.providers.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Available On</p>
                        <div className="flex flex-wrap gap-2.5">
                          {tmdb.watchProviders.providers.map((p) => (
                            <a
                              key={p.id}
                              href={tmdb?.watchProviders?.link || `https://www.google.com/search?q=watch+${encodeURIComponent(title)}+on+${encodeURIComponent(p.name)}`}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-2.5 rounded-2xl border border-border bg-card/80 px-3.5 py-2 text-sm font-medium transition hover:border-foreground/40 hover:bg-card-2 active:scale-95"
                            >
                              {p.logo && (
                                <img
                                  src={p.logo}
                                  alt={p.name}
                                  className="size-6 rounded-md object-cover shadow-sm"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                                />
                              )}
                              <span>{p.name}</span>
                              <ExternalLink className="size-3 text-muted" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* MAL Streaming Links */}
                    {mal.data && mal.data.streaming && mal.data.streaming.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Direct Official Links</p>
                        <div className="flex flex-wrap gap-2">
                          {mal.data.streaming.map((s) => (
                            <a
                              key={s.url}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium transition hover:bg-foreground hover:text-background"
                            >
                              {s.name} <ExternalLink className="size-3.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!tmdb?.watchProviders?.providers || tmdb.watchProviders.providers.length === 0) &&
                      (!mal.data?.streaming || mal.data.streaming.length === 0) && (
                        <p className="text-xs text-muted">
                          Official streaming availability varies by region. Check services such as Crunchyroll, Netflix, Disney+, Muse Asia, or Ani-One for your country.
                        </p>
                      )}
                  </section>

                  {/* Legal Notice & Disclaimer */}
                  <section className="rounded-3xl border border-border/80 bg-card/25 p-5 sm:p-6 backdrop-blur">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="grid size-8 place-items-center rounded-xl bg-muted/15 text-muted">
                        <ShieldAlert className="size-4" />
                      </div>
                      <h2 className="font-display text-base font-bold">Legal Notice &amp; Disclaimer</h2>
                    </div>
                    <div className="space-y-2 text-xs text-muted leading-relaxed">
                      <p>
                        Zenkai is a non-commercial, open-source anime catalog and media aggregator. We do not host, store, or upload any video files, media, or copyrighted content on our own servers.
                      </p>
                      <p>
                        All streaming media links, episode embeds, and playback sources are indexed from non-affiliated third-party providers on the public web. Zenkai has no control over and assumes no responsibility for third-party servers or their content.
                      </p>
                      <p>
                        If you believe copyrighted material is being improperly accessed through linked external providers, please direct takedown notices directly to the hosting file servers. For inquiries regarding Zenkai catalog data, you may reach out through our community channels.
                      </p>
                    </div>
                  </section>
                </div>
              )}

              {tab === 'episodes' && (
                <EpisodeList
                  total={counts.total}
                  available={counts.available}
                  current={resume || undefined}
                  hrefFor={(n) => `/watch/${a.id}?ep=${n}`}
                  info={eps}
                  fallbackImg={a.bannerImage ?? a.coverImage.extraLarge}
                  defaultRuntime={a.duration}
                  badge="Continue"
                  kinds={kinds}
                />
              )}

              {tab === 'order' && (
                <div>
                  {order.loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                      ))}
                    </div>
                  ) : order.error ? (
                    <ErrorState message={order.error.message} onRetry={order.reload} />
                  ) : order.data && order.data.length > 0 ? (
                    <>
                      <p className="mb-5 text-sm text-muted">
                        Release order across the whole franchise. <span className="font-medium text-foreground">Main story</span> entries are the ones to watch first; side stories, OVAs and specials are optional.
                      </p>
                      <ol className="relative space-y-3 border-l border-border pl-5 sm:pl-7">
                        {order.data.map((e, i) => {
                          const here = e.id === a.id
                          return (
                            <li key={e.id} className="relative">
                              <span className={`absolute -left-[1.62rem] top-5 size-3 rounded-full border-2 border-background sm:-left-[2.12rem] ${here ? 'bg-accent ring-4 ring-accent/25' : e.main ? 'bg-foreground' : 'bg-muted'}`} />
                              <div className={`flex gap-3 rounded-2xl border p-3 transition ${here ? 'border-accent/60 bg-accent/10' : 'border-border bg-card/60 hover:bg-card'}`}>
                                <Link to={`/anime/${e.id}`} className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-xl bg-card-2 sm:w-16" style={{ backgroundColor: e.color ?? undefined }}>
                                  <img src={e.image ?? ''} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                </Link>
                                <div className="flex min-w-0 flex-1 flex-col justify-between">
                                  <div>
                                    <p className="text-[11px] font-bold tabular-nums text-muted">#{String(i + 1).padStart(2, '0')}</p>
                                    <Link to={`/anime/${e.id}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-accent">
                                      {pickTitle(e.title)}
                                    </Link>
                                    <p className="mt-1 text-xs text-muted">
                                      {[formatLabel(e.format), e.year, e.episodes ? `${e.episodes} ep` : null].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${e.main ? 'bg-foreground text-background' : 'bg-card-2 text-muted'}`}>{e.main ? 'Main story' : 'Side / extra'}</span>
                                    {here && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-fg">You are here</span>}
                                    {e.status !== 'NOT_YET_RELEASED' && !here && (
                                      <Link to={`/watch/${e.id}`} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                                        <Play className="size-3 fill-current" /> Watch
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    </>
                  ) : (
                    <Empty text="No other entries found — this looks like a standalone title." />
                  )}
                </div>
              )}

              {tab === 'characters' &&
                (a.characters.edges.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {a.characters.edges.map((e) => (
                      <CharacterCard key={e.node.id} edge={e} />
                    ))}
                  </div>
                ) : (
                  <Empty text="No character data available yet." />
                ))}

              {tab === 'relations' && (
                <div className="space-y-10">
                  {relations.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                      {relations.map((r, i) => (
                        <AnimeCard key={`${r.id}-${r.caption}`} item={r} index={i} fluid />
                      ))}
                    </div>
                  )}
                  {print.length > 0 && (
                    <div>
                      <p className="mb-1 eyebrow text-accent">Read it</p>
                      <h3 className="mb-5 font-display text-xl font-bold">Manga &amp; novels</h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                        {print.map((b, i) => (
                          <BookCard key={b.key} item={b} index={i} fluid />
                        ))}
                      </div>
                    </div>
                  )}
                  {relations.length === 0 && print.length === 0 && <Empty text="No related titles found." />}
                </div>
              )}

              {tab === 'gallery' && <Gallery anime={a} tmdb={tmdb} />}

              {tab === 'stats' && (
                <div className="space-y-8">
                  {!statsView && stats.loading && Boolean(malId) ? (
                    <Skeleton className="h-64 w-full rounded-3xl" />
                  ) : statsView ? (
                    <>
                      <SpotlightCard className="p-5 sm:p-6">
                        <h2 className="mb-5 font-display text-xl font-bold">
                          Score distribution <span className="ml-1 text-sm font-medium text-muted">{stats.data ? 'MyAnimeList' : 'AniList'}</span>
                        </h2>
                        <ScoreChart scores={statsView.scores} />
                      </SpotlightCard>
                      <SpotlightCard className="p-5 sm:p-6">
                        <h2 className="mb-5 font-display text-xl font-bold">
                          How people are watching <span className="ml-1 text-sm font-medium text-muted">{stats.data ? 'MyAnimeList' : 'AniList'}</span>
                        </h2>
                        <StatusBreakdown stats={statsView} />
                      </SpotlightCard>
                    </>
                  ) : (
                    <Empty text="Statistics aren't available for this title yet." />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="pb-8">
          <AnimeRow eyebrow="Because you looked" title="You might also like" items={recommendations} />
        </div>
      )}

      <TrailerModal trailer={trailerOpen ? a.trailer : null} onClose={() => setTrailerOpen(false)} />
    </main>
  )
}

/* ------------------ small local helpers ------------------ */
function ThemeList({ heading, items }: { heading: string; items: string[] }) {
  return (
    <SpotlightCard className="p-5">
      <h2 className="mb-3 font-display text-lg font-bold">{heading}</h2>
      <ul className="space-y-2 text-sm text-muted">
        {items.slice(0, 5).map((t) => (
          <li key={t} className="leading-snug">
            {t}
          </li>
        ))}
      </ul>
    </SpotlightCard>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted">{text}</p>
}

function DetailsSkeleton() {
  return (
    <main>
      <Skeleton className="h-[40svh] min-h-[280px] w-full rounded-none" />
      <div className="mx-auto -mt-24 grid max-w-7xl gap-8 px-4 sm:px-6 lg:-mt-32 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-12">
        <Skeleton className="mx-auto aspect-[2/3] w-44 rounded-3xl sm:w-56 lg:w-full" />
        <div className="space-y-4 lg:pt-32">
          <Skeleton className="mx-auto h-10 w-3/4 lg:mx-0" />
          <Skeleton className="mx-auto h-4 w-1/2 lg:mx-0" />
          <div className="flex justify-center gap-2 lg:justify-start">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </main>
  )
}
