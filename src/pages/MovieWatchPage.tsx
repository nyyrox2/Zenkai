import { toast } from '../lib/toast'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useBackToDetails } from '../lib/backToDetails'
import { ChevronLeft, ChevronRight, Loader2, Lock, TriangleAlert, Languages, SlidersHorizontal, Download, Zap } from 'lucide-react'
import { ErrorState } from '../components/ErrorState'
import { ServerPopup } from '../components/ServerPopup'
import { EpisodeList } from '../components/EpisodeList'
import { SupportCard } from '../components/SupportAds'
import { Skeleton } from '../components/Skeleton'
import { Tabs } from '../components/Tabs'
import { useAsync } from '../hooks/useAsync'
import { useCompanion, LATEST_EXTENSION_VERSION } from '../lib/useCompanion'
import { cn } from '../lib/utils'
import {
  fetchDetails,
  fetchEpisodes,
  fetchProviders,
  img,
  fetchMovieBoxStream,
  movieHref,
  resolveProvider,
  type MediaType,
} from '../services/movies'
import { useShieldVerified, useShield, getToken } from '../lib/shield'
import CinePlayer from '../components/CinePlayer'

const pill = 'rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95'
const PREF = 'zk:movie-server:v1'
const readPref = () => {
  try {
    return localStorage.getItem(PREF)
  } catch {
    return null
  }
}

