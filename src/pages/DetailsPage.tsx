import { Img } from '../components/Img'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { SiteHeader } from '../components/SiteHeader'
import { Link, useLocation, useParams } from 'react-router-dom'
import { shareMedia } from '../lib/share'
import { useMarkDetails, useSmartBack } from '../lib/backToDetails'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Play, Radio, Share2, ShieldAlert, ShieldCheck, Star } from 'lucide-react'
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
import { CharacterCard } from '../components/CharacterCard'
import { EpisodeList } from '../components/EpisodeList'
import { Gallery } from '../components/Gallery'
import { ErrorState } from '../components/ErrorState'
import { ScoreChart } from '../components/ScoreChart'
import { Skeleton } from '../components/Skeleton'
import { StatusBreakdown } from '../components/StatusBreakdown'
import { Tabs } from '../components/Tabs'
import { TrailerModal } from '../components/TrailerModal'

type TabId = 'overview' | 'episodes' | 'cast' | 'franchise' | 'media'

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

  const tb = useTmdb(anime.data?.id, anime.data ? pickTitle(anime.data.title) : '', anime.data?.format)
  const tmdb = tb?.tmdb ?? null
  const eps = useEpisodes(tmdb, anime.data?.streamingEpisodes)
  const kinds = useFiller(anime.data, tab === 'episodes')
  const order = useAsync(async () => (tab === 'franchise' && anime.data ? fetchWatchOrder(anime.data.id) : undefined), [tab, anime.data?.id])
  const allBackdrops = useAsync(() => (tmdb ? tmdbBackdrops(tmdb.type, tmdb.id) : Promise.resolve([] as string[])), [tmdb?.id, tmdb?.type])

  useEffect(() => {
    setTab('overview')
    setExpanded(false)
    setLogoOk(true)
  }, [rawId, fromMal])

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

  const airsIn = (() => {
    if (!a.nextAiringEpisode) return null
    const s = Math.max(0, a.nextAiringEpisode.airingAt - Date.now() / 1000)
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
  })()

  /** One merged, grouped facts list (fewer rows than before, same information). */
  const titles = [a.title?.english, a.title?.romaji, a.title?.native].filter((t, i, arr): t is string => !!t && arr.indexOf(t) === i)
  const facts: [string, ReactNode][] = (
    [
      ['Titles', titles.length > 1 ? <span className="block space-y-0.5">{titles.map((t) => <span key={t} className="block">{t}</span>)}</span> : null],
      ['Format', [formatLabel(a.format), a.episodes ? `${a.episodes} eps` : null, a.duration ? `${a.duration} min` : null].filter(Boolean).join(' · ')],
      ['Status', [formatStatus(a.status), aired].filter(Boolean).join(' · ')],
      ['Season', [a.season && a.seasonYear ? `${humanize(a.season)} ${a.seasonYear}` : null, a.source ? humanize(a.source) : null].filter(Boolean).join(' · ')],
      ['Studio', studios.join(', ')],
      ['Producers', producers.slice(0, 3).join(', ')],
      ['Broadcast', mal.data?.broadcast?.string ?? ''],
      ['Rating', [mal.data?.rating, tmdb?.certification].filter((v, i, arr) => v && arr.indexOf(v) === i).join(' · ')],
      ['Origin', [a.countryOfOrigin, tmdb?.language ? tmdb.language.toUpperCase() : null].filter(Boolean).join(' · ')],
      ['Network', tmdb?.networks.join(', ') ?? ''],
      ['Seasons', tmdb?.seasons ? `${tmdb.seasons} · ${tmdb.episodes ?? '?'} eps total` : ''],
      ['Rank', [ratedRank?.rank ? `#${ratedRank.rank} rated` : null, popularRank?.rank ? `#${popularRank.rank} popular` : null].filter(Boolean).join(' · ')],
      ['Community', [a.favourites ? `${compact(a.favourites)} favourites` : null, a.popularity ? `${compact(a.popularity)} users` : null].filter(Boolean).join(' · ')],
    ] as [string, ReactNode][]
  ).filter(([, v]) => !!v)

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    ...(counts.available > 0 ? [{ id: 'episodes' as const, label: 'Episodes', count: counts.available }] : []),
    { id: 'cast', label: 'Characters & staff' },
    { id: 'franchise', label: 'Franchise', count: relations.length + print.length || undefined },
    { id: 'media', label: 'Media & stats' },
  ]

  const malLink = malId ? `https://myanimelist.net/anime/${malId}` : null
  const ext = 'inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-bold text-foreground transition-colors hover:bg-card-2'
  const h2 = 'mb-3 font-display text-lg font-extrabold'
  const panel = 'rounded-xl border border-border bg-card p-4 sm:p-5'

  return (
    <>
      <SiteHeader />
      <main>
        {/* ---------- Banner ---------- */}
        <div className="relative h-[220px] w-full overflow-hidden sm:h-[280px]">
          <BannerSlideshow images={landscapeImages} fallback={heroImg} />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-background/35" />
          <button
            type="button"
            onClick={goBack}
            className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-black/75 sm:left-6"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
        </div>

        {/* ---------- Identity: poster + title + actions ---------- */}
        <div className="mx-auto -mt-20 max-w-6xl px-4 sm:-mt-24 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div
              className="relative aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-xl border border-border bg-card-2 sm:w-44"
              style={{ backgroundColor: a.coverImage.color ?? undefined }}
            >
              {tb ? <Img src={tmdbImg(tmdb?.poster, 'w500') ?? a.coverImage.extraLarge ?? a.coverImage.large ?? ''} alt={title} className="h-full w-full object-cover" /> : <span aria-hidden className="skeleton absolute inset-0" />}
            </div>

            <div className="min-w-0 flex-1 sm:pb-1">
              <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-accent">
                {formatLabel(a.format)}
                {a.seasonYear ? ` · ${a.seasonYear}` : ''} · {formatStatus(a.status)}
              </p>
              {tmdb?.logo && logoOk && (
                <img src={tmdbImg(tmdb.logo, 'w500') ?? ''} alt="" onError={() => setLogoOk(false)} className="mb-2 max-h-20 w-auto max-w-full object-contain object-left sm:max-h-24" />
              )}
              <h1 className={tmdb?.logo && logoOk ? 'sr-only' : 'font-display text-3xl font-black leading-tight tracking-tight [text-wrap:balance] sm:text-4xl'}>{title}</h1>
              {subtitle && <p className="mt-1 text-sm font-semibold text-muted">{subtitle}</p>}

              {/* scores + quick facts, one line */}
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
                {a.averageScore != null && <span className="inline-flex items-center gap-1"><Star className="size-4 fill-current text-amber-400" />{a.averageScore}% <span className="font-semibold text-muted">AniList</span></span>}
                {tmdb?.rating ? <span className="inline-flex items-center gap-1"><Star className="size-4 fill-current text-sky-400" />{tmdb.rating.toFixed(1)} <span className="font-semibold text-muted">TMDB</span></span> : null}
                {a.episodes ? <span className="text-muted">{a.episodes} eps</span> : counts.available ? <span className="text-muted">{counts.available} eps aired</span> : null}
                {a.duration ? <span className="text-muted">{a.duration} min</span> : null}
                {studios[0] && <span className="text-muted">{studios[0]}</span>}
              </p>
            </div>
          </div>

          {/* actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {watchable && (
              <Link
                to={watchHref}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-extrabold text-accent-fg transition-opacity hover:opacity-90"
              >
                <Play className="size-4 fill-current" /> {resume > 0 ? `Continue · Ep ${Math.min(resume, counts.available)}` : 'Watch now'}
              </Link>
            )}
            <ListButton item={mediaToCard(a)} className="h-10 justify-center rounded-lg px-4 text-sm font-bold" />
            {a.trailer?.id && (
              <button type="button" onClick={() => setTrailerOpen(true)} className={ext}>
                <Play className="size-4 fill-current" /> Trailer
              </button>
            )}
            <button
              type="button"
              onClick={() => shareMedia({ url: `${window.location.origin}/anime/${a.id}`, title, image: a.bannerImage ?? a.coverImage.extraLarge, poster: a.coverImage.extraLarge, label: 'Watch free on Zenkai', subtitle: [a.format ? formatLabel(a.format) : '', a.seasonYear ?? ''].filter(Boolean).join(' · ') })}
              className={ext}
              aria-label="Share"
            >
              <Share2 className="size-4" /> Share
            </button>
            {(a.siteUrl || malLink) && (
              <span className="ml-auto flex items-center gap-1 text-xs font-bold text-muted">
                {a.siteUrl && <a href={a.siteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors hover:text-foreground">AniList <ExternalLink className="size-3" /></a>}
                {malLink && <a href={malLink} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors hover:text-foreground">MyAnimeList <ExternalLink className="size-3" /></a>}
              </span>
            )}
          </div>

          {airsIn && a.nextAiringEpisode && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold">
              <Radio className="size-4 text-accent" /> Episode {a.nextAiringEpisode.episode} airs in <span className="text-accent">{airsIn}</span>
            </p>
          )}

          {/* ---------- Tabs ---------- */}
          <div className="mt-7 border-b border-border/60 pb-3">
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
          </div>

          <div key={tab} className="py-6">
            {/* ===== Overview ===== */}
            {tab === 'overview' && (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0 space-y-8">
                  <section>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {a.genres.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => openSearch({ genre: g })}
                          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-bold transition-colors hover:bg-foreground hover:text-background"
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    {tmdb?.tagline && <p className="mb-2 text-sm font-semibold italic text-muted">“{tmdb.tagline}”</p>}
                    {synopsis ? (
                      <>
                        <p className="whitespace-pre-line leading-relaxed text-foreground/80">{shownSynopsis}</p>
                        {long && (
                          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-bold text-accent hover:underline">
                            {expanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-muted">No synopsis available yet.</p>
                    )}
                  </section>

                  {tags.length > 0 && (
                    <section>
                      <h2 className={h2}>Tags</h2>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <span key={t.name} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted">
                            {t.name} <span className="opacity-60">{t.rank}%</span>
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {mal.data && (mal.data.theme.openings.length > 0 || mal.data.theme.endings.length > 0) && (
                    <section className="grid gap-4 md:grid-cols-2">
                      {mal.data.theme.openings.length > 0 && <ThemeList heading="Openings" items={mal.data.theme.openings} />}
                      {mal.data.theme.endings.length > 0 && <ThemeList heading="Endings" items={mal.data.theme.endings} />}
                    </section>
                  )}

                  {recommendations.length > 0 && (
                    <section>
                      <h2 className={h2}>You might also like</h2>
                      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                        {recommendations.slice(0, 12).map((r, i) => <AnimeCard key={r.id} item={r} index={i} />)}
                      </div>
                    </section>
                  )}
                </div>

                {/* details + where to watch */}
                <aside className="space-y-4 lg:self-start">
                  <div className={panel}>
                    <h2 className={h2}>Details</h2>
                    <dl className="divide-y divide-border/60 text-sm">
                      {facts.map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                          <dt className="shrink-0 font-semibold text-muted">{k}</dt>
                          <dd className="text-right font-bold">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className={panel}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h2 className="inline-flex items-center gap-2 font-display text-lg font-extrabold"><ShieldCheck className="size-4 text-accent" /> Official sources</h2>
                      {tmdb?.watchProviders?.link && (
                        <a href={tmdb.watchProviders.link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-foreground">
                          JustWatch <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    {(tmdb?.watchProviders?.providers?.length ?? 0) > 0 || (mal.data?.streaming?.length ?? 0) > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {tmdb?.watchProviders?.providers?.map((p) => (
                          <a
                            key={p.id}
                            href={tmdb?.watchProviders?.link || `https://www.google.com/search?q=watch+${encodeURIComponent(title)}+on+${encodeURIComponent(p.name)}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card-2 px-2.5 py-1.5 text-sm font-bold transition-colors hover:bg-foreground hover:text-background"
                          >
                            {p.logo && <img src={p.logo} alt="" className="size-5 rounded object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none' }} />}
                            {p.name}
                          </a>
                        ))}
                        {mal.data?.streaming?.map((s) => (
                          <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card-2 px-2.5 py-1.5 text-sm font-bold transition-colors hover:bg-foreground hover:text-background">
                            {s.name} <ExternalLink className="size-3" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-medium leading-relaxed text-muted">Availability varies by region. Check Crunchyroll, Netflix, Disney+, Muse Asia or Ani-One for your country.</p>
                    )}
                    <p className="mt-3 text-xs font-medium leading-relaxed text-muted">Support the creators: stream on official licensed platforms whenever available.</p>
                    <details className="mt-3 text-xs text-muted">
                      <summary className="inline-flex cursor-pointer items-center gap-1.5 font-bold hover:text-foreground"><ShieldAlert className="size-3.5" /> Legal notice</summary>
                      <div className="mt-2 space-y-2 leading-relaxed">
                        <p>Zenkai is a non-commercial anime catalog and media aggregator. We do not host, store, or upload any video files or copyrighted content on our own servers.</p>
                        <p>All playback sources are indexed from non-affiliated third-party providers on the public web. Zenkai has no control over, and assumes no responsibility for, third-party servers or their content.</p>
                        <p>Takedown notices should be sent directly to the hosting file servers. For catalog data inquiries, reach out through our community channels.</p>
                      </div>
                    </details>
                  </div>
                </aside>
              </div>
            )}

            {/* ===== Episodes ===== */}
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

            {/* ===== Characters, staff, cast ===== */}
            {tab === 'cast' && (
              <div className="space-y-10">
                <section>
                  <h2 className={h2}>Characters</h2>
                  {a.characters.edges.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {a.characters.edges.map((e) => <CharacterCard key={e.node.id} edge={e} />)}
                    </div>
                  ) : (
                    <Empty text="No character data available yet." />
                  )}
                </section>

                {a.staff.edges.length > 0 && (
                  <section>
                    <h2 className={h2}>Staff</h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {a.staff.edges.slice(0, 8).map((s) => (
                        <div key={`${s.node.id}-${s.role}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                          <img src={s.node.image.large ?? ''} alt="" loading="lazy" className="size-11 shrink-0 rounded-lg object-cover" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{s.node.name.full}</p>
                            <p className="truncate text-xs font-medium text-muted">{s.role ?? 'Staff'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {tmdb && tmdb.cast.length > 0 && (
                  <section>
                    <h2 className={h2}>Cast</h2>
                    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                      {tmdb.cast.map((c) => (
                        <div key={`${c.name}-${c.character}`} className="w-28 shrink-0">
                          <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border bg-card-2">
                            {c.photo && <img src={tmdbImg(c.photo, 'w185') ?? ''} alt="" loading="lazy" className="h-full w-full object-cover" />}
                          </div>
                          <p className="mt-2 line-clamp-1 text-sm font-bold">{c.name}</p>
                          <p className="line-clamp-1 text-xs font-medium text-muted">{c.character}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ===== Franchise: watch order + related + manga/novels ===== */}
            {tab === 'franchise' && (
              <div className="space-y-10">
                <section>
                  <h2 className={h2}>Watch order</h2>
                  {order.loading ? (
                    <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
                  ) : order.error ? (
                    <ErrorState message={order.error.message} onRetry={order.reload} />
                  ) : order.data && order.data.length > 1 ? (
                    <>
                      <p className="mb-4 text-sm font-medium text-muted">
                        Release order across the franchise. <span className="font-bold text-foreground">Main story</span> entries come first; side stories, OVAs and specials are optional.
                      </p>
                      <ol className="grid gap-2 md:grid-cols-2">
                        {order.data.map((e, i) => {
                          const here = e.id === a.id
                          return (
                            <li key={e.id}>
                              <Link
                                to={`/anime/${e.id}`}
                                className={`flex gap-3 rounded-xl border p-2.5 transition-colors ${here ? 'border-accent/60 bg-card-2' : 'border-border bg-card hover:bg-card-2'}`}
                              >
                                <span className="grid w-6 shrink-0 place-items-center font-display text-lg font-black tabular-nums text-muted/50">{i + 1}</span>
                                <span className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-lg bg-card-2" style={{ backgroundColor: e.color ?? undefined }}>
                                  <img src={e.image ?? ''} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="line-clamp-2 text-sm font-bold leading-snug">{pickTitle(e.title)}</span>
                                  <span className="mt-0.5 block text-xs font-medium text-muted">{[formatLabel(e.format), e.year, e.episodes ? `${e.episodes} ep` : null].filter(Boolean).join(' · ')}</span>
                                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${e.main ? 'bg-foreground text-background' : 'bg-card-2 text-muted'}`}>{e.main ? 'Main' : 'Extra'}</span>
                                    {here && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-accent-fg">You are here</span>}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          )
                        })}
                      </ol>
                    </>
                  ) : (
                    <Empty text="Standalone title — no other franchise entries found." />
                  )}
                </section>

                {relations.length > 0 && (
                  <section>
                    <h2 className={h2}>Related</h2>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-5">
                      {relations.map((r, i) => <AnimeCard key={`${r.id}-${r.caption}`} item={r} index={i} fluid />)}
                    </div>
                  </section>
                )}

                {print.length > 0 && (
                  <section>
                    <h2 className={h2}>Read it: manga &amp; novels</h2>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-5">
                      {print.map((b, i) => <BookCard key={b.key} item={b} index={i} fluid />)}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ===== Media & stats ===== */}
            {tab === 'media' && (
              <div className="space-y-10">
                <section>
                  <h2 className={h2}>Gallery</h2>
                  <Gallery anime={a} tmdb={tmdb} />
                </section>
                <section>
                  <h2 className={h2}>Stats</h2>
                  {!statsView && stats.loading && Boolean(malId) ? (
                    <Skeleton className="h-64 w-full rounded-xl" />
                  ) : statsView ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className={panel}>
                        <h3 className="mb-4 font-display text-base font-extrabold">Score distribution</h3>
                        <ScoreChart scores={statsView.scores} />
                      </div>
                      <div className={panel}>
                        <h3 className="mb-4 font-display text-base font-extrabold">How people are watching</h3>
                        <StatusBreakdown stats={statsView} />
                      </div>
                    </div>
                  ) : (
                    <Empty text="Statistics aren't available for this title yet." />
                  )}
                </section>
              </div>
            )}
          </div>
        </div>

        <TrailerModal trailer={trailerOpen ? a.trailer : null} onClose={() => setTrailerOpen(false)} />
      </main>
    </>
  )
}

/* ------------------ small local helpers ------------------ */
function ThemeList({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-2 font-display text-base font-extrabold">{heading}</h2>
      <ul className="space-y-1.5 text-sm font-medium text-muted">
        {items.slice(0, 5).map((t) => (
          <li key={t} className="leading-snug">
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">{text}</p>
}

function DetailsSkeleton() {
  return (
    <>
      <SiteHeader />
      <main>
        <Skeleton className="h-[220px] w-full rounded-none sm:h-[280px]" />
        <div className="mx-auto -mt-20 max-w-6xl px-4 sm:-mt-24 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <Skeleton className="aspect-[2/3] w-32 rounded-xl sm:w-44" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="mt-6 h-10 w-80" />
          <Skeleton className="mt-8 h-40 w-full" />
        </div>
      </main>
    </>
  )
}
