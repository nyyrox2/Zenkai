import { toast } from '../lib/toast'
import { recordProgressionActivity } from '../lib/ascension/ascensionStore'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useBackToDetails } from '../lib/backToDetails'
import { ChevronLeft, ChevronRight, Loader2, Lock, MessageSquare, TriangleAlert, Download, Users, Zap } from 'lucide-react'
import { ErrorState } from '../components/ErrorState'
import { ServerPopup } from '../components/ServerPopup'
import { EpisodeList } from '../components/EpisodeList'
import { InstallHelp } from '../components/InstallHelp'
import { Skeleton } from '../components/Skeleton'
import { Tabs } from '../components/Tabs'
import { useAsync } from '../hooks/useAsync'
import { useCompanion, LATEST_EXTENSION_VERSION } from '../lib/useCompanion'
import { HELPER_APK_DOWNLOAD_URL, launchHelperApp, probeHelperApk } from '../lib/helperClient'
import { cn } from '../lib/utils'
import {
  DIRECT_MOVIE_SERVER_IDS,
  fetchDetails,
  fetchEpisodes,
  fetchProviders,
  img,
  fetchMovieBoxStream,
  movieHref,
  resolveProvider,
  type MediaType,
  type MovieDub,
} from '../services/movies'
import { useShieldVerified, useShield, getToken } from '../lib/shield'
import CinePlayer from '../components/CinePlayer'
import { PartyChatPanel } from '../components/PartyChatPanel'
import { WatchTogetherModal } from '../components/WatchTogetherModal'
import { LiveReactionsOverlay } from '../components/LiveReactionsOverlay'
import { useMovieParty } from '../hooks/useMovieParty'
import { useMovieSkipTimes } from '../hooks/useMovieSkipTimes'
import { downloadMedia } from '../lib/download'

