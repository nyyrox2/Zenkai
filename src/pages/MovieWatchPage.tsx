import { toast } from '../lib/toast'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useBackToDetails } from '../lib/backToDetails'
import { ChevronLeft, ChevronRight, Loader2, Lock, TriangleAlert } from 'lucide-react'
import { BorderBeam } from '../components/BorderBeam'
import { ErrorState } from '../components/ErrorState'
import { ServerMenu } from '../components/ServerMenu'
import { Skeleton } from '../components/Skeleton'
import { Tabs } from '../components/Tabs'
import { useAsync } from '../hooks/useAsync'
import { cn } from '../lib/utils'
import { fetchDetails, fetchEpisodes, fetchProviders, movieHref, resolveProvider, type MediaType } from '../services/movies'
import { useShieldVerified, getToken } from '../lib/shield'

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

  const [frameLoaded, setFrameLoaded] = useState(false)
  const sessionVerified = useShieldVerified()
  useEffect(() => {
    if (!sessionVerified) {
      void getToken()
    }
  }, [sessionVerified])

  const src = useAsync(
    () => (sessionVerified && providerId ? resolveProvider({ providerId, type, tmdbId: id, season, episode }) : Promise.resolve(null)),
    [sessionVerified, providerId, type, id, season, episode],
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
    go({ p: pid })
    toast(`Switched to ${list.find((x) => x.id === pid)?.label ?? 'new server'}`)
  }

  const seasons = details.data?.seasons ?? []
  const seasonInfo = seasons.find((s) => s.n === season)
  const lastEp = eps.data?.length || seasonInfo?.episodes || episode
  const nextTarget = useMemo(() => {
    if (episode < lastEp) return { s: season, e: episode + 1 }
    const nextSeason = seasons.find((s) => s.n > season)
    return nextSeason ? { s: nextSeason.n, e: 1 } : null
  }, [episode, lastEp, season, seasons])
  const prevTarget = episode > 1 ? { s: season, e: episode - 1 } : null
  const epName = eps.data?.find((e) => e.n === episode)?.name

  if (!Number.isFinite(id) || id <= 0) return <ErrorState className="mt-40" message="That title doesn't exist." />

  const title = details.data?.title ?? 'Loading…'
  const nextServer = list[(list.findIndex((p) => p.id === providerId) + 1) % Math.max(list.length, 1)]

  return (
    <main className="mx-auto max-w-6xl px-4 pb-32 pt-24 sm:px-6 sm:pt-28 md:pb-20">
      <Link to={movieHref({ type, id })} onClick={backTo(movieHref({ type, id }))} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-foreground">
        <ChevronLeft className="size-4" /> Details
      </Link>

      {/* Player */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black shadow-2xl shadow-black/30 sm:rounded-3xl">
        {!sessionVerified ? (
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
            <BorderBeam size={220} duration={10} />
          </>
        )}
      </div>

      {/* Title + episode nav */}
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted">
            {type === 'tv' ? `Season ${season} · Episode ${episode}${epName ? ` · ${epName}` : ''}` : [details.data?.year, details.data?.runtime ? `${details.data.runtime} min` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        {type === 'tv' && (
          <div className="flex gap-2">
            <button type="button" disabled={!prevTarget} onClick={() => prevTarget && go({ s: prevTarget.s, e: prevTarget.e })} className="inline-flex items-center gap-1 rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-semibold transition enabled:hover:bg-foreground enabled:hover:text-background active:scale-95 disabled:opacity-40">
              <ChevronLeft className="size-4" /> Prev
            </button>
            <button type="button" disabled={!nextTarget} onClick={() => nextTarget && go({ s: nextTarget.s, e: nextTarget.e })} className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition enabled:hover:brightness-110 active:scale-95 disabled:opacity-40">
              Next <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Servers: one button, opens the full list in sections */}
      <section className="mt-8" aria-label="Servers">
        {providers.loading ? <Skeleton className="h-16 w-full rounded-2xl sm:w-[22rem]" /> : <ServerMenu providers={list} value={providerId} onPick={pick} forceOpen={!!(src.error || providers.error)} />}
      </section>

      {/* Episodes */}
      {type === 'tv' && (
        <section className="mt-10" aria-label="Episodes">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight">Episodes</h2>
            {seasons.length > 1 && <Tabs tabs={seasons.map((s) => ({ id: String(s.n), label: `S${s.n}` }))} value={String(season)} onChange={(v) => go({ s: v, e: 1 })} />}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
            {(eps.data ?? []).map((e) => (
              <button
                key={e.n}
                type="button"
                title={e.name}
                aria-current={e.n === episode}
                onClick={() => go({ e: e.n })}
                className={cn('h-11 rounded-xl border text-sm font-semibold transition active:scale-95', e.n === episode ? 'border-foreground bg-foreground text-background' : 'border-border bg-card/60 text-muted hover:text-foreground')}
              >
                {e.n}
              </button>
            ))}
            {eps.loading && Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-xl" />)}
          </div>
        </section>
      )}

      {details.error && <p className="mt-8 text-center text-sm text-muted">Couldn&rsquo;t load title details, but you can still play. <button type="button" className="underline" onClick={() => navigate(0)}>Reload</button></p>}
    </main>
  )
}
