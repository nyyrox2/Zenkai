import { tmdbDirect, tmdbEpisodesDirect } from './tmdbDirect'

/** Client for the Zenkai API (Cloudflare Pages Functions in production, Vite middleware in dev). */
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

/** Root-relative API paths (e.g. the proxied HLS url) are prefixed with VITE_API_BASE when it is set. */
export const apiUrl = (path: string) => (path.startsWith('/') ? BASE + path : path)

/** Cloudflare answers 429 (or its own HTML error page) once the free Workers quota is used up. */
export const failMsg = (res: Response, data: { error?: string } | null) =>
  res.status === 429 || (res.status >= 500 && !data)
    ? "We're on the free plan and today's usage limit is reached. Switch to an embed server, they work normally."
    : (data?.error ?? `Request failed (${res.status})`)

export const tmdbImg = (path: string | null | undefined, size: 'w185' | 'w300' | 'w500' | 'w780' | 'w1280' | 'original' = 'w1280') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null

async function getJson<T>(path: string, timeout = 20000): Promise<T> {
  const ctl = new AbortController()
  const t = window.setTimeout(() => ctl.abort(), timeout)
  try {
    const res = await fetch(apiUrl(path), { signal: ctl.signal })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(failMsg(res, data as { error?: string } | null))
    return data as T
  } finally {
    window.clearTimeout(t)
  }
}

/* ---------------- AniBridge mapping + TMDB ---------------- */
export interface Mapping {
  anilist: number
  mal: number | null
  tmdb: { id: number; type: 'tv' | 'movie'; season: number | null } | null
  tvdb: number | null
  imdb: string | null
  anidb: number | null
  source: 'anibridge' | 'arm'
}

export interface Tmdb {
  id: number
  type: 'tv' | 'movie'
  season: number | null
  imdbId: string | null
  logo: string | null
  backdrop: string | null
  backdrops: string[]
  overview: string | null
  tagline: string | null
  rating: number | null
  votes: number | null
  certification: string | null
  networks: string[]
  status: string | null
  language: string | null
  seasons: number | null
  episodes: number | null
  firstAir: string | null
  lastAir: string | null
  runtime: number | null
  cast: { name: string; character: string; photo: string | null }[]
  trailer: string | null
}

export interface TmdbBundle {
  mapping: Mapping | null
  tmdb: Tmdb | null
}

const tmdbMem = new Map<string, Promise<TmdbBundle>>()
const DAY = 24 * 3600e3

export function fetchTmdb(anilistId: number, title: string, format?: string | null): Promise<TmdbBundle> {
  const key = String(anilistId)
  const hit = tmdbMem.get(key)
  if (hit) return hit

  const lsKey = `zk:tmdb:v1:${key}`
  try {
    const raw = localStorage.getItem(lsKey)
    if (raw) {
      const { at, v } = JSON.parse(raw) as { at: number; v: TmdbBundle }
      if (Date.now() - at < DAY * 7 && v.tmdb) {
        const done = Promise.resolve(v)
        tmdbMem.set(key, done)
        return done
      }
    }
  } catch {
    /* ignore corrupt cache */
  }

  const q = new URLSearchParams({ id: key, title, format: format ?? '' })
  // Browser first (like Movies: no Worker request, no Worker -> proxy hop), the server route is the fallback.
  const viaServer = () => getJson<{ mapping: Mapping | null; tmdb: Tmdb | null }>(`/api/tmdb?${q}`)
  const p = tmdbDirect(anilistId, title, format)
    .then((r) => (r.tmdb ? r : viaServer()))
    .catch(viaServer)
    .then((r) => {
      const v = { mapping: r.mapping, tmdb: r.tmdb }
      if (v.tmdb) {
        try {
          localStorage.setItem(lsKey, JSON.stringify({ at: Date.now(), v }))
        } catch {
          /* storage full */
        }
      }
      return v
    })
    .catch(() => {
      tmdbMem.delete(key) // retry next time
      return { mapping: null, tmdb: null }
    })
  tmdbMem.set(key, p)
  return p
}

/** One episode, TMDB-first with AniList filling the gaps. `image` is a full url. */
export interface EpInfo {
  n: number
  name: string | null
  overview: string | null
  image: string | null
  runtime: number | null
  air: string | null
}

const epMem = new Map<string, Promise<EpInfo[]>>()
export function fetchTmdbEpisodes(tmdbId: number, season = 1): Promise<EpInfo[]> {
  const key = `${tmdbId}:${season}`
  const hit = epMem.get(key)
  if (hit) return hit
  type Raw = { n: number; name: string | null; overview: string | null; still: string | null; runtime: number | null; air: string | null }
  const p = (tmdbEpisodesDirect(tmdbId, season) as Promise<Raw[]>)
    .catch(() => getJson<{ episodes: Raw[] }>(`/api/tmdb/episodes?id=${tmdbId}&season=${season}`).then((r) => r.episodes))
    .then((rows) => rows.map((e) => ({ n: e.n, name: e.name, overview: e.overview, image: tmdbImg(e.still, 'w500'), runtime: e.runtime, air: e.air })))
    .catch(() => {
      epMem.delete(key)
      return [] as EpInfo[]
    })
  epMem.set(key, p)
  return p
}

/* ---------------- Filler lists ---------------- */
export type EpKind = 'filler' | 'mixed' | 'recap'

/** AnimeFillerList numbers the whole series; `max` lets the caller reject a list that doesn't match this entry. */
export const fetchFillerList = (titles: string[]) =>
  getJson<{ success: boolean; max?: number; filler?: number[]; mixed?: number[] }>(`/api/filler?${titles.map((t) => `t=${encodeURIComponent(t)}`).join('&')}`)

/* ---------------- Streams ---------------- */
export interface StreamResult {
  server: string
  audio: 'sub' | 'dub' | 'multi'
  /** one stream with several audio tracks (ACDN) */
  multiAudio?: boolean
  streamUrl: string
  subtitles: { file: string; label: string; default?: boolean }[]
  intro: { start: number; end: number } | null
  outro: { start: number; end: number } | null
}

export async function fetchStream(p: { id: number; ep: number; server: string; audio: string; title: string; format?: string | null }): Promise<StreamResult> {
  const q = new URLSearchParams({ id: String(p.id), ep: String(p.ep), server: p.server, audio: p.audio, title: p.title })
  if (p.format) q.set('format', p.format)
  const r = await getJson<StreamResult & { success: boolean }>(`/api/stream?${q}`, 40000)
  return { ...r, streamUrl: apiUrl(r.streamUrl) }
}

export async function fetchAnimeSalt(p: { id: number; ep: number; title: string; format?: string | null; server: '1' | '2' }): Promise<string> {
  const q = new URLSearchParams({ id: String(p.id), ep: String(p.ep), title: p.title, format: p.format ?? '', server: p.server, audio: 'multi' })
  const r = await getJson<{ success: boolean; embedUrl?: string; error?: string }>(`/api/embed/animesalt?${q}`, 40000)
  if (!r.embedUrl) throw new Error(r.error ?? 'Not found on AnimeSalt')
  return r.embedUrl
}

let acdnMap: Promise<Record<string, unknown>> | undefined
/** Is this AniList id in public/anime-mapping.json (the only titles ACDN can serve)? Unknown (fetch failed) counts as yes. */
export async function acdnMapped(id: number): Promise<boolean> {
  try {
    acdnMap ??= fetch('/anime-mapping.json').then((r) => r.json())
    return String(id) in (await acdnMap)
  } catch {
    acdnMap = undefined
    return true
  }
}
