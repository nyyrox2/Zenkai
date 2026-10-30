import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { fetchAnimeLite, type AniLite } from '../services/anilist'
import { fetchStream, fetchEpisodeServers, type StreamResult, type ServerAudioMap } from '../services/api'
import CinePlayer, { type PlayerServer } from '../components/CinePlayer'
import { Loader2, AlertCircle, RotateCcw, Volume2, HardDrive, Play, ShieldAlert } from 'lucide-react'
import { opaqueOrigin, popupsBlocked, sameOriginParent } from '../lib/embedGuard'

const BASE_SERVER_NAMES: Record<string, string> = {
  megaplay: 'Server 1 (MegaPlay)',
  vidstream: 'Server 2 (VidStream)',
  flixcloud: 'Server 3 (FlixCloud)',
  acdn: 'Multi-Audio (ACDN)',
}

export default function EmbedPage() {
  const { id: pathId, ep: pathEp } = useParams<{ id?: string; ep?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const animeId = parseInt(searchParams.get('id') || pathId || '195604', 10)
  const ep = Math.max(1, parseInt(searchParams.get('ep') || pathEp || '1', 10))
  const rawServer = (searchParams.get('server') || 'megaplay').toLowerCase()
  const rawAudio = (searchParams.get('audio') || 'sub').toLowerCase() === 'dub' ? 'dub' : 'sub'
  const isPreview = searchParams.get('preview') === '1' && sameOriginParent()
  // Inside someone else's iframe: refuse sandboxed frames; one click proves popups work before anything loads.
  const embedded = window.self !== window.top && !isPreview
  const [gate, setGate] = useState<'check' | 'ok' | 'blocked'>(!embedded ? 'ok' : opaqueOrigin() ? 'blocked' : 'check')

  const [anime, setAnime] = useState<AniLite | null>(null)
  const [stream, setStream] = useState<StreamResult | null>(null)
  const [serverAvail, setServerAvail] = useState<ServerAudioMap | null>(null)
  const [streamLoading, setStreamLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const animeTitle = useMemo(() => {
    if (!anime) return ''
    return anime.title.english || anime.title.romaji || anime.title.native || ''
  }, [anime])

  // Helper to safely update URL search params
  const updateParams = useCallback(
    (updates: Record<string, string | number>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          Object.entries(updates).forEach(([k, v]) => {
            next.set(k, String(v))
          })
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  // Debugger Lock & Console Wiper direct on Embed Page
  useEffect(() => {
    if (isPreview) return

    // Dynamic Anonymous Function Debugger Trap (triggers VM... script in DevTools)
    const _0x3779a6 = () => {
      try {
        ;(function () {}['constructor']('debugger')())
      } catch {}
      try {
        Function('debugger')()
      } catch {}
    }

    const debugTimer = window.setInterval(_0x3779a6, 100)

    // Auto Clear Console: Constantly wipes console output
    const clearTimer = window.setInterval(() => {
      try {
        console.clear()
      } catch {}
    }, 200)

    try {
      console.clear()
    } catch {}

    return () => {
      window.clearInterval(debugTimer)
      window.clearInterval(clearTimer)
    }
  }, [isPreview])

  // 1. Load Anime Metadata from AniList
  useEffect(() => {
    let active = true
    fetchAnimeLite(animeId)
      .then((data) => {
        if (!active) return
        setAnime(data)
        const t = data.title.english || data.title.romaji || ''
        if (t) document.title = `${t} · Ep ${ep} — Zenkai Player`
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [animeId, ep])

  // 4. Fetch Episode Server & Audio Availability
  useEffect(() => {
    if (gate !== 'ok') return
    let active = true

    fetchEpisodeServers(animeId, ep, animeTitle)
      .then((map) => {
        if (!active) return
        setServerAvail(map)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [animeId, ep, animeTitle, gate])

  // 5. Server & Audio Availability
  const effectiveServer = rawServer
  const effectiveAudio = rawAudio
  const srvInfo = serverAvail?.[effectiveServer]
  const hasSub = Boolean(srvInfo?.sub ?? true)
  const hasDub = Boolean(srvInfo?.dub ?? false)
  const hasAnyDub = useMemo(() => {
    if (!serverAvail) return false
    return Object.values(serverAvail).some((s) => Boolean(s?.dub || s?.multi))
  }, [serverAvail])

  // 6. Build Formatted Server List for CinePlayer (Always keep all servers accessible)
  const formattedServers: PlayerServer[] = useMemo(() => {
    const order = ['megaplay', 'vidstream', 'flixcloud', 'acdn']
    return order.map((key) => {
      const avail = serverAvail?.[key]
      const tags: string[] = []
      if (avail?.sub) tags.push('SUB')
      if (avail?.dub) tags.push('DUB')
      if (avail?.multi && !avail.sub && !avail.dub) tags.push('MULTI')
      if (!tags.length) tags.push('SUB')
      return {
        id: key,
        name: BASE_SERVER_NAMES[key] || key.toUpperCase(),
        note: tags.join(' · '),
        tags,
      }
    })
  }, [serverAvail])

  // 7. Fetch Stream when (animeId, ep, effectiveServer, effectiveAudio) is requested
  useEffect(() => {
    if (gate !== 'ok') return
    let active = true
    setStreamLoading(true)
    setError(null)

    fetchStream({
      id: animeId,
      ep,
      server: effectiveServer,
      audio: effectiveAudio,
      title: animeTitle,
      format: anime?.format,
    })
      .then((res) => {
        if (!active) return
        setStream(res)
      })
      .catch((err) => {
        if (!active) return
        const raw = String(err?.message || '')
        let friendly = 'Unavailable on this server. Try other server.'
        if (effectiveAudio === 'dub') {
          friendly = 'Unavailable on this server. Try other or try SUB.'
        } else if (/no (sub|dub) stream|resolution failed|not found/i.test(raw)) {
          friendly = 'Unavailable on this server. Try other server.'
        } else {
          friendly = raw || 'Unavailable on this server. Try other server.'
        }
        setError(friendly)
      })
      .finally(() => {
        if (active) setStreamLoading(false)
      })

    return () => {
      active = false
    }
  }, [animeId, ep, effectiveServer, effectiveAudio, animeTitle, anime?.format, gate])

  const totalEpisodes = anime?.episodes || 24
  const hasNext = ep < totalEpisodes
  const hasPrev = ep > 1

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-black select-none">
      {gate === 'blocked' ? (
        <div className="flex h-full w-full items-center justify-center bg-[#070709] p-4 text-white">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121217] p-6 text-center">
            <ShieldAlert className="mx-auto mb-3 size-8 text-rose-400" />
            <h2 className="mb-1.5 text-base font-bold">Embed blocked</h2>
            <p className="mb-4 text-xs leading-relaxed text-zinc-400">
              This player can't run in a sandboxed frame. Remove the <code>sandbox</code> attribute from the iframe, or watch on Zenkai.
            </p>
            <a href={location.origin} target="_top" className="inline-flex rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500">
              Open Zenkai
            </a>
          </div>
        </div>
      ) : gate === 'check' ? (
        <button
          type="button"
          onClick={() => setGate(popupsBlocked() ? 'blocked' : 'ok')}
          aria-label="Play"
          className="group relative flex h-full w-full items-center justify-center bg-black bg-cover bg-center"
          style={{ backgroundImage: anime?.bannerImage || anime?.coverImage?.extraLarge ? `url(${anime?.bannerImage || anime?.coverImage?.extraLarge})` : undefined }}
        >
          <span className="absolute inset-0 bg-black/50" />
          <span className="relative grid size-16 place-items-center rounded-full bg-rose-600 text-white shadow-2xl transition group-hover:scale-110">
            <Play className="size-7 fill-current" />
          </span>
        </button>
      ) : error ? (
        <div className="flex h-full w-full items-center justify-center bg-[#070709] p-4 text-white">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121217] p-6 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
              <AlertCircle className="size-6" />
            </div>
            <h2 className="mb-1.5 text-base font-bold text-white">Playback Error</h2>
            <p className="mb-5 text-xs text-zinc-400 leading-relaxed">{error}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {effectiveAudio === 'dub' ? (
                <button
                  onClick={() => updateParams({ audio: 'sub' })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 hover:text-white"
                >
                  <Volume2 className="size-3.5" />
                  <span>Try SUB</span>
                </button>
              ) : hasAnyDub ? (
                <button
                  onClick={() => updateParams({ audio: 'dub' })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white"
                >
                  <Volume2 className="size-3.5" />
                  <span>Try DUB</span>
                </button>
              ) : null}
              <button
                onClick={() => {
                  const allServers = ['megaplay', 'vidstream', 'flixcloud', 'acdn']
                  const currentIndex = allServers.indexOf(effectiveServer)
                  const nextServer = allServers[(currentIndex + 1) % allServers.length]
                  updateParams({ server: nextServer })
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white"
              >
                <HardDrive className="size-3.5" />
                <span>Try Other Server</span>
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-500"
              >
                <RotateCcw className="size-3.5" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        </div>
      ) : stream ? (
        <CinePlayer
          streamUrl={stream.streamUrl}
          title={animeTitle || 'Anime Stream'}
          episode={ep}
          totalEpisodes={totalEpisodes}
          availableEpisodes={totalEpisodes}
          animeId={animeId}
          format={anime?.format}
          preview={isPreview}
          directSubtitles={stream.subtitles.map((s, i) => ({
            id: `sub-${i}`,
            label: s.label,
            lang: s.label,
            url: s.file,
          }))}
          audioMode={effectiveAudio}
          hasDub={hasDub}
          hasSub={hasSub}
          onAudio={(m) => updateParams({ audio: m })}
          servers={formattedServers}
          serverId={effectiveServer}
          onServer={(sid) => updateParams({ server: sid })}
          hasNextEpisode={hasNext}
          hasPrevEpisode={hasPrev}
          onNextEpisode={() => updateParams({ ep: ep + 1 })}
          onPrevEpisode={() => updateParams({ ep: ep - 1 })}
          onSelectEpisode={(n) => updateParams({ ep: n })}
          onEnded={() => {
            if (hasNext) {
              updateParams({ ep: ep + 1 })
            }
          }}
          intro={stream.intro}
          outro={stream.outro}
          switching={streamLoading}
          fallbackImg={anime?.bannerImage || anime?.coverImage?.extraLarge}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black text-white/80">
          <Loader2 className="size-8 animate-spin text-rose-500" />
        </div>
      )}
    </div>
  )
}