const pill = 'rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95'
const PREF = 'zk:movie-server:v1'
const DUB = 'moviebox::'
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

  // XP: a movie is worth 75, a TV episode 30. Native player reports progress; embeds can't, so they earn it by time on page.
  // ponytail: idempotency lives in recordProgressionActivity, so both paths firing is harmless
  const awardWatch = useCallback(() => {
    void recordProgressionActivity(
      type === 'movie'
        ? { action: 'watch_movie', xp: 75, refId: `tmdb_movie_${id}` }
        : { action: 'watch_episode', xp: 30, refId: `tmdb_tv_${id}_s${season}e${episode}` },
    )
  }, [type, id, season, episode])
  useEffect(() => {
    const t = window.setTimeout(awardWatch, (type === 'movie' ? 30 : 12) * 60_000)
    return () => window.clearTimeout(t)
  }, [awardWatch, type])

  const list = providers.data ?? []
  const providerId = list.find((p) => p.id === params.get('p'))?.id ?? list.find((p) => p.id === readPref())?.id ?? list[0]?.id
  const provider = list.find((p) => p.id === providerId)
  const isMovieBoxVariant = providerId === 'moviebox' || providerId === 'moviebox-regional'
  const isMovieBox = isMovieBoxVariant || Boolean(providerId && DIRECT_MOVIE_SERVER_IDS.has(providerId)) || Boolean(provider?.tags?.includes('Direct'))


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

  const companion = useCompanion()
  const [mbReload, setMbReload] = useState(0)
  const autoRetriedKeyRef = useRef<string | null>(null)
  const [playerAudio, setPlayerAudio] = useState<{ tracks: { i: number; label: string; lang: string }[]; active: number }>({
    tracks: [],
    active: 0,
  })
  const [audioSel, setAudioSel] = useState<{ i: number } | null>(null)

  // Direct stream extraction (MovieBox + Helper APK HDHub4u / MoviesDrive / Bollyflix / RogMovies)
  const canResolveDirect = sessionVerified || companion.apkConnected
  const mbStream = useAsync(
    () =>
      canResolveDirect && isMovieBox && details.data?.title
        ? fetchMovieBoxStream({
            id,
            type,
            season,
            episode,
            title: details.data.title,
            year: details.data.year || undefined,
            dubId: isMovieBoxVariant ? selectedDub : null,
            imdbId: details.data.imdbId,
            regional: providerId === 'moviebox-regional',
            serverId: providerId,
            fresh: mbReload > 0,
          })
        : Promise.resolve(null),
    [canResolveDirect, isMovieBox, isMovieBoxVariant, type, id, season, episode, details.data?.title, details.data?.year, selectedDub, details.data?.imdbId, companion.apkConnected, companion.extensionInstalled, providerId, mbReload]
  )

  // Automatically retry once when Helper APK is active and hits a transient empty/error response
  useEffect(() => {
    if (!isMovieBox || !companion.apkConnected || mbStream.loading) return
    const failed = Boolean(mbStream.error) || Boolean(mbStream.data && (!mbStream.data.success || !mbStream.data.streams?.length))
    if (!failed) return
    const reqKey = `${providerId}:${type}:${id}:${season}:${episode}:${selectedDub || ''}`
    if (autoRetriedKeyRef.current === reqKey) return
    autoRetriedKeyRef.current = reqKey
    const t = window.setTimeout(() => {
      void probeHelperApk(true)
      setMbReload((n) => n + 1)
    }, 650)
    return () => window.clearTimeout(t)
  }, [isMovieBox, companion.apkConnected, mbStream.loading, mbStream.error, mbStream.data, providerId, type, id, season, episode, selectedDub])

  const [dubCache, setDubCache] = useState<{ id: number; dubs: MovieDub[] } | null>(null)
  useEffect(() => {
    if (mbStream.data?.dubs?.length) setDubCache({ id, dubs: mbStream.data.dubs })
  }, [mbStream.data, id])

  // Automatically select regional dub when Regional HLS server is selected without explicit dub param
  useEffect(() => {
    if (providerId === 'moviebox-regional' && !params.get('dub') && mbStream.data?.dubs?.length) {
      const reg = mbStream.data.dubs.find((d) => /hindi|tamil|telugu|kannada|malayalam|bengali|marathi|punjabi/i.test(d.label) && d.label.toLowerCase() !== 'original');
      if (reg && reg.id && reg.id !== selectedDub) {
        setSelectedDub(reg.id.replace(/^-/, ''));
      }
    }
  }, [providerId, mbStream.data?.dubs, params, selectedDub]);

  // audio versions live on MovieBox only; remember them so they stay listed while another server is open
  const dubs = mbStream.data?.dubs ?? (dubCache?.id === id ? dubCache.dubs : [])
  const curDub = dubs.find((d) => d.selected)?.id ?? dubs[0]?.id

  // Watch Together (same room engine as anime; rooms ride the existing watch_rooms table)
  const [partyOpen, setPartyOpen] = useState(false)
  const party = useMovieParty({
    type,
    id,
    title: details.data?.title ?? '',
    season,
    episode,
    provider: providerId ?? '',
    roomParam: params.get('room'),
    setRoomParam: (r) =>
      setParams((prev) => {
        const n = new URLSearchParams(prev)
        r ? n.set('room', r) : n.delete('room')
        return n
      }, { replace: true }),
    dub: providerId === 'moviebox' ? (selectedDub ?? curDub ?? null) : null,
    apply: (patch) => go({ ...(patch.s != null ? { s: patch.s } : {}), ...(patch.e != null ? { e: patch.e } : {}), ...(patch.p ? { p: patch.p, dub: null } : {}), ...(patch.d ? { dub: patch.d } : {}) }),
    navigate,
  })
  const isGuest = Boolean(party.room && !party.room.isHost)

  const availableStreams = mbStream.data?.streams || []
  const activeStream = useMemo(() => {
    if (!availableStreams.length) return null
    if (selectedQuality) {
      const found = availableStreams.find((s) => s.quality === selectedQuality)
      if (found) return found
    }
    return availableStreams[0]
  }, [availableStreams, selectedQuality])

  // real intro / credits times (TheIntroDB); asked once the stream's length is known so the right release matches
  const skipTimes = useMovieSkipTimes({ tmdbId: id, type, season, episode, duration: activeStream?.duration, on: isMovieBox && !!mbStream.data })

  const activeStreamUrl = companion.apkConnected
    ? (activeStream?.streamUrl || activeStream?.proxyStreamUrl || mbStream.data?.streamUrl || '')
    : companion.extensionInstalled
      ? (activeStream?.rawStreamUrl || activeStream?.url || activeStream?.streamUrl || '')
      : (activeStream?.proxyStreamUrl || activeStream?.streamUrl || mbStream.data?.streamUrl || '')
  const fallbackStreamUrl = activeStream?.proxyStreamUrl || mbStream.data?.proxyStreamUrl || ''
  
  const isMovie = type === 'movie'
  const rawTitle = details.data?.title || mbStream.data?.title || 'Movie'
  const releaseYear = details.data?.year || ''

  const computedDownloadFileName = useMemo(() => {
    const q = activeStream?.quality || mbStream.data?.quality || 'HD'
    const activeDub = dubs.find((d) => d.id === curDub)
    const dubTag = activeDub && activeDub.id !== 'default' ? `[${activeDub.label}]` : ''
    if (isMovie) {
      return [rawTitle, releaseYear ? `(${releaseYear})` : '', dubTag, `[${q}].mp4`].filter(Boolean).join(' ').trim()
    }
    const epTag = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
    return [rawTitle, epTag, dubTag, `[${q}].mp4`].filter(Boolean).join(' ').trim()
  }, [isMovie, rawTitle, releaseYear, dubs, curDub, season, episode, activeStream?.quality, mbStream.data?.quality])

  const activeDownloadFileName = computedDownloadFileName || activeStream?.downloadFileName || mbStream.data?.downloadFileName || 'video.mp4'
  const activeRawUrl = activeStream?.rawStreamUrl || activeStream?.url || mbStream.data?.rawStreamUrl || ''
  const activeDownloadUrl = activeStream?.downloadUrl || mbStream.data?.downloadUrl || ''

  const handleTriggerDownload = useCallback(() => {
    downloadMedia({
      url: activeDownloadUrl,
      rawUrl: activeRawUrl,
      filename: activeDownloadFileName,
    })
  }, [activeDownloadUrl, activeRawUrl, activeDownloadFileName])

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
    // a guest cannot change season / episode / server by hand (the host's changes come through party.apply)
    if (('s' in next || 'e' in next || 'p' in next) && party.guestLocked()) {
      toast('Only the party host can change this', 'info')
      return
    }
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) v === null ? p.delete(k) : p.set(k, String(v))
    setParams(p, { replace: true })
    party.announce({ s: Number(p.get('s')) || 1, e: Number(p.get('e')) || 1, p: p.get('p') ?? providerId ?? '' })
  }

  function pick(pid: string) {
    if (party.guestLocked()) return toast('Only the party host can change the server', 'info')
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

  // each MovieBox audio version is its own entry in the server list
  function pickAny(sid: string) {
    if (party.guestLocked()) return toast('Only the party host can change the server', 'info')
    if (!sid.startsWith(DUB)) return pick(sid)
    const dub = sid.slice(DUB.length)
    if (isMovieBox) return pickDub(dub)
    try {
      localStorage.setItem(PREF, 'moviebox')
    } catch {
      /* private mode */
    }
    setSelectedDub(dub)
    go({ p: 'moviebox', dub })
    toast(`Switched to Direct HLS · ${dubs.find((d) => d.id === dub)?.label ?? 'audio'}`)
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
  const expand = (p: (typeof list)[number]) =>
    (p.id === 'moviebox' || p.id === 'moviebox-regional') && dubs.length > 1
      ? dubs.map((d) => ({ id: DUB + d.id, name: `${p.label} · ${d.label}`, label: '', note: '', tags: [] as string[] }))
      : [{ id: p.id, name: p.label, label: '', note: '', tags: [] as string[] }]
  const serverValue = isMovieBoxVariant && dubs.length > 1 && curDub ? DUB + curDub : providerId ?? ''
  const direct = list.filter((p) => p.tags.includes('Direct'))
  const groups = [
    { label: 'Direct HLS Player (Native)', items: list.filter((p) => p.tags.includes('Direct')) },
    { label: 'Regional Servers', items: list.filter((p) => !p.tags.includes('Direct') && p.tags.includes('Regional')) },
    { label: 'Multi audio & 4K', items: list.filter((p) => !p.tags.includes('Direct') && !p.tags.includes('Regional') && p.tags.includes('Multi audio')) },
    { label: 'Embeds', items: list.filter((p) => !p.tags.includes('Direct') && !p.tags.includes('Regional') && !p.tags.includes('Multi audio')) },
  ].filter((g) => g.items.length > 0)
  const hrefFor = (n: number) => {
    const q = new URLSearchParams(params)
    q.set('s', String(season))
    q.set('e', String(n))
    return `/movies/watch/${type}/${id}?${q}`
  }
  const nextServer = list[(list.findIndex((p) => p.id === providerId) + 1) % Math.max(list.length, 1)]

  const chatPanel = (glass: boolean, className?: string, bare?: boolean) =>
    party.room ? (
      <PartyChatPanel
        glass={glass}
        bare={bare}
        className={className}
        messages={party.chat}
        selfId={party.room.peerId}
        online={party.peers.length}
        onClose={() => party.setChatOpen(false)}
        onSend={party.sendChat}
        onReact={party.react}
      />
    ) : null
  const backdrop = details.data?.backdrop ? `https://image.tmdb.org/t/p/w1280${details.data.backdrop}` : details.data?.poster ? `https://image.tmdb.org/t/p/w500${details.data.poster}` : null

  const watchPanel = (
    <WatchTogetherModal
        open={partyOpen}
        onClose={() => { setPartyOpen(false); party.setChatOpen(false) }}
        tab={party.chatOpen ? 'chat' : 'room'}
        onTab={(t) => party.setChatOpen(t === 'chat')}
        unread={party.unread}
        chat={chatPanel(true, 'h-full', true)}
        room={party.room}
        peers={party.peers}
        onSendReaction={party.react}
        onCreateRoom={party.create}
        onJoinRoom={party.join}
        onLeaveRoom={party.leave}
        onForceSync={party.forceSync}
        animeTitle={title}
        animeId={id}
        image={backdrop}
        episode={type === 'tv' ? episode : 1}
        isHost={party.room ? party.room.isHost : false}
        connectionStatus={party.status}
        shareUrl={party.shareUrl}
        />
  )

  return (
    <main className="relative pb-10">
      <div className="mx-auto max-w-7xl lg:px-6 lg:pt-6">
      {/* Player (+ party chat docked at ~24% beside it on desktop) */}
      <div className="lg:flex lg:items-stretch lg:gap-3">
      <div className="min-w-0 flex-1">
      <div className="relative aspect-video w-full overflow-hidden bg-black lg:shadow-2xl lg:shadow-black/40 lg:ring-1 lg:ring-white/10">
        {!canResolveDirect && isMovieBox ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 text-center select-none">
            <div className="relative mb-3 grid size-16 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent shadow-xl shadow-black/50">
              <Lock className="size-8 animate-pulse" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Media Playback Locked</h3>
            <p className="mt-1.5 max-w-sm text-xs text-muted leading-relaxed">
              Verification challenge in progress. Start Zenkai Helper APK for instant direct playback without waiting, or wait for verification.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {shieldFailed && (
                <button onClick={() => void getToken()} className="rounded-full bg-white px-5 py-2 text-xs font-bold text-black active:scale-95">
                  Retry
                </button>
              )}
              <button onClick={() => launchHelperApp()} className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white active:scale-95">
                Launch Helper APK
              </button>
            </div>
          </div>
        ) : isMovieBox ? (
          <>
            {mbStream.data && (mbStream.data.streams?.length || 0) > 0 && (
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
                onProgress={(pos, dur) => { if (dur > 0 && pos / dur >= 0.8) awardWatch() }}
                format={type === 'movie' ? 'MOVIE' : 'TV'}
                streamFormat={activeStream?.format || mbStream.data?.format}
                onAudioTracks={(tracks, active) => setPlayerAudio({ tracks, active })}
                audioSel={audioSel}
                directSubtitles={(mbStream.data.subtitles || []).map((s, idx) => ({
                  id: s.id || `sub-${idx}`,
                  label: s.label,
                  lang: s.language || s.lang,
                  url: s.url,
                }))}
                qualities={availableStreams.map((s) => ({
                  label: s.quality,
                  url: (companion.apkConnected
                    ? (s.streamUrl || s.proxyStreamUrl)
                    : companion.extensionInstalled
                      ? (s.rawStreamUrl || s.url || s.streamUrl)
                      : (s.proxyStreamUrl || s.streamUrl)) || '',
                  size: s.size,
                  sizeLabel: s.sizeLabel,
                  downloadUrl: s.downloadUrl,
                  downloadFileName: s.downloadFileName || computedDownloadFileName,
                  rawUrl: s.rawStreamUrl || s.url,
                }))}
                currentQuality={activeStream?.quality || mbStream.data?.quality}
                onQualityChange={(q: { label: string }) => setSelectedQuality(q.label)}
                downloadUrl={activeDownloadUrl}
                downloadFileName={activeDownloadFileName}
                rawDownloadUrl={activeRawUrl}
                onDownload={handleTriggerDownload}
                servers={list.flatMap(expand)}
                serverId={serverValue}
                onServer={pickAny}
                dubs={isMovieBoxVariant ? dubs : []}
                onDub={pickDub}
                hasNextEpisode={!!nextTarget}
                hasPrevEpisode={!!prevTarget}
                onNextEpisode={() => nextTarget && go({ s: nextTarget.s, e: nextTarget.e })}
                onPrevEpisode={() => prevTarget && go({ s: prevTarget.s, e: prevTarget.e })}
                onSelectEpisode={(n) => go({ e: n })}
                switching={mbStream.loading}
                intro={skipTimes.intro}
                outro={skipTimes.outro}
                onVideoRef={party.setVideo}
                onPlayerAction={party.onPlayerAction}
                externalControl={party.external}
                onWatchTogetherClick={() => setPartyOpen((o) => !o)}
                watchPartyActive={Boolean(party.room)}
                watchPartyPeersCount={party.peers.length}
                isPartyGuest={isGuest}
                onChatClick={() => { const on = !(party.chatOpen && partyOpen); party.setChatOpen(on); if (on) setPartyOpen(true) }}
                chatOpen={party.chatOpen}
                chatUnread={party.unread}
                chatPanel={chatPanel(true, 'h-full')}
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
                  <Loader2 className="size-5 animate-spin" /> Resolving {provider?.label ?? 'Direct'} stream…
                </span>
              </div>
            )}
            {(mbStream.error || (mbStream.data && (!mbStream.data.success || !mbStream.data.streams?.length))) && !mbStream.loading && (() => {
              const rawMsg = mbStream.error?.message || mbStream.data?.error || `${provider?.label ?? 'Server'} stream not available for this title.`
              const needsHelper = rawMsg.startsWith('HELPER_APK_REQUIRED:')
              const cleanMsg = needsHelper ? rawMsg.replace('HELPER_APK_REQUIRED:', '') : rawMsg
              return (
                <div role="alert" className="absolute inset-0 grid place-items-center bg-black p-6 text-center text-white">
                  <div className="flex max-w-md flex-col items-center gap-3">
                    <TriangleAlert className="size-7 text-amber-400" />
                    <p className="text-sm text-white/80">{cleanMsg}</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {needsHelper && (
                        <>
                          <a
                            href={HELPER_APK_DOWNLOAD_URL}
                            download="ZenkaiHelper.apk"
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-white transition active:scale-95"
                          >
                            <Download className="size-3.5" /> Download Helper APK
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              launchHelperApp()
                              window.setTimeout(() => { void probeHelperApk(true); mbStream.reload() }, 1400)
                            }}
                            className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition active:scale-95"
                          >
                            Launch Helper &amp; Retry
                          </button>
                        </>
                      )}
                      {nextServer && nextServer.id !== providerId ? (
                        <button type="button" onClick={() => pick(nextServer.id)} className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-black transition active:scale-95">
                          Try {nextServer.label}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            void probeHelperApk(true)
                            setMbReload((n) => n + 1)
                          }}
                          className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-black transition active:scale-95"
                        >
                          Try again
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
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
        <LiveReactionsOverlay reactions={party.reactions} syncNotice={party.notice} />
      </div>
      </div>
      {watchPanel}
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
          {companion.apkConnected ? (
            <Link
              to="/extension"
              className="group inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 backdrop-blur-sm transition-all hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-white"
              title={`Zenkai Helper APK v${companion.apkVersion || '1.0.0'} running at ${companion.helperUrl}`}
            >
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span>Helper APK Active</span>
              {companion.apkVersion && (
                <span className="text-[10px] text-emerald-200/60 font-mono">v{companion.apkVersion}</span>
              )}
            </Link>
          ) : companion.installed ? (
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
              <span>Get Helper APK</span>
            </Link>
          )}
          {!companion.installed && <InstallHelp />}
          <button type="button" onClick={() => setPartyOpen((o) => !o)} className={cn(pill, 'inline-flex items-center gap-1.5 border-border bg-card/60', party.room && 'text-accent')}>
            <Users className="size-4" /> {party.room ? `Party · ${party.peers.length}` : 'Watch Together'}
          </button>
          {party.room && (
            <button type="button" onClick={() => { const on = !(party.chatOpen && partyOpen); party.setChatOpen(on); if (on) setPartyOpen(true) }} aria-pressed={party.chatOpen} className={cn(pill, 'relative inline-flex items-center gap-1.5 border-border bg-card/60', party.chatOpen && 'text-accent')}>
              <MessageSquare className="size-4" /> Chat
              {!party.chatOpen && party.unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-fg">{party.unread > 9 ? '9+' : party.unread}</span>}
            </button>
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

      {party.room && !isMovieBox && (
        <p className="mt-3 px-3 text-xs text-muted sm:px-6 lg:px-0">Playback sync works on Zenkai player servers. Embed servers can&rsquo;t be synced, chat and reactions still work.</p>
      )}

      {/* Direct server */}
      <section className="mt-5 flex flex-wrap items-center gap-3 px-3 sm:px-6 lg:px-0" aria-label="Source">
        {providers.loading ? (
          <Skeleton className="h-11 w-48 rounded-2xl" />
        ) : (
          direct.length > 0 && (
            <ServerPopup
              servers={direct.flatMap(expand)}
              value={serverValue}
              onPick={pickAny}
            />
          )
        )}
        {isMovieBox && (activeDownloadUrl || activeRawUrl) && (
          <button
            type="button"
            onClick={handleTriggerDownload}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-foreground/[0.06] active:scale-95"
          >
            <Download className="size-4 text-accent" />
            Download
            {activeStream && <span className="text-xs text-muted">{activeStream.quality}{activeStream.sizeLabel ? ` · ${activeStream.sizeLabel}` : ''}</span>}
          </button>
        )}
      </section>

      {/* Audio Channels / Dub switcher */}
      {(playerAudio.tracks.length > 0 || (isMovieBoxVariant && dubs.length > 0)) && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 px-3 sm:px-6 lg:px-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-1">
            {playerAudio.tracks.length > 0 ? 'Audio Channels:' : 'Audio Dub:'}
          </span>
          {playerAudio.tracks.length > 0
            ? playerAudio.tracks.map((t) => (
                <button
                  key={t.i}
                  type="button"
                  onClick={() => setAudioSel({ i: t.i })}
                  className={cn(
                    pill,
                    playerAudio.active === t.i
                      ? 'border-transparent bg-accent text-accent-fg shadow-md shadow-accent/25'
                      : 'border-border bg-card hover:bg-card-2 text-xs'
                  )}
                >
                  {t.label}
                </button>
              ))
            : dubs.map((d) => {
                const isSelected = selectedDub === d.id || (!selectedDub && d.selected) || (!selectedDub && d.id === curDub);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => pickDub(d.id)}
                    className={cn(
                      pill,
                      isSelected
                        ? 'border-transparent bg-accent text-accent-fg shadow-md shadow-accent/25'
                        : 'border-border bg-card hover:bg-card-2 text-xs'
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
        </div>
      )}

      <div className="mt-5 px-3 sm:px-6 lg:px-0">
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
        <section className={cn('mt-8 px-3 sm:px-6 lg:px-0', isGuest && 'pointer-events-none opacity-60')} aria-label="Episodes">
          {isGuest && <p className="mb-3 text-xs font-semibold text-muted">The party host picks the episode.</p>}
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
