import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useBackToDetails } from '../lib/backToDetails'
import { ChevronLeft, ChevronRight, ExternalLink, Flag, Info, Loader2, Lock, ShieldCheck, X } from 'lucide-react'
import { submitStreamReport } from '../lib/supabase'
import { fetchAnimeLite } from '../services/anilist'
import { acdnMapped, fetchAnimeSalt, fetchStream, fetchEpisodeServers, type ServerAudioMap, tmdbImg } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useTmdb } from '../hooks/useTmdb'
import { useEpisodes } from '../hooks/useEpisodes'
import { useFiller } from '../hooks/useFiller'
import { useFlag } from '../hooks/useFlag'
import { SERVERS, DIRECT, serverById, type EmbedCtx } from '../lib/servers'
import { episodeCounts } from '../lib/episodes'
import { lastEpisode, saveEpisode } from '../lib/progress'
import { toast } from '../lib/toast'
import { finishEpisode, getHistory, getPrefs, savePrefs, touchHistory } from '../lib/library'
import { mediaToCard } from '../lib/mappers'
import { ListButton } from '../components/ListButton'
import { cn, formatLabel, formatStatus, pickTitle, stripHtml } from '../lib/utils'
import CinePlayer from '../components/CinePlayer'
import { EpisodeList } from '../components/EpisodeList'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import { LoadingGrid } from '../components/LoadingGrid'
import { LogoFill } from '../components/LogoFill'
import { LOGO_URL } from '../lib/constants'
import { Tour, tourDone, tourSeen, type TourStep } from '../components/Tour'
import { ServerPopup, type ServerOpt } from '../components/ServerPopup'
import { useShieldVerified, getToken } from '../lib/shield'
import { BorderBeam } from '../components/BorderBeam'
import { StreamProblem } from '../components/StreamProblem'


function Frame({ children }: { children: React.ReactNode }) {
  return <div data-tour="w-player" className="relative aspect-video w-full overflow-hidden bg-black lg:shadow-2xl lg:shadow-black/40 lg:ring-1 lg:ring-white/10">{children}</div>
}

/** Loading (episode, first load and server switch): the show's logo fills from dim to full colour. No logo: the Zenkai logo fills smoothly, plus quiet server switch. */
function Loading({ quiet, logo }: { quiet?: boolean; logo: string | null }) {
  return (
    <Frame>
      <div className="absolute inset-0 grid place-items-center">
        <LogoFill src={logo || LOGO_URL} />
      </div>
      {!quiet && <LoadingGrid className="absolute bottom-3 left-3 text-white/60 sm:bottom-4 sm:left-4" />}
    </Frame>
  )
}

/** Unavailable server: friendly mascot scene. The raw reason is kept off-screen (data-reason) so users never see backend wording. */
function Problem({ message, onReconnect, children }: { message?: string; onReconnect?: () => void; children?: React.ReactNode }) {
  return (
    <Frame>
      <StreamProblem reason={message} onReconnect={onReconnect}>
        {children}
      </StreamProblem>
    </Frame>
  )
}

const WATCH_TOUR: TourStep[] = [
  { target: '[data-tour="w-player"]', title: 'Your player', text: 'Tap the video for its controls. Everything below changes what plays here.' },
  { target: '[data-tour="w-audio"]', title: 'Audio', text: 'Pick sub or dub. On multi-audio servers every language in the stream is listed here.' },
  { target: '[data-tour="w-servers"]', title: 'Direct servers', text: 'Select a server from here. If one is slow or empty, try another.' },
  { target: '[data-tour="w-more"]', title: 'More servers', text: 'Multi-audio and embed servers are one tap away too.' },
  { target: '[data-tour="w-eps"]', title: 'Episodes', text: 'Jump to any episode from this list.' },
]

const pill = 'rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95'

