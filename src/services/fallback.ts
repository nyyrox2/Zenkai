import type { AniMediaDetails } from '../types/anime'

/**
 * AniList is down -> rebuild a details page from TMDB (through the aniverse proxy).
 * AniBridge (ARM as backup) maps AniList <-> MAL <-> TMDB ids, so /anime/:id and /mal/:id both work.
 */
const TMDB = 'https://aniversee.vercel.app/api/tmdb'
const ANIBRIDGE = 'https://anibridge.eliasbenb.dev/api/mappings?source.descriptor='
const ARM = 'https://arm.haglund.dev/api/v2/ids?source='

/* eslint-disable @typescript-eslint/no-explicit-any */
const get = async (url: string, ms = 12000): Promise<any> => {
  const ctl = new AbortController()
  const t = window.setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } finally {
    window.clearTimeout(t)
  }
}

interface Ids {
  anilist: number | null
  mal: number | null
  tmdb: { id: number; type: 'tv' | 'movie' } | null
}

async function resolveIds(id: number, fromMal: boolean): Promise<Ids> {
  const out: Ids = { anilist: fromMal ? null : id, mal: fromMal ? id : null, tmdb: null }
  try {
    const data = await get(`${ANIBRIDGE}${fromMal ? 'mal' : 'anilist'}:${id}`)
    const seen: string[] = []
    const walk = (v: any) => {
      if (!v) return
      if (typeof v === 'string') {
        if (/^[a-z_]+:[^\s]+$/i.test(v)) seen.push(v)
      } else if (Array.isArray(v)) v.forEach(walk)
      else if (typeof v === 'object') Object.values(v).forEach(walk)
    }
    walk(data)
    for (const d of seen) {
      const [provider, val] = d.split(':')
      const p = provider.toLowerCase()
      if (p === 'anilist' && !out.anilist) out.anilist = Number(val) || null
      else if ((p === 'mal' || p === 'myanimelist') && !out.mal) out.mal = Number(val) || null
      else if (p.startsWith('tmdb') && !out.tmdb) out.tmdb = { id: Number(val), type: p.includes('movie') ? 'movie' : 'tv' }
    }
  } catch {
    /* ARM below */
  }
  if (!out.tmdb || !out.anilist) {
    try {
      const a = await get(`${ARM}${fromMal ? 'myanimelist' : 'anilist'}&id=${id}`)
      out.anilist ??= a.anilist ?? null
      out.mal ??= a.myanimelist ?? null
      if (!out.tmdb && a.themoviedb) out.tmdb = { id: a.themoviedb, type: a.type === 'MOVIE' ? 'movie' : 'tv' }
    } catch {
      /* nothing else to try */
    }
  }
  return out
}

const date = (s?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '')
  return m ? { year: +m[1], month: +m[2], day: +m[3] } : { year: null, month: null, day: null }
}

export async function fetchAnimeFallback(id: number, fromMal: boolean): Promise<AniMediaDetails> {
  const ids = await resolveIds(id, fromMal)
  if (!ids.tmdb) throw new Error('No fallback match')
  const d = await get(`${TMDB}/${ids.tmdb.type}/${ids.tmdb.id}?language=en-US&append_to_response=videos`)
  const movie = ids.tmdb.type === 'movie'
  const yt = (d.videos?.results || []).find((v: any) => v.site === 'YouTube' && /trailer|teaser/i.test(v.type))
  const poster = d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null
  const status = d.status === 'Ended' || d.status === 'Released' ? 'FINISHED' : d.status === 'Canceled' ? 'CANCELLED' : d.status === 'Planned' || d.status === 'In Production' ? 'NOT_YET_RELEASED' : 'RELEASING'
  const start = date(d.first_air_date || d.release_date)
  const title = d.name || d.title || 'Untitled'

  return {
    id: ids.anilist ?? id,
    idMal: ids.mal,
    title: { romaji: d.original_name || d.original_title || title, english: title, native: null },
    coverImage: { extraLarge: poster, large: poster, color: null },
    bannerImage: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : null,
    description: d.overview || null,
    genres: (d.genres || []).map((g: any) => g.name),
    averageScore: d.vote_average ? Math.round(d.vote_average * 10) : null,
    popularity: null,
    episodes: movie ? 1 : d.number_of_episodes ?? null,
    duration: d.episode_run_time?.[0] || d.runtime || null,
    format: movie ? 'MOVIE' : 'TV',
    status,
    season: null,
    seasonYear: start.year,
    trailer: yt ? { id: yt.key, site: 'youtube', thumbnail: null } : null,
    nextAiringEpisode: null,
    streamingEpisodes: [],
    meanScore: null,
    favourites: null,
    source: null,
    countryOfOrigin: null,
    siteUrl: null,
    startDate: start,
    endDate: date(d.last_air_date),
    synonyms: [],
    studios: { edges: [] },
    tags: [],
    rankings: [],
    characters: { edges: [] },
    staff: { edges: [] },
    relations: { edges: [] },
    recommendations: { nodes: [] },
    externalLinks: [],
    stats: null,
    fallback: true,
  }
}
