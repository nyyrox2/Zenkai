import { useEffect, useState } from 'react'

type Seg = { start: number; end: number } | null
type Times = { intro: Seg; outro: Seg }
type Ms = { start_ms?: number | null; end_ms?: number | null }
const NONE: Times = { intro: null, outro: null }
const cache = new Map<string, Times>()

const first = (a: unknown): Ms | null => (Array.isArray(a) ? ([...a] as Ms[]).filter((x) => x && typeof x === 'object').sort((x, y) => (x.start_ms ?? 0) - (y.start_ms ?? 0))[0] ?? null : null)

/**
 * Community intro / credits times from TheIntroDB (v4, public, keyed by TMDB id), for movies and TV.
 * Nothing found = no button; never guesses. `duration` (seconds, when known) picks the matching release and closes an open-ended credits segment.
 */
export function useMovieSkipTimes(o: { tmdbId: number; type: 'movie' | 'tv'; season: number; episode: number; duration?: number | null; on?: boolean }): Times {
  const { tmdbId, type, season, episode, duration, on = true } = o
  const dur = duration && duration > 0 ? Math.round(duration) : 0
  const key = `${type}:${tmdbId}:${type === 'tv' ? `${season}:${episode}` : '-'}:${dur}`
  const [r, setR] = useState<Times>(() => cache.get(key) ?? NONE)

  useEffect(() => {
    if (!on || !tmdbId) return setR(NONE)
    const hit = cache.get(key)
    if (hit) return setR(hit)
    setR(NONE)
    const q = new URLSearchParams({ tmdb_id: String(tmdbId) })
    if (type === 'tv') {
      q.set('season', String(season))
      q.set('episode', String(episode))
    }
    if (dur) q.set('duration_ms', String(dur * 1000))
    const ac = new AbortController()
    fetch(`https://api.theintrodb.org/v4/media?${q}`, { signal: ac.signal })
      .then((x) => (x.ok ? x.json() : null))
      .then((j: (Record<string, unknown> & { season?: number; episode?: number }) | null) => {
        // ignore a body for another episode (the API can answer with a fallback)
        if (!j || (type === 'tv' && (j.season !== season || j.episode !== episode))) return
        const i = first(j.intro)
        const c = first(j.credits)
        const intro = i && i.end_ms ? { start: (i.start_ms ?? 0) / 1000, end: i.end_ms / 1000 } : null
        const cs = c && c.start_ms != null ? c.start_ms / 1000 : null
        const ce = c?.end_ms != null ? c.end_ms / 1000 : dur || null // null end = to the end of the media
        const outro = cs != null && ce != null && ce > cs ? { start: cs, end: ce } : null
        const v = { intro: intro && intro.end > intro.start ? intro : null, outro }
        cache.set(key, v)
        setR(v)
      })
      .catch(() => {}) // offline / blocked: no button
    return () => ac.abort()
  }, [key, on, tmdbId, type, season, episode, dur])
  return r
}