export default function WatchPage() {
  const id = Number(useParams().id)
  const backTo = useBackToDetails()
  const [sp, setSp] = useSearchParams()
  const [autoNext, setAutoNext] = useFlag('zk:autonext', true)
  const [autoSkip, setAutoSkip] = useFlag('zk:autoskip', false)
  const [skipFiller, setSkipFiller] = useFlag('zk:skipfiller', false)

  const shieldOk = useShieldVerified()
  // once verified, stay verified: a token refresh mid-session must not unmount the player (that kicks it out of fullscreen)
  const [everOk, setEverOk] = useState(shieldOk)
  useEffect(() => {
    if (shieldOk) setEverOk(true)
  }, [shieldOk])
  const sessionVerified = shieldOk || everOk
  useEffect(() => {
    if (!shieldOk) {
      void getToken()
    }
  }, [shieldOk])
  const [loadKind, setLoadKind] = useState<'episode' | 'server'>('episode')
  const [aud, setAud] = useState<{ tracks: { i: number; label: string; lang: string }[]; active: number }>({ tracks: [], active: 0 })
  const [tourOn, setTourOn] = useState(false)
  const [pageTourDone, setPageTourDone] = useState(() => tourSeen('watch'))
  const [audSel, setAudSel] = useState<{ i: number } | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportIssue, setReportIssue] = useState("Broken / Won't Play")
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const anime = useAsync(() => fetchAnimeLite(id), [id])
  const a = anime.data
  const title = a ? pickTitle(a.title) : ''
  const { total, available } = a ? episodeCounts(a) : { total: 0, available: 0 }

  const rawEp = Number(sp.get('ep')) || lastEpisode(id) || 1
  const ep = a ? Math.min(Math.max(1, rawEp), Math.max(available, 1)) : rawEp
  // URL wins, then what this title last used, then the last server/audio used anywhere
  const saved = useMemo(() => ({ ...getPrefs(), ...getHistory(id) }), [id])
  const acdn = useAsync(() => acdnMapped(id), [id]).data
  const serverAudioQuery = useAsync(
    () => (a ? fetchEpisodeServers(id, ep, title) : Promise.resolve({} as ServerAudioMap)),
    [id, ep, title, sessionVerified]
  )
  const serverAudio = serverAudioQuery.data
  const wanted = serverById(sp.get('server') ?? saved.server ?? 'megaplay')
  const server = wanted.id === 'acdn' && acdn === false ? serverById('megaplay') : wanted
  const directList = DIRECT.filter((s) => s.id !== 'acdn' || acdn === true)
  const audio: 'sub' | 'dub' = (sp.get('audio') ?? saved.audio) === 'dub' ? 'dub' : 'sub'
  // Where "try another" (button or plugging Plugo in) sends people when the current server has nothing
  const altId = server.kind === 'animesalt' ? (server.id === 'animesalt-1' ? 'animesalt-2' : 'megaplay') : (directList.find((s) => s.id !== server.id)?.id ?? 'megaplay')
  const altName = serverById(altId).name

  function go(patch: { ep?: number; server?: string; audio?: string }, replace = true) {
    setLoadKind(patch.server ? 'server' : 'episode')
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('ep', String(patch.ep ?? ep))
        n.set('server', patch.server ?? server.id)
        n.set('audio', patch.audio ?? audio)
        return n
      },
      { replace },
    )
  }

  const bundle = useTmdb(a?.id, title, a?.format)
  const logo = tmdbImg(bundle?.tmdb?.logo, 'w500')
  const eps = useEpisodes(bundle?.tmdb ?? null, a?.streamingEpisodes)
  const kinds = useFiller(a)
  const ctx: EmbedCtx = useMemo(
    () => ({
      anilistId: id,
      malId: bundle?.mapping?.mal ?? a?.idMal ?? null,
      tmdb: bundle?.mapping?.tmdb ?? (bundle?.tmdb ? { id: bundle.tmdb.id, type: bundle.tmdb.type, season: bundle.tmdb.season } : null),
      episode: ep,
      audio,
      isMovie: a?.format === 'MOVIE',
    }),
    [id, bundle, a, ep, audio],
  )

  const stream = useAsync(
    async () => (a && sessionVerified && server.kind === 'direct' ? fetchStream({ id, ep, server: server.id, audio, title, format: a.format }) : null),
    [a?.id, ep, server.id, audio, sessionVerified],
  )
  const salt = useAsync(
    async () => (a && sessionVerified && server.kind === 'animesalt' ? fetchAnimeSalt({ id, ep, title, format: a.format, server: server.salt ?? '1' }) : null),
    [a?.id, ep, server.id, sessionVerified],
  )
  // Keep the player mounted across episode / audio changes: last good stream stays until the new one lands
  const [held, setHeld] = useState<{ d: NonNullable<typeof stream.data>; ep: number; audio: 'sub' | 'dub'; sid: string } | null>(null)
  useEffect(() => {
    if (stream.data) setHeld({ d: stream.data, ep, audio, sid: server.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.data])
  const cur = stream.data ? { d: stream.data, ep, audio } : held && held.sid === server.id && !stream.error ? held : null
  const serverBusy = loadKind === 'server' && (stream.loading || salt.loading)
  const embedSrc = sessionVerified && server.kind === 'embed' ? (server.url?.(ctx) ?? null) : null

  useEffect(() => {
    if (a) saveEpisode(id, ep)
  }, [a, id, ep])

  const ready = !!(a && (server.kind === 'direct' ? stream.data : server.kind === 'animesalt' ? salt.data : embedSrc))
  // Save episode, prefs and touch continue watching immediately so this show is instantly first
  useEffect(() => {
    if (!a) return
    touchHistory(mediaToCard(a), { ep, server: server.id, audio })
    savePrefs({ server: server.id, ...(server.audio ? { audio } : {}) })
  }, [a, ep, server.id, server.audio, audio])
  useEffect(() => {
    if (title) document.title = `${title} · Episode ${ep} — Zenkai`
  }, [title, ep])

  const playerServers = useMemo(
    () =>
      directList.map((s) => {
        const info = serverAudio?.[s.id]
        let tags: string[] = []
        if (serverAudioQuery.loading) {
          tags = ['CHECKING…']
        } else if (info) {
          if (info.sub) tags.push('SUB')
          if (info.dub) tags.push('DUB')
          if (tags.length === 0) tags.push('N/A')
        }
        return {
          id: s.id,
          name: s.name,
          note: tags.length ? tags.join(' · ') : s.note,
          tags,
        }
      }),
    [directList, serverAudio, serverAudioQuery.loading]
  )
  const tracks = (server.multi || aud.tracks.length > 1) ? aud.tracks : []
  // first visit: pause and walk through the page once the player area has rendered
  useEffect(() => {
    if (!ready || pageTourDone || tourOn) return
    const t = window.setTimeout(() => setTourOn(true), 800)
    return () => window.clearTimeout(t)
  }, [ready, pageTourDone, tourOn])
  const hrefFor = (n: number) => `/watch/${id}?ep=${n}&server=${server.id}&audio=${audio}`
  // Next / prev jump over filler and recap episodes while "skip filler" is on (mixed episodes are never skipped)
  const step = (d: 1 | -1) => {
    for (let n = ep + d; n >= 1 && n <= available; n += d) {
      const k = kinds.get(n)
      if (!skipFiller || (k !== 'filler' && k !== 'recap')) return n
    }
  }
  const next = step(1)
  const prev = step(-1)
  const hasNext = next !== undefined
  const hasPrev = prev !== undefined
  const sequel = a?.relations.edges.find((e) => e.relationType === 'SEQUEL' && e.node.type === 'ANIME')

  if (anime.error) {
    return (
      <main className="grid min-h-[70svh] place-items-center px-4 pt-24">
        <ErrorState message={anime.error.message} onRetry={anime.reload} />
      </main>
    )
  }

  const direct: ServerOpt[] = directList.map((s) => {
    const info = serverAudio?.[s.id]
    let tags = serverAudioQuery.loading ? ['CHECKING…'] : ['SUB', 'DUB']
    if (info) {
      tags = []
      if (info.sub) tags.push('SUB')
      if (info.dub) tags.push('DUB')
      if (tags.length === 0) tags = ['N/A']
    }
    return {
      id: s.id,
      name: s.name,
      label: s.multi ? 'Zenkai player · Multi audio' : 'Zenkai player',
      tags,
    }
  })

  const currentServerInfo = serverAudio?.[server.id]
  const hasDub = currentServerInfo ? currentServerInfo.dub : false
  const hasSub = currentServerInfo ? currentServerInfo.sub : true

  // If currently selected server does not have DUB for this episode, auto fallback to SUB
  useEffect(() => {
    if (currentServerInfo && !currentServerInfo.dub && audio === 'dub' && currentServerInfo.sub) {
      go({ audio: 'sub' })
    }
  }, [currentServerInfo, audio])

  return (
    <main className="relative pb-10">
      <div className="mx-auto max-w-7xl lg:px-6 lg:pt-6">
        <div className="min-w-0">
          {/* Player */}
          {!sessionVerified ? (
            <Frame>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 text-center select-none">
                <div className="relative mb-3 grid size-16 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent shadow-xl shadow-black/50">
                  <Lock className="size-8 animate-pulse" />
                  <BorderBeam size={80} duration={4} />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground">Media Playback Locked</h3>
                <p className="mt-1.5 max-w-sm text-xs text-muted leading-relaxed">
                  Verification challenge in progress. Complete the challenge to unlock high-speed streaming.
                </p>
              </div>
            </Frame>
          ) : !a ? (
            <Loading quiet={serverBusy} logo={logo} />
          ) : server.kind === 'direct' ? (
            !cur && stream.loading ? (
              <Loading quiet={serverBusy} logo={logo} />
            ) : !cur ? (
              <Problem message={stream.error?.message ?? 'No stream found.'} onReconnect={() => go({ server: altId })}>
                <button onClick={() => go({ server: altId })} className={cn(pill, 'border-transparent bg-white text-black')}>
                  Try {altName}
                </button>
                {server.audio && (
                  <button onClick={() => go({ audio: audio === 'sub' ? 'dub' : 'sub' })} className={cn(pill, 'border-white/15 bg-white/5 text-white')}>
                    {audio === 'sub' ? 'DUB' : 'SUB'} instead
                  </button>
                )}
              </Problem>
            ) : (
              <Frame>
                <CinePlayer
                  key={server.id}
                  hasDub={hasDub}
                  switching={stream.loading}
                  streamUrl={cur.d.streamUrl}
                  intro={cur.d.intro}
                  outro={cur.d.outro}
                  title={title}
                  episode={cur.ep}
                  totalEpisodes={total}
                  availableEpisodes={available}
                  animeId={id}
                  format={a.format}
                  directSubtitles={cur.d.subtitles.map((s, i) => ({ id: `s${i}`, label: s.label, lang: s.label, url: s.file }))}
                  audioMode={cur.audio}
                  onAudio={(m) => go({ audio: m })}
                  onAudioTracks={(tracks, active) => setAud({ tracks, active })}
                  audioSel={audSel}
                  tourReady={pageTourDone}
                  servers={playerServers}
                  serverId={server.id}
                  onServer={(sid) => go({ server: sid })}
                  hasNextEpisode={hasNext}
                  hasPrevEpisode={hasPrev}
                  onNextEpisode={() => next && go({ ep: next }, false)}
                  onPrevEpisode={() => prev && go({ ep: prev }, false)}
                  nextEpisode={next}
                  episodeKind={kinds.get(ep)}
                  skipFiller={skipFiller}
                  onSkipFiller={setSkipFiller}
                  onSelectEpisode={(n) => go({ ep: n }, false)}
                  onPlay={() => touchHistory(mediaToCard(a), { ep: cur.ep, server: server.id, audio })}
                  onProgress={(pos, dur) => touchHistory(mediaToCard(a), { ep: cur.ep, server: server.id, audio, pos, dur })}
                  onEnded={() => {
                    finishEpisode(mediaToCard(a), ep, hasNext)
                    if (autoNext && next) go({ ep: next }, false)
                  }}
                  autoNext={autoNext}
                  onAutoNext={setAutoNext}
                  autoSkip={autoSkip}
                  onAutoSkip={setAutoSkip}
                  episodesInfo={eps}
                  fallbackImg={a.bannerImage ?? a.coverImage.extraLarge}
                  defaultRuntime={a.duration}
                  kinds={kinds}
                />
              </Frame>
            )
          ) : server.kind === 'animesalt' ? (
            salt.loading ? (
              <Loading quiet={serverBusy} logo={logo} />
            ) : salt.error || !salt.data ? (
              <Problem message={salt.error?.message ?? 'Not found on AnimeSalt.'} onReconnect={() => go({ server: altId })}>
                <button onClick={() => go({ server: altId })} className={cn(pill, 'border-transparent bg-white text-black')}>
                  Try {altName}
                </button>
              </Problem>
            ) : (
              <Frame>
                <iframe key={salt.data} src={salt.data} title={title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen className="absolute inset-0 size-full border-0" />
              </Frame>
            )
          ) : embedSrc ? (
            <Frame>
              <iframe key={embedSrc} src={embedSrc} title={title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen className="absolute inset-0 size-full border-0" />
            </Frame>
          ) : bundle === null ? (
            <Loading quiet={serverBusy} logo={logo} />
          ) : (
            <Problem message={`${server.name} needs an id this title doesn't have.`} onReconnect={() => go({ server: altId })}>
              <button onClick={() => go({ server: altId })} className={cn(pill, 'border-transparent bg-white text-black')}>
                Try {altName}
              </button>
            </Problem>
          )}

          {/* Title + episode nav */}
          <div className="mt-4 flex px-3 sm:px-6 lg:px-0 flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {a ? (
                <>
                  <Link to={`/anime/${id}`} onClick={backTo(`/anime/${id}`)} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent">
                    <ChevronLeft className="size-3.5" /> Details
                  </Link>
                  <br />
                  <Link to={`/anime/${id}`} onClick={backTo(`/anime/${id}`)} className="font-display text-2xl font-black tracking-tight transition-colors hover:text-accent">
                    {title}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    Episode {ep}
                    {eps.get(ep)?.name && ` · ${eps.get(ep)?.name}`}
                    {total > 1 && ` of ${a.episodes ?? available}`} · {formatLabel(a.format)} · {formatStatus(a.status)}
                    {bundle?.tmdb?.certification && ` · ${bundle.tmdb.certification}`}
                  </p>
                  {bundle?.tmdb?.tagline && <p className="mt-1 text-sm italic text-muted">“{bundle.tmdb.tagline}”</p>}
                </>
              ) : (
                <Skeleton className="h-9 w-72" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button disabled={!hasPrev} onClick={() => prev && go({ ep: prev }, false)} className={cn(pill, 'inline-flex items-center gap-1.5 border-border bg-card/60 disabled:opacity-35')}>
                <ChevronLeft className="size-4" /> Prev
              </button>
              <button disabled={!hasNext} onClick={() => next && go({ ep: next }, false)} className={cn(pill, 'inline-flex items-center gap-1.5 border-transparent bg-foreground text-background disabled:opacity-35')}>
                Next <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

        </div>

        <div className="mt-2 grid gap-8 px-3 sm:px-6 lg:px-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {/* Audio + servers */}
          <section className="mt-5 flex flex-wrap items-center gap-3" aria-label="Source">
            <div data-tour="w-audio" className="flex w-full items-center gap-2 sm:w-auto">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted">Audio</span>
              <div className="flex flex-wrap rounded-3xl border border-border p-0.5">
                {tracks.length > 0
                  ? tracks.map((t) => (
                      <button
                        key={t.i}
                        onClick={() => {
                          setAudSel({ i: t.i })
                          const l = t.label.toLowerCase()
                          const g = t.lang.toLowerCase()
                          const isDub = g === 'en' || g === 'eng' || l.includes('english') || l.includes('dub')
                          const isSub = g === 'ja' || g === 'jpn' || l.includes('native') || l.includes('japanese')
                          if (isDub && audio !== 'dub') go({ audio: 'dub' })
                          else if (isSub && audio !== 'sub') go({ audio: 'sub' })
                        }}
                        className={cn('rounded-full px-4 py-1.5 text-xs font-bold uppercase transition', aud.active === t.i ? 'bg-foreground text-background' : 'text-muted')}
                      >
                        {t.label}
                      </button>
                    ))
                  : (['sub', 'dub'] as const)
                      .filter((m) => (m === 'dub' ? hasDub : hasSub))
                      .map((m) => (
                      <button
                        key={m}
                        disabled={!server.audio}
                        onClick={() => go({ audio: m })}
                        className={cn('rounded-full px-4 py-1.5 text-xs font-bold uppercase transition', audio === m && server.audio ? 'bg-foreground text-background' : 'text-muted', !server.audio && 'opacity-40')}
                      >
                        {m}
                      </button>
                    ))}
              </div>
              {serverAudioQuery.loading && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <Loader2 className="size-3 animate-spin text-accent" /> Searching servers…
                </span>
              )}
              {!server.audio && !tracks.length && !serverAudioQuery.loading && <span className="text-xs text-muted">{server.kind === 'animesalt' ? 'Multi audio' : server.multi ? (stream.loading ? 'Multi audio · loading tracks…' : 'Multi audio') : 'Set in player'}</span>}
            </div>
            <div data-tour="w-servers">
              <ServerPopup servers={direct} value={server.id} onPick={(sid) => (go({ server: sid }), toast(`Switched to ${direct.find((d) => d.id === sid)?.name ?? 'new server'}`))} />
            </div>
            {serverBusy && <LoadingGrid label={`Loading ${server.name}`} />}
          </section>

          <div data-tour="w-more" className="mt-5 space-y-4">
            {[
              { label: 'Multi audio', items: SERVERS.filter((s) => s.kind === 'animesalt') },
              { label: 'Embeds', items: SERVERS.filter((s) => s.kind === 'embed') },
            ].map((g) => (
              <div key={g.label}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{g.label}</p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((s) => (
                    <button
                      key={s.id}
                      disabled={s.kind === 'embed' && bundle !== null && !s.url?.(ctx)}
                      onClick={() => go({ server: s.id })}
                      title={s.note}
                      className={cn(pill, 'disabled:opacity-35', s.id === server.id ? 'border-transparent bg-accent text-accent-fg shadow-lg shadow-accent/30' : 'border-border bg-card hover:bg-card-2')}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Episodes */}
          {a && available > 0 && (
            <section data-tour="w-eps" className="mt-8" aria-label="Episodes">
              <EpisodeList total={total} available={available} current={ep} hrefFor={hrefFor} onPick={() => setLoadKind('episode')} info={eps} kinds={kinds} fallbackImg={a.bannerImage ?? a.coverImage.extraLarge} defaultRuntime={a.duration} />
            </section>
          )}
        </div>

        {/* Side card */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          {a ? (
            <div className="overflow-hidden rounded-3xl border border-border bg-card/60">
              <div className="flex gap-4 p-4">
                <img src={a.coverImage.large ?? ''} alt="" className="aspect-[2/3] w-24 shrink-0 rounded-2xl object-cover" />
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold leading-snug">{title}</p>
                  <p className="mt-1 text-xs text-muted">{[a.seasonYear, a.episodes ? `${a.episodes} eps` : null].filter(Boolean).join(' · ')}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.genres.slice(0, 3).map((g) => (
                      <span key={g} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="line-clamp-6 px-4 text-sm leading-relaxed text-muted">{stripHtml(a.description)}</p>
              <div className="flex flex-wrap gap-2 p-4">
                <ListButton item={mediaToCard(a)} className={pill} />
                <Link to={`/anime/${id}`} onClick={backTo(`/anime/${id}`)} className={cn(pill, 'inline-flex items-center gap-1.5 border-border hover:bg-foreground hover:text-background')}>
                  <Info className="size-4" /> Details
                </Link>
                {sequel && (
                  <Link to={`/watch/${sequel.node.id}`} className={cn(pill, 'border-transparent bg-accent text-accent-fg')}>
                    Next season →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className={cn(pill, 'inline-flex items-center gap-1.5 border-border bg-card hover:border-rose-500/40 hover:text-rose-400')}
                >
                  <Flag className="size-3.5" /> Report Issue
                </button>
              </div>
            </div>
          ) : (
            <Skeleton className="h-64 w-full rounded-3xl" />
          )}

          {/* Official Streams & Creator Support */}
          {bundle?.tmdb?.watchProviders?.providers && bundle.tmdb.watchProviders.providers.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-border bg-card/60 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  <span className="font-semibold text-xs uppercase tracking-wider text-muted">Official Places to Watch</span>
                </div>
                {bundle.tmdb.watchProviders.link && (
                  <a
                    href={bundle.tmdb.watchProviders.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-foreground"
                  >
                    <span>JustWatch</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted mb-3 leading-relaxed">
                We recommend watching on official licensed platforms to support the studios and animators.
              </p>
              <div className="flex flex-wrap gap-2">
                {bundle.tmdb.watchProviders.providers.map((p) => (
                  <a
                    key={p.id}
                    href={bundle.tmdb?.watchProviders?.link || `https://www.google.com/search?q=watch+${encodeURIComponent(title)}+on+${encodeURIComponent(p.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card-2/80 px-2.5 py-1.5 text-xs font-medium transition hover:border-foreground/30 active:scale-95"
                  >
                    {p.logo && (
                      <img
                        src={p.logo}
                        alt={p.name}
                        className="size-4 rounded object-cover shadow-sm"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                      />
                    )}
                    <span>{p.name}</span>
                    <ExternalLink className="size-2.5 text-muted" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
        </div>
      </div>
      {tourOn && !pageTourDone && (
        <Tour
          steps={WATCH_TOUR}
          video={() => document.querySelector<HTMLVideoElement>('.zp video')}
          resume={tourSeen('player')}
          onDone={() => {
            tourDone('watch')
            setTourOn(false)
            setPageTourDone(true)
          }}
        />
      )}

      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Flag className="size-4 text-rose-500" />
                <h3 className="font-display font-bold">Report Stream Issue</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="grid size-8 place-items-center rounded-full hover:bg-card-2 text-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setReportSubmitting(true)
                const res = await submitStreamReport({
                  anime_id: id ? String(id) : undefined,
                  anime_title: title || 'Unknown Anime',
                  episode: String(ep),
                  server: server.name || server.id,
                  audio_type: audio,
                  issue_type: reportIssue,
                  details: reportDetails.trim() || undefined,
                })
                setReportSubmitting(false)
                if (res.success) {
                  toast('Report submitted successfully! Thank you.', 'info')
                  setReportDetails('')
                  setReportOpen(false)
                } else {
                  toast(res.error || 'Failed to submit report', 'error')
                }
              }}
              className="p-4 space-y-4"
            >
              <div>
                <p className="text-xs text-muted mb-2">
                  Reporting <span className="font-semibold text-foreground">{title}</span> · Ep {ep} ({server.name}, {audio.toUpperCase()})
                </p>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Issue Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Broken / Won't Play", 'Buffering / Slow', 'Wrong Audio / Subs Out of Sync', 'Incorrect Episode', 'Other'].map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setReportIssue(t)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-left text-xs font-medium transition',
                        reportIssue === t ? 'border-accent bg-accent/15 text-accent font-semibold' : 'border-border bg-card-2/50 text-muted hover:text-foreground'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Optional Details</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe playback timestamp or error (optional)..."
                  rows={3}
                  className="w-full rounded-2xl border border-border bg-background/60 p-3 text-xs outline-none focus:border-accent"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
                >
                  {reportSubmitting ? 'Submitting...' : 'Send Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
