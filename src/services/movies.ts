/** Movies + TV: TMDB catalogue (through /api/movies) and the embed servers (through /api/providers). */
import { apiUrl } from './api'
import { listProviders, providerUrl } from '../lib/providers'
import { isCompanionActive } from '../lib/useCompanion'

export type MediaType = 'movie' | 'tv'

export interface MovieItem {
  id: number
  type: MediaType
  title: string
  poster: string | null
  backdrop: string | null
  year: string | null
  rating: number | null
  overview: string
  genreIds: number[]
}

export interface MovieDetails extends MovieItem {
  tagline: string | null
  runtime: number | null
  status: string | null
  certification: string | null
  genres: { id: number; name: string }[]
  logo: string | null
  trailer: string | null
  votes: number | null
  language: string | null
  seasons: { n: number; name: string; episodes: number }[]
  cast: { id: number; name: string; character: string; photo: string | null }[]
  similar: MovieItem[]
  imdbId: string | null
}

export interface EpisodeItem {
  n: number
  name: string
  overview: string
  still: string | null
  runtime: number | null
  air: string | null
}

export const img = (path: string | null | undefined, size: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null

/* ---------------- raw TMDB shapes (only what we read) ---------------- */
interface RawItem {
  id: number
  media_type?: string
  title?: string
  name?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  overview?: string
  genre_ids?: number[]
}
interface RawPage {
  results?: RawItem[]
  page?: number
  total_pages?: number
}

const toItem = (r: RawItem, fallback: MediaType): MovieItem | null => {
  const type: MediaType = r.media_type === 'tv' ? 'tv' : r.media_type === 'movie' ? 'movie' : fallback
  if (r.media_type && r.media_type !== 'movie' && r.media_type !== 'tv') return null // people in multi-search
  const title = r.title ?? r.name
  if (!title) return null
  const date = r.release_date ?? r.first_air_date ?? ''
  return {
    id: r.id,
    type,
    title,
    poster: r.poster_path ?? null,
    backdrop: r.backdrop_path ?? null,
    year: date ? date.slice(0, 4) : null,
    rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
    overview: r.overview ?? '',
    genreIds: r.genre_ids ?? [],
  }
}

const mem = new Map<string, Promise<unknown>>()

const RAILWAY_URL = 'https://zenkai-movies-production.up.railway.app'
const LOVABLE_PROXY_URL = 'https://webpage-launchpad.lovable.app/api/public/proxy'

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  const tail = qs.toString() ? `?${qs}` : ''
  const url = apiUrl(`/api/${path}${tail}`)
  const hit = mem.get(url)
  if (hit) return hit as Promise<T>

  const p = (async () => {
    // 1. Fetch via Railway through Lovable Edge Proxy (bypasses ISP blocks, Cloudflare 100k limits, and anti-bot checks)
    const sub = path.startsWith('movies/') ? path.slice('movies/'.length) : path
    const railwayUrl = `${RAILWAY_URL}/api/movies/${sub}${tail}`
    const lovableUrl = `${LOVABLE_PROXY_URL}?url=${encodeURIComponent(railwayUrl)}`

    try {
      const res = await fetch(lovableUrl, { signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        if (data && !data.error) return data as T
      }
    } catch {}

    // 2. Direct Railway fallback
    try {
      const res = await fetch(railwayUrl, { signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        if (data && !data.error) return data as T
      }
    } catch {}

    // 3. Cloudflare Pages Worker fallback
    const res = await fetch(url).catch(() => null)
    const data = res ? ((await res.json().catch(() => null)) as T | { error?: string } | null) : null
    if (!res || !res.ok || !data) throw new Error((data as { error?: string } | null)?.error ?? `Request failed`)
    return data as T
  })()
  mem.set(url, p)
  p.catch(() => mem.delete(url))
  return p
}

export interface Page {
  items: MovieItem[]
  page: number
  totalPages: number
}

const toPage = (d: RawPage, type: MediaType): Page => ({
  items: (d.results ?? []).map((r) => toItem(r, type)).filter((x): x is MovieItem => !!x && !!x.poster),
  page: d.page ?? 1,
  totalPages: Math.min(d.total_pages ?? 1, 500),
})

export type Shelf = 'trending' | 'popular' | 'top_rated' | 'now_playing' | 'upcoming' | 'airing_today' | 'on_the_air'

export async function fetchShelf(type: MediaType, shelf: Shelf, page = 1): Promise<Page> {
  const path = shelf === 'trending' ? `movies/trending/${type}/week` : `movies/${type}/${shelf}`
  return toPage(await get<RawPage>(path, { page }), type)
}

export const SORTS = [
  { id: 'popularity.desc', label: 'Popular' },
  { id: 'vote_average.desc', label: 'Top rated' },
  { id: 'primary_release_date.desc', label: 'Newest' },
] as const
export type SortId = (typeof SORTS)[number]['id']

export interface BrowseQuery {
  type: MediaType
  query?: string
  genre?: number | null
  year?: string
  sort?: SortId
  page?: number
}

export async function browse(q: BrowseQuery): Promise<Page> {
  const page = q.page ?? 1
  if (q.query?.trim()) return toPage(await get<RawPage>(`movies/search/${q.type}`, { query: q.query.trim(), page, year: undefined }), q.type)
  const tv = q.type === 'tv'
  let sort: string = q.sort ?? 'popularity.desc'
  if (tv && sort === 'primary_release_date.desc') sort = 'first_air_date.desc'
  return toPage(
    await get<RawPage>(`movies/discover/${q.type}`, {
      sort_by: sort,
      with_genres: q.genre ?? undefined,
      [tv ? 'first_air_date_year' : 'primary_release_year']: q.year || undefined,
      // top-rated lists are noisy without a vote floor
      'vote_count.gte': sort.startsWith('vote_average') ? 300 : undefined,
      page,
    }),
    q.type,
  )
}

/** Search endpoint (/api/movies/search): movies and shows together, already normalised by the server. */
export async function searchAll(query: string, type?: MediaType): Promise<MovieItem[]> {
  const t = type ?? 'multi'
  const d = await get<RawPage>(`movies/search/${t}`, { query: query.trim() })
  return (d.results ?? []).map((r) => toItem(r, type ?? 'movie')).filter((x): x is MovieItem => !!x && !!x.poster).slice(0, 20)
}

interface RawDetails extends RawItem {
  tagline?: string
  runtime?: number
  episode_run_time?: number[]
  status?: string
  vote_count?: number
  original_language?: string
  genres?: { id: number; name: string }[]
  external_ids?: { imdb_id?: string | null }
  imdb_id?: string | null
  seasons?: { season_number: number; name: string; episode_count: number }[]
  images?: { logos?: { file_path: string; iso_639_1: string | null; vote_average: number }[] }
  videos?: { results?: { site: string; type: string; key: string; official?: boolean }[] }
  credits?: { cast?: { id: number; name: string; character: string; profile_path: string | null }[] }
  similar?: RawPage
  release_dates?: { results?: { iso_3166_1: string; release_dates?: { certification?: string }[] }[] }
  content_ratings?: { results?: { iso_3166_1: string; rating?: string }[] }
}

export async function fetchDetails(type: MediaType, id: number): Promise<MovieDetails> {
  const d = await get<RawDetails>(`movies/${type}/${id}`, {
    append_to_response: `credits,videos,similar,images,external_ids,${type === 'movie' ? 'release_dates' : 'content_ratings'}`,
    include_image_language: 'en,null',
  })
  const base = toItem({ ...d, media_type: type }, type)
  if (!base) throw new Error('Title not found')
  const logos = (d.images?.logos ?? []).filter((l) => !l.file_path.toLowerCase().endsWith('.svg'))
  const logo = logos.sort((a, b) => Number(b.iso_639_1 === 'en') - Number(a.iso_639_1 === 'en') || b.vote_average - a.vote_average)[0]?.file_path ?? null
  const vids = d.videos?.results ?? []
  const yt = vids.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ?? vids.find((v) => v.site === 'YouTube' && /trailer|teaser/i.test(v.type))
  const cert =
    d.content_ratings?.results?.find((r) => r.iso_3166_1 === 'US')?.rating ||
    d.release_dates?.results?.find((r) => r.iso_3166_1 === 'US')?.release_dates?.find((x) => x.certification)?.certification ||
    null
  return {
    ...base,
    tagline: d.tagline || null,
    runtime: d.runtime || d.episode_run_time?.[0] || null,
    status: d.status || null,
    certification: cert,
    genres: d.genres ?? [],
    logo,
    trailer: yt?.key ?? null,
    votes: d.vote_count ?? null,
    language: d.original_language ?? null,
    seasons: (d.seasons ?? []).filter((s) => s.season_number > 0 && s.episode_count > 0).map((s) => ({ n: s.season_number, name: s.name, episodes: s.episode_count })),
    cast: (d.credits?.cast ?? []).slice(0, 18).map((c) => ({ id: c.id, name: c.name, character: c.character, photo: c.profile_path })),
    similar: (d.similar?.results ?? []).map((r) => toItem(r, type)).filter((x): x is MovieItem => !!x && !!x.poster).slice(0, 18),
    imdbId: d.external_ids?.imdb_id ?? d.imdb_id ?? null,
  }
}

export async function fetchEpisodes(id: number, season: number): Promise<EpisodeItem[]> {
  const d = await get<{ episodes?: { episode_number: number; name?: string; overview?: string; still_path?: string | null; runtime?: number | null; air_date?: string | null }[] }>(`movies/tv/${id}/season/${season}`)
  return (d.episodes ?? []).map((e) => ({ n: e.episode_number, name: e.name ?? `Episode ${e.episode_number}`, overview: e.overview ?? '', still: e.still_path ?? null, runtime: e.runtime ?? null, air: e.air_date ?? null }))
}

/* ---------------- genres (static, so browse never waits on a request) ---------------- */
export const MOVIE_GENRES: { id: number; name: string }[] = [
  { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' }, { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' }, { id: 36, name: 'History' }, { id: 27, name: 'Horror' }, { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' }, { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' }, { id: 37, name: 'Western' },
]
export const TV_GENRES: { id: number; name: string }[] = [
  { id: 10759, name: 'Action & Adventure' }, { id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' }, { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' }, { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' }, { id: 10764, name: 'Reality' }, { id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
]
export const genreName = (type: MediaType, id: number) => (type === 'tv' ? TV_GENRES : MOVIE_GENRES).find((g) => g.id === id)?.name

export const movieHref = (m: Pick<MovieItem, 'type' | 'id'>) => `/movies/${m.type}/${m.id}`
export const watchHref = (m: Pick<MovieItem, 'type' | 'id'>, s?: number, e?: number) =>
  `/movies/watch/${m.type}/${m.id}${m.type === 'tv' ? `?s=${s ?? 1}&e=${e ?? 1}` : ''}`

/* ---------------- embed servers (server-side registry; URLs are only resolved on request) ---------------- */
export interface Provider {
  id: string
  label: string
  /** e.g. 'Multi audio', '4K' */
  tags: string[]
}

export const fetchProviders = async (type: MediaType): Promise<Provider[]> => listProviders(type)

export interface MovieDub {
  id: string
  label: string
  selected?: boolean
}

export interface MovieStream {
  quality: string
  resolutionNum?: number
  format: string
  size?: number
  sizeLabel?: string | null
  duration?: number
  streamUrl: string
  proxyStreamUrl?: string
  downloadUrl: string
  downloadFileName?: string
  rawStreamUrl?: string
  url?: string
}

export interface MovieStreamResult {
  success: boolean
  server: string
  title: string
  subjectId: string
  streamUrl: string
  proxyStreamUrl?: string
  downloadUrl?: string
  rawStreamUrl: string
  quality: string
  format: string
  duration?: number
  dubs: MovieDub[]
  streams: MovieStream[]
  subtitles?: { id: string; label: string; language: string; lang: string; url: string; source: string }[]
  referer: string
}

const MOVIEBOX_SERVICE_URL = ((import.meta.env.VITE_MOVIEBOX_PROXY_URL as string | undefined) || 'https://zenkai-movies-production.up.railway.app').replace(/\/+$/, '')

export async function fetchMovieBoxStream(p: {
  id: number
  type: MediaType
  season?: number
  episode?: number
  title?: string
  year?: string
  dubId?: string | null
  imdbId?: string | null
}): Promise<MovieStreamResult> {
  const qs = new URLSearchParams({
    id: String(p.id),
    type: p.type,
    s: String(p.season ?? 1),
    e: String(p.episode ?? 1),
  })
  if (p.title) qs.set('title', p.title)
  if (p.year) qs.set('year', p.year)
  if (p.dubId) qs.set('dub', p.dubId)
  if (p.imdbId) qs.set('imdb', p.imdbId)

  let data: any = null
  let resOk = false

  // 1. Primary: Direct Railway midman call (fast, global US MovieBox profile, direct streaming proxy)
  if (MOVIEBOX_SERVICE_URL) {
    const railwayUrl = `${MOVIEBOX_SERVICE_URL}/api/movies/stream?${qs}`
    try {
      const res = await fetch(railwayUrl, {
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const d = await res.json().catch(() => null)
        if (d && d.success === true && d.streams?.length > 0) {
          data = d
          resOk = true
        } else if (d?.embedServers?.length && !data) {
          data = d
        }
      }
    } catch {}
  }

  // 2. Secondary: Cloudflare Pages Worker / local resolver fallback
  if (!resOk) {
    try {
      const res = await fetch(apiUrl(`/api/movies/stream?${qs}`))
      if (res.ok) {
        const d = await res.json().catch(() => null)
        if (d && d.success === true && d.streams?.length > 0) {
          data = d
          resOk = true
        } else if (d?.embedServers?.length && !data) {
          data = d
        }
      }
    } catch {}
  }

  if (!data?.success && !data?.embedServers?.length) {
    throw new Error(data?.error ?? 'MovieBox stream not available for this title')
  }

  const hasCompanion = isCompanionActive()
  const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const resolveProxyStreamUrl = (u?: string, rawUrl?: string) => {
    if (!u) return u
    const isWebMirror = (rawUrl && rawUrl.includes('bcdnxw')) || u.includes('bcdnxw')

    // On local machine (dev server), ALWAYS use the local domestic proxy for bcdnxw
    if (isLocalHost && isWebMirror) {
      let target = rawUrl
      if (!target && u.includes('url=')) {
        try {
          const parsed = new URL(u, window.location.href)
          target = parsed.searchParams.get('url') || undefined
        } catch {}
      }
      return `/proxy?url=${encodeURIComponent(target || u)}&referer=${encodeURIComponent('https://123moviesfree.club/')}`
    }

    if (u.startsWith('http://') || u.startsWith('https://')) return u

    if (isWebMirror) {
      return apiUrl(u.startsWith('/proxy') ? u : `/proxy?url=${encodeURIComponent(rawUrl || u)}&referer=${encodeURIComponent('https://123moviesfree.club/')}`)
    }

    return MOVIEBOX_SERVICE_URL ? `${MOVIEBOX_SERVICE_URL}${u}` : apiUrl(u)
  }

  const resolveStreamUrl = (u?: string, rawUrl?: string) => {
    if (!u) return u

    // If Zenkai Companion extension is active, use the raw CDN stream DIRECTLY with zero proxies!
    if (hasCompanion) {
      let directUrl = rawUrl
      if (!directUrl && u.includes('url=')) {
        try {
          const parsed = new URL(u, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
          directUrl = parsed.searchParams.get('url') || undefined
        } catch {}
      }
      if (directUrl && (directUrl.startsWith('http://') || directUrl.startsWith('https://'))) {
        return directUrl
      }
    }

    return resolveProxyStreamUrl(u, rawUrl)
  }

  return {
    ...data,
    proxyStreamUrl: resolveProxyStreamUrl(data.streamUrl, data.rawStreamUrl),
    streamUrl: resolveStreamUrl(data.streamUrl, data.rawStreamUrl),
    downloadUrl: data.downloadUrl ? resolveStreamUrl(data.downloadUrl, data.rawStreamUrl) : undefined,
    streams: (data.streams || []).map((s: MovieStream) => {
      const direct = s.url || s.rawStreamUrl || ''
      const proxied = resolveProxyStreamUrl(s.streamUrl, s.url)
      return {
        ...s,
        rawStreamUrl: direct,
        proxyStreamUrl: proxied,
        streamUrl: resolveStreamUrl(s.streamUrl, s.url),
        downloadUrl: s.downloadUrl ? resolveStreamUrl(s.downloadUrl, s.url) : undefined,
      }
    }),
    subtitles: (data.subtitles || []).map((s: { id: string; label: string; language: string; lang: string; url: string; source: string }) => ({
      ...s,
      url: resolveStreamUrl(s.url),
    })),
  }
}

export async function resolveProvider(p: { providerId: string; type: MediaType; tmdbId: number; season?: number; episode?: number }): Promise<string> {
  const url = providerUrl(p.providerId, p.type, p.tmdbId, p.season ?? 1, p.episode ?? 1)
  if (!url) throw new Error('Could not load this server')
  return url
}
