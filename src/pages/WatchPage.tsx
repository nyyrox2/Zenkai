import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useBackToDetails } from '../lib/backToDetails'
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Lock } from 'lucide-react'
import { fetchAnimeLite } from '../services/anilist'
import { acdnMapped, fetchAnimeSalt, fetchStream } from '../services/api'
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
import { Tour, tourDone, tourSeen, type TourStep } from '../components/Tour'
import { ServerPopup, type ServerOpt } from '../components/ServerPopup'
import { useShieldVerified, getToken } from '../lib/shield'
import { BorderBeam } from '../components/BorderBeam'


function Frame({ children }: { children: React.ReactNode }) {
  return <div data-tour="w-player" className="relative aspect-video w-full overflow-hidden bg-black lg:shadow-2xl lg:shadow-black/40 lg:ring-1 lg:ring-white/10">{children}</div>
}

/** Episode / first load: grid loader bottom-left of the player. `quiet` (server switch) leaves the player black; the loader shows below it. */
function Loading({ quiet }: { quiet?: boolean }) {
  return <Frame>{!quiet && <LoadingGrid className="absolute bottom-3 left-3 text-white/60 sm:bottom-4 sm:left-4" />}</Frame>
}

function Problem({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <Frame>
      <div className="absolute inset-0 grid place-items-center p-6 text-center">
        <div className="max-w-sm">
          <AlertTriangle className="mx-auto size-8 text-amber-400" />
          <p className="mt-3 text-sm font-medium text-white">{message}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>
        </div>
      </div>
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

  const sessionVerified = useShieldVerified()
  useEffect(() => {
    if (!sessionVerified) {
      void getToken()
    }
  }, [sessionVerified])
  const [loadKind, setLoadKind] = useState<'episode' | 'server'>('episode')
  const [aud, setAud] = useState<{ tracks: { i: number; label: string; lang: string }[]; active: number }>({ tracks: [], active: 0 })
  const [tourOn, setTourOn] = useState(false)
  const [pageTourDone, setPageTourDone] = useState(() => tourSeen('watch'))
  const [audSel, setAudSel] = useState<{ i: number } | null>(null)
  const anime = useAsync(() => fetchAnimeLite(id), [id])
  const a = anime.data
  const title = a ? pickTitle(a.title) : ''
  const { total, available } = a ? episodeCounts(a) : { total: 0, available: 0 }

  const rawEp = Number(sp.get('ep')) || lastEpisode(id) || 1
  const ep = a ? Math.min(Math.max(1, rawEp), Math.max(available, 1)) : rawEp
  // URL wins, then what this title last used, then the last server/audio used anywhere
  const saved = useMemo(() => ({ ...getPrefs(), ...getHistory(id) }), [id])
  const acdn = useAsync(() => acdnMapped(id), [id]).data
  const wanted = serverById(sp.get('server') ?? saved.server ?? 'megaplay')
  const server = wanted.id === 'acdn' && acdn === false ? serverById('megaplay') : wanted
  const directList = DIRECT.filter((s) => s.id !== 'acdn' || acdn === true)
  const audio: 'sub' | 'dub' = (sp.get('audio') ?? saved.audio) === 'dub' ? 'dub' : 'sub'

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

  // Remember episode / server / audio once playback has really started (not for a server that fails to load)
  const ready = !!(a && (server.kind === 'direct' ? stream.data : server.kind === 'animesalt' ? salt.data : embedSrc))
  useEffect(() => {
    if (!a || !ready) return
    const t = window.setTimeout(() => {
      touchHistory(mediaToCard(a), { ep, server: server.id, audio })
      savePrefs({ server: server.id, ...(server.audio ? { audio } : {}) })
    }, 2000)
    return () => window.clearTimeout(t)
  }, [a, ready, ep, server.id, server.audio, audio])
  useEffect(() => {
    if (title) document.title = `${title} · Episode ${ep} — Zenkai`
  }, [title, ep])

  const playerServers = useMemo(() => SERVERS.filter((s) => s.id !== 'acdn' || acdn === true).map((s) => ({ id: s.id, name: s.name, note: s.note, disabled: s.kind === 'embed' && !s.url?.(ctx) })), [ctx, audio, acdn])
  const tracks = server.multi ? aud.tracks : []
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

  const direct: ServerOpt[] = directList.map((s) => ({ id: s.id, name: s.name, label: s.multi ? 'Zenkai player · Multi audio' : 'Zenkai player', tags: ['SUB', 'DUB'] }))

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
            <Loading quiet={serverBusy} />
          ) : server.kind === 'direct' ? (
            !cur && stream.loading ? (
              <Loading quiet={serverBusy} />
            ) : !cur ? (
              <Problem message={stream.error?.message ?? 'No stream found.'}>
                {directList.filter((s) => s.id !== server.id).map((s) => (
                  <button key={s.id} onClick={() => go({ server: s.id })} className={cn(pill, 'border-white/20 bg-white/10 text-white')}>
                    Try {s.name}
                  </button>
                ))}
                {server.audio && (
                  <button onClick={() => go({ audio: audio === 'sub' ? 'dub' : 'sub' })} className={cn(pill, 'border-white/20 bg-white/10 text-white')}>
                    Try {audio === 'sub' ? 'DUB' : 'SUB'}
                  </button>
                )}
                <button onClick={() => go({ server: 'animesalt-1' })} className={cn(pill, 'border-transparent bg-accent text-accent-fg')}>
                  Multi audio
                </button>
              </Problem>
            ) : (
              <Frame>
                <CinePlayer
                  key={server.id}
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
                  onProgress={(pos, dur) => touchHistory(mediaToCard(a), { ep: cur.ep, server: server.id, audio, pos, dur })}
                  onEnded={() => {
                    finishEpisode(mediaToCard(a), ep, hasNext)
                    if (autoNext && next) go({ ep: next }, false)
                  }}
                  autoNext={autoNext}
                  onAutoNext={setAutoNext}
                  autoSkip={autoSkip}
                  onAutoSkip={setAutoSkip}
                />
              </Frame>
            )
          ) : server.kind === 'animesalt' ? (
            salt.loading ? (
              <Loading quiet={serverBusy} />
            ) : salt.error || !salt.data ? (
              <Problem message={salt.error?.message ?? 'Not found on AnimeSalt.'}>
                <button onClick={() => go({ server: server.id === 'animesalt-1' ? 'animesalt-2' : 'megaplay' })} className={cn(pill, 'border-white/20 bg-white/10 text-white')}>
                  {server.id === 'animesalt-1' ? 'Try AnimeSalt 2' : 'Back to MegaPlay'}
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
            <Loading quiet={serverBusy} />
          ) : (
            <Problem message={`${server.name} needs an id this title doesn't have.`}>
              <button onClick={() => go({ server: 'megaplay' })} className={cn(pill, 'border-white/20 bg-white/10 text-white')}>
                Back to MegaPlay
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
                  <Link to={`/anime/${id}`} onClick={backTo(`/anime/${id}`)} className="font-display text-2xl font-black tracking-tight transition-colors hover:text-accent sm:text-3xl">
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
                        onClick={() => setAudSel({ i: t.i })}
                        className={cn('rounded-full px-4 py-1.5 text-xs font-bold uppercase transition', aud.active === t.i ? 'bg-foreground text-background' : 'text-muted')}
                      >
                        {t.label}
                      </button>
                    ))
                  : (['sub', 'dub'] as const).map((m) => (
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
              {!server.audio && !tracks.length && <span className="text-xs text-muted">{server.kind === 'animesalt' ? 'Multi audio' : server.multi ? (stream.loading ? 'Multi audio · loading tracks…' : 'Multi audio') : 'Set in player'}</span>}
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
              </div>
            </div>
          ) : (
            <Skeleton className="h-64 w-full rounded-3xl" />
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
    </main>
  )
}