export default function MovieWatchPage() {
  const { type: rawType, id: rawId } = useParams()
  const type: MediaType = rawType === 'tv' ? 'tv' : 'movie'
  const id = Number(rawId)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const backTo = useBackToDetails()
  const season = Math.max(1, Number(params.get('s')) || 1)
  const episode = Math.max(1, Number(params.get('e')) || 1)

  const details = useAsync(() => fetchDetails(type, id), [type, id])
  const providers = useAsync(() => fetchProviders(type), [type])
  const eps = useAsync(() => (type === 'tv' ? fetchEpisodes(id, season) : Promise.resolve([])), [type, id, season])

  const list = providers.data ?? []
  const providerId = list.find((p) => p.id === params.get('p'))?.id ?? list.find((p) => p.id === readPref())?.id ?? list[0]?.id
  const provider = list.find((p) => p.id === providerId)
  const isMovieBox = providerId === 'moviebox'

  const [selectedDub, setSelectedDub] = useState<string | null>(params.get('dub')?.replace(/^-/, '') || null)
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null)

  useEffect(() => {
    setSelectedDub(params.get('dub')?.replace(/^-/, '') || null)
  }, [params])

  useEffect(() => {
    setSelectedQuality(null)
  }, [id, season, episode, selectedDub])

  const [frameLoaded, setFrameLoaded] = useState(false)
  const sessionVerified = useShieldVerified()
  const shieldFailed = useShield().failed
  useEffect(() => {
    if (sessionVerified) return
    void getToken()
    const t = window.setInterval(() => void getToken(), 6000)
    return () => window.clearInterval(t)
  }, [sessionVerified])

  // MovieBox direct stream extraction
  const mbStream = useAsync(
    () =>
      sessionVerified && isMovieBox && details.data?.title
        ? fetchMovieBoxStream({
            id,
            type,
            season,
            episode,
            title: details.data.title,
            year: details.data.year || undefined,
            dubId: selectedDub,
            imdbId: details.data.imdbId,
          })
        : Promise.resolve(null),
    [sessionVerified, isMovieBox, type, id, season, episode, details.data?.title, details.data?.year, selectedDub, details.data?.imdbId]
  )

  const companion = useCompanion()
  const availableStreams = mbStream.data?.streams || []
  const activeStream = useMemo(() => {
    if (!availableStreams.length) return null
    if (selectedQuality) {
      const found = availableStreams.find((s) => s.quality === selectedQuality)
      if (found) return found
    }
    return availableStreams[0]
  }, [availableStreams, selectedQuality])

  const activeStreamUrl = companion.installed
    ? (activeStream?.rawStreamUrl || activeStream?.url || activeStream?.streamUrl || '')
    : (activeStream?.proxyStreamUrl || activeStream?.streamUrl || mbStream.data?.streamUrl || '')
  const fallbackStreamUrl = activeStream?.proxyStreamUrl || mbStream.data?.proxyStreamUrl || ''
  const activeDownloadUrl = companion.installed
    ? (activeStream?.rawStreamUrl || activeStream?.downloadUrl || activeStream?.url || '')
    : (activeStream?.downloadUrl || mbStream.data?.downloadUrl || '')

  // Standard embed iframe stream resolution (Videasy, Vidzee, etc.)
  const src = useAsync(
    () => (providerId && !isMovieBox ? resolveProvider({ providerId, type, tmdbId: id, season, episode }) : Promise.resolve(null)),
    [providerId, isMovieBox, type, id, season, episode],
  )

  useEffect(() => setFrameLoaded(false), [src.data])
  useEffect(() => {
    document.title = `${details.data?.title ?? 'Watch'} — Zenkai`
  }, [details.data?.title])

  function go(next: Record<string, string | number | null>) {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) v === null ? p.delete(k) : p.set(k, String(v))
    setParams(p, { replace: true })
  }

  function pick(pid: string) {
    try {
      localStorage.setItem(PREF, pid)
    } catch {
      /* private mode: lasts for this visit */
    }
    setSelectedDub(null)
    go({ p: pid, dub: null })
    toast(`Switched to ${list.find((x) => x.id === pid)?.label ?? 'new server'}`)
  }

  function pickDub(dubId: string) {
    const cleanId = dubId.replace(/^-/, '')
    setSelectedDub(cleanId)
    go({ dub: cleanId })
    const dubObj = mbStream.data?.dubs.find((d) => d.id === cleanId || d.id === dubId)
    toast(`Switched audio to ${dubObj?.label ?? 'dub'}`)
  }

  const seasons = details.data?.seasons ?? []
  const seasonInfo = seasons.find((s) => s.n === season)
  const lastEp = eps.data?.length || seasonInfo?.episodes || episode
  const nextTarget = useMemo(() => {
    if (episode < lastEp) return { s: season, e: episode + 1 }
    const nextSeason = seasons.find((s) => s.n > season)
    return nextSeason ? { s: nextSeason.n, e: 1 } : null
  }, [episode, lastEp, season, seasons])
  const epInfo = useMemo(
    () => new Map((eps.data ?? []).map((e) => [e.n, { n: e.n, name: e.name, overview: e.overview, image: e.still ? img(e.still, 'w500') : null, runtime: e.runtime, air: e.air }])),
    [eps.data],
  )
  const epTotal = Math.max(eps.data?.[eps.data.length - 1]?.n ?? 0, seasonInfo?.episodes ?? 0)
  const prevTarget = episode > 1 ? { s: season, e: episode - 1 } : null
  const epName = eps.data?.find((e) => e.n === episode)?.name

  if (!Number.isFinite(id) || id <= 0) return <ErrorState className="mt-40" message="That title doesn't exist." />

  const title = details.data?.title ?? 'Loading…'
  const direct = list.filter((p) => p.tags.includes('Direct'))
  const groups = [
    { label: 'Multi audio', items: list.filter((p) => !p.tags.includes('Direct') && p.tags.includes('Multi audio')) },
    { label: 'Embeds', items: list.filter((p) => !p.tags.includes('Direct') && !p.tags.includes('Multi audio')) },
  ].filter((g) => g.items.length > 0)
  const hrefFor = (n: number) => {
    const q = new URLSearchParams(params)
    q.set('s', String(season))
    q.set('e', String(n))
    return `/movies/watch/${type}/${id}?${q}`
  }
  const nextServer = list[(list.findIndex((p) => p.id === providerId) + 1) % Math.max(list.length, 1)]

  return (
    <main className="relative pb-10">
      <div className="mx-auto max-w-7xl lg:px-6 lg:pt-6">
      {/* Player */}
      <div className="relative aspect-video w-full overflow-hidden bg-black lg:shadow-2xl lg:shadow-black/40 lg:ring-1 lg:ring-white/10">
        {!sessionVerified && isMovieBox ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 text-center select-none">
            <div className="relative mb-3 grid size-16 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent shadow-xl shadow-black/50">
              <Lock className="size-8 animate-pulse" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Media Playback Locked</h3>
            <p className="mt-1.5 max-w-sm text-xs text-muted leading-relaxed">
              Verification challenge in progress. Complete the challenge to unlock high-speed streaming. Embed servers below still work.
            </p>
            {shieldFailed && (
              <button onClick={() => void getToken()} className="mt-4 rounded-full bg-white px-5 py-2 text-xs font-bold text-black active:scale-95">
                Retry
              </button>
            )}
          </div>
        ) : isMovieBox ? (
          <>
            {mbStream.data && (
              <CinePlayer
                streamUrl={activeStreamUrl}
                fallbackStreamUrl={fallbackStreamUrl}
                title={title}
                episode={type === 'tv' ? episode : 1}
                episodeTitle={type === 'tv' ? epName : undefined}
                totalEpisodes={type === 'tv' ? lastEp : 1}
                availableEpisodes={type === 'tv' ? lastEp : 1}
                animeId={id}
                isTmdb
                format={type === 'movie' ? 'MOVIE' : 'TV'}
                directSubtitles={(mbStream.data.subtitles || []).map((s, idx) => ({
                  id: s.id || `sub-${idx}`,
                  label: s.label,
                  lang: s.language || s.lang,
                  url: s.url,
                }))}
                qualities={availableStreams.map((s) => ({
                  label: s.quality,
                  url: companion.installed ? (s.rawStreamUrl || s.url || s.streamUrl) : (s.proxyStreamUrl || s.streamUrl),
                  size: s.size,
                  sizeLabel: s.sizeLabel,
                  downloadUrl: companion.installed ? (s.rawStreamUrl || s.downloadUrl || s.url) : s.downloadUrl,
                }))}
                currentQuality={activeStream?.quality || mbStream.data?.quality}
                onQualityChange={(q: { label: string }) => setSelectedQuality(q.label)}
                downloadUrl={activeDownloadUrl}
                servers={list.map((p) => ({
                  id: p.id,
                  name: p.label,
                  note: p.tags.join(' · '),
                  tags: p.tags,
                }))}
                serverId={providerId}
                onServer={pick}
                hasNextEpisode={!!nextTarget}
                hasPrevEpisode={!!prevTarget}
                onNextEpisode={() => nextTarget && go({ s: nextTarget.s, e: nextTarget.e })}
                onPrevEpisode={() => prevTarget && go({ s: prevTarget.s, e: prevTarget.e })}
                onSelectEpisode={(n) => go({ e: n })}
                switching={mbStream.loading}
                fallbackImg={details.data?.backdrop ? `https://image.tmdb.org/t/p/w1280${details.data.backdrop}` : details.data?.poster ? `https://image.tmdb.org/t/p/w500${details.data.poster}` : null}
                defaultRuntime={
                  activeStream?.duration
                    ? Math.round(activeStream.duration / 60)
                    : (type === 'tv'
                        ? eps.data?.find((e) => e.n === episode)?.runtime || details.data?.runtime
                        : details.data?.runtime) || null
                }
              />
            )}
            {(details.loading || mbStream.loading) && !mbStream.data && !mbStream.error && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black text-white/80">
                <span className="flex items-center gap-3 text-sm">
                  <Loader2 className="size-5 animate-spin" /> Resolving MovieBox stream…
                </span>
              </div>
            )}
            {mbStream.error && (
              <div role="alert" className="absolute inset-0 grid place-items-center bg-black p-6 text-center text-white">
                <div className="flex max-w-sm flex-col items-center gap-3">
                  <TriangleAlert className="size-7 text-amber-400" />
                  <p className="text-sm text-white/80">{mbStream.error.message || 'MovieBox stream not available for this title.'}</p>
                  {nextServer && nextServer.id !== providerId ? (
                    <button type="button" onClick={() => pick(nextServer.id)} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition active:scale-95">
                      Try {nextServer.label}
                    </button>
                  ) : (
                    <button type="button" onClick={() => mbStream.reload()} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition active:scale-95">
                      Try again
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {src.data && (
              <iframe
                key={src.data}
                src={src.data}
                title={title}
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                referrerPolicy="origin"
                onLoad={() => setFrameLoaded(true)}
                className="absolute inset-0 size-full border-0"
              />
            )}
            {(providers.loading || src.loading || (src.data && !frameLoaded)) && !src.error && !providers.error && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black text-white/80">
                <span className="flex items-center gap-3 text-sm">
                  <Loader2 className="size-5 animate-spin" /> Loading {provider?.label ?? 'server'}…
                </span>
              </div>
            )}
            {(src.error || providers.error) && (
              <div role="alert" className="absolute inset-0 grid place-items-center bg-black p-6 text-center text-white">
                <div className="flex max-w-sm flex-col items-center gap-3">
                  <TriangleAlert className="size-7" />
                  <p className="text-sm text-white/80">{providers.error?.message ?? src.error?.message ?? 'This server did not load.'}</p>
                  {nextServer && nextServer.id !== providerId ? (
                    <button type="button" onClick={() => pick(nextServer.id)} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition active:scale-95">
                      Try {nextServer.label}
                    </button>
                  ) : (
                    <button type="button" onClick={() => (providers.error ? providers.reload() : src.reload())} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition active:scale-95">
                      Try again
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Title + nav */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 px-3 sm:px-6 lg:px-0">
        <div className="min-w-0">
          <Link to={movieHref({ type, id })} onClick={backTo(movieHref({ type, id }))} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent">
            <ChevronLeft className="size-3.5" /> Details
          </Link>
          <br />
          <Link to={movieHref({ type, id })} onClick={backTo(movieHref({ type, id }))} className="font-display text-2xl font-black tracking-tight transition-colors hover:text-accent">
            {title}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {type === 'tv'
              ? `Season ${season} · Episode ${episode}${
                  epName && epName.trim() !== String(episode) && !/^(?:ep(?:isode)?\.?|ch(?:apter)?\.?)\s*0*(\d+)$/i.test(epName.trim())
                    ? ` · ${epName.trim()}`
                    : ''
                }`
              : [details.data?.year, details.data?.runtime ? `${details.data.runtime} min` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {companion.installed ? (
            companion.isOutdated ? (
              <Link
                to="/extension"
                className="group inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 backdrop-blur-sm transition-all hover:border-amber-500/40 hover:bg-amber-500/15 hover:text-amber-200"
                title={`Your extension is v${companion.version || '1.0.0'}. Click to update to v${LATEST_EXTENSION_VERSION}.`}
              >
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Update Extension</span>
                <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-mono text-amber-200">v{LATEST_EXTENSION_VERSION}</span>
              </Link>
            ) : (
              <Link
                to="/extension"
                className="group inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                title={`Zenkai Extension v${companion.version || LATEST_EXTENSION_VERSION} active.`}
              >
                <span className="size-1.5 rounded-full bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span>Extension Active</span>
                {companion.version && (
                  <span className="text-[10px] text-white/35 font-mono">v{companion.version}</span>
                )}
              </Link>
            )
          ) : (
            <Link
              to="/extension"
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/60 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            >
              <Zap className="size-3 text-white/40 transition-colors group-hover:text-white" />
              <span>Get Extension</span>
            </Link>
          )}
          {type === 'tv' && (
            <>
              <button type="button" disabled={!prevTarget} onClick={() => prevTarget && go({ s: prevTarget.s, e: prevTarget.e })} className={cn(pill, 'inline-flex items-center gap-1.5 border-border bg-card/60 disabled:opacity-35')}>
                <ChevronLeft className="size-4" /> Prev
              </button>
              <button type="button" disabled={!nextTarget} onClick={() => nextTarget && go({ s: nextTarget.s, e: nextTarget.e })} className={cn(pill, 'inline-flex items-center gap-1.5 border-transparent bg-foreground text-background disabled:opacity-35')}>
                Next <ChevronRight className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* MovieBox Controls: Audio Dubs, Quality Selector & Direct MP4 Downloads */}
      {isMovieBox && mbStream.data && (
        <div className="mt-4 flex flex-col gap-3 px-3 sm:px-6 lg:px-0">
          {/* Audio options: always shows Original, language dubs, and unverified tracks */}
          {mbStream.data.dubs && mbStream.data.dubs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/40 p-3 backdrop-blur">
              <span className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-muted">
                <Languages className="size-3.5 text-accent" /> Audio:
              </span>
              {mbStream.data.dubs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => pickDub(d.id)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95',
                    d.selected
                      ? 'bg-accent text-accent-fg shadow-md shadow-accent/20'
                      : 'border border-border bg-card/70 text-muted hover:border-accent hover:text-foreground'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {/* Quality switcher & Direct MP4 Download bar */}
          {availableStreams.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 p-3 backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-muted">
                  <SlidersHorizontal className="size-3.5 text-accent" /> Quality:
                </span>
                {availableStreams.map((s) => {
                  const isCur = (activeStream?.quality || mbStream.data?.quality) === s.quality
                  return (
                    <button
                      key={s.quality}
                      type="button"
                      onClick={() => {
                        setSelectedQuality(s.quality)
                        toast(`Quality switched to ${s.quality}${s.sizeLabel ? ` (${s.sizeLabel})` : ''}`)
                      }}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95',
                        isCur
                          ? 'bg-accent text-accent-fg shadow-md shadow-accent/20'
                          : 'border border-border bg-card/70 text-muted hover:border-accent hover:text-foreground'
                      )}
                    >
                      <span>{s.quality}</span>
                      {s.sizeLabel && (
                        <span className={cn('text-[10px] font-mono opacity-80', isCur ? 'text-accent-fg' : 'text-muted')}>
                          {s.sizeLabel}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Direct download button */}
              <div className="flex items-center gap-2">
                {activeStream && (
                  <a
                    href={activeStream.downloadUrl}
                    download={activeStream.downloadFileName || `${title} (${activeStream.quality}).mp4`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => toast(`Starting download: ${title} (${activeStream.quality})`)}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-1.5 text-xs font-bold text-white transition active:scale-95 shadow-sm"
                  >
                    <Download className="size-3.5 text-accent" />
                    <span>Download MP4</span>
                    {activeStream.sizeLabel && (
                      <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                        {activeStream.sizeLabel}
                      </span>
                    )}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Direct server */}
      <section className="mt-5 flex flex-wrap items-center gap-3 px-3 sm:px-6 lg:px-0" aria-label="Source">
        {providers.loading ? (
          <Skeleton className="h-11 w-48 rounded-2xl" />
        ) : (
          direct.length > 0 && (
            <ServerPopup
              servers={direct.map((p) => ({ id: p.id, name: p.label, label: p.tags.join(' · '), tags: p.tags }))}
              value={providerId ?? ''}
              onPick={pick}
            />
          )
        )}
      </section>

      <div className="mt-5 px-3 sm:px-6 lg:px-0">
        <SupportCard />
      </div>

      {/* Multi audio + embeds */}
      <div className="mt-5 space-y-4 px-3 sm:px-6 lg:px-0">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{g.label}</p>
            <div className="flex flex-wrap gap-2">
              {g.items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  className={cn(pill, p.id === providerId ? 'border-transparent bg-accent text-accent-fg shadow-lg shadow-accent/30' : 'border-border bg-card hover:bg-card-2')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Episodes */}
      {type === 'tv' && (
        <section className="mt-8 px-3 sm:px-6 lg:px-0" aria-label="Episodes">
          {seasons.length > 1 && (
            <div className="mb-4">
              <Tabs tabs={seasons.map((s) => ({ id: String(s.n), label: `S${s.n}` }))} value={String(season)} onChange={(v) => go({ s: v, e: 1 })} />
            </div>
          )}
          {eps.loading && !eps.data ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-xl" />)}
            </div>
          ) : (
            epTotal > 0 && (
              <EpisodeList total={epTotal} available={epTotal} current={episode} hrefFor={hrefFor} info={epInfo} fallbackImg={details.data?.backdrop ? `https://image.tmdb.org/t/p/w1280${details.data.backdrop}` : null} defaultRuntime={details.data?.runtime ?? null} />
            )
          )}
        </section>
      )}

      {details.error && <p className="mt-8 px-3 text-center text-sm text-muted">Couldn&rsquo;t load title details, but you can still play. <button type="button" className="underline" onClick={() => navigate(0)}>Reload</button></p>}
      </div>
    </main>
  )
}
