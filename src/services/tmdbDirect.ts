import type { Mapping, Tmdb, TmdbBundle } from './api'

/**
 * Anime TMDB info straight from the browser, the same way Movies already works (no Worker request).
 * Same steps and same result shape as tmdbFor() in server/handler.js; api.ts tries this first and
 * falls back to the /api/tmdb server route when anything here fails.
 */
const TMDB = 'https://aniversee.vercel.app/api/tmdb'
const ANIBRIDGE = 'https://anibridge.eliasbenb.dev/api/mappings?source.descriptor=anilist:'
const ARM = 'https://arm.haglund.dev/api/v2/ids?source=anilist&id='

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

function parseMapping(data: unknown, anilist: number): Mapping {
  const out: Mapping = { anilist, mal: null, tmdb: null, tvdb: null, imdb: null, anidb: null, source: 'anibridge' }
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
    const [provider, id, scope] = d.split(':')
    const p = provider.toLowerCase()
    const season = scope && /^s\d+$/i.test(scope) ? parseInt(scope.slice(1), 10) : null
    if ((p === 'mal' || p === 'myanimelist') && !out.mal) out.mal = Number(id) || null
    else if (p.startsWith('tmdb') && !out.tmdb) out.tmdb = { id: Number(id), type: p.includes('movie') ? 'movie' : 'tv', season }
    else if (p.startsWith('tvdb') && !out.tvdb) out.tvdb = Number(id) || null
    else if (p.startsWith('imdb') && !out.imdb) out.imdb = id
    else if (p === 'anidb' && !out.anidb) out.anidb = Number(id) || null
  }
  return out
}

async function mapOf(anilist: number): Promise<Mapping | null> {
  try {
    const m = parseMapping(await get(ANIBRIDGE + anilist), anilist)
    if (m.mal || m.tmdb || m.imdb) return m
  } catch {
    /* try ARM */
  }
  try {
    const a = await get(ARM + anilist)
    return {
      anilist,
      mal: a.myanimelist ?? null,
      tmdb: a.themoviedb ? { id: a.themoviedb, type: a.type === 'MOVIE' ? 'movie' : 'tv', season: a['themoviedb-season'] ?? null } : null,
      tvdb: a.thetvdb ?? null,
      imdb: a.imdb ?? null,
      anidb: a.anidb ?? null,
      source: 'arm',
    }
  } catch {
    return null
  }
}

const cleanTitle = (t = '') =>
  t
    .replace(/\s*\(\d{4}\)\s*$/g, '')
    .replace(/\s*(Final Season|Season\s+\d+|\d+(st|nd|rd|th)\s+Season|Cour\s+\d+|Part\s+\d+)\s*$/gi, '')
    .replace(/\s*:\s*$/, '')
    .trim()

export async function tmdbDirect(anilistId: number, title: string, format?: string | null): Promise<TmdbBundle> {
  const map = anilistId ? await mapOf(anilistId) : null
  let ref = map?.tmdb ? { id: map.tmdb.id, type: map.tmdb.type, season: map.tmdb.season } : null

  if (!ref && title) {
    try {
      const want = format === 'MOVIE' ? 'movie' : 'tv'
      const res = await get(`${TMDB}/search/multi?query=${encodeURIComponent(cleanTitle(title) || title)}`)
      const hit = res.results?.find((r: any) => r.media_type === want) || res.results?.find((r: any) => r.media_type === 'tv' || r.media_type === 'movie')
      if (hit) ref = { id: hit.id, type: hit.media_type, season: null }
    } catch {
      /* no match */
    }
  }
  if (!ref) return { mapping: map, tmdb: null }

  const d = await get(
    `${TMDB}/${ref.type}/${ref.id}?language=en-US&append_to_response=images,videos,credits,external_ids,content_ratings,release_dates,episode_groups&include_image_language=en,null`,
  )
  const pngs = (d.images?.logos || []).filter((l: any) => l.file_path && !l.file_path.toLowerCase().endsWith('.svg'))
  const logo = pngs.sort((a: any, b: any) => Number(b.iso_639_1 === 'en') - Number(a.iso_639_1 === 'en') || b.vote_average - a.vote_average)[0]?.file_path ?? null
  const textless = (d.images?.backdrops || []).filter((b: any) => !b.iso_639_1).sort((a: any, b: any) => b.vote_average - a.vote_average)
  const backdrops: string[] = (textless.length ? textless : d.images?.backdrops || []).slice(0, 6).map((b: any) => b.file_path)
  const certification =
    d.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US')?.rating ||
    d.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US')?.release_dates?.find((x: any) => x.certification)?.certification ||
    null
  const yt = (d.videos?.results || []).find((v: any) => v.site === 'YouTube' && /trailer|teaser/i.test(v.type))

  const rawGroups = (d.episode_groups?.results || []) as Array<{ id: string; name: string; type: number }>
  const bestGroup =
    rawGroups.find((g) => g.type === 2 && /no specials/i.test(g.name)) ||
    rawGroups.find((g) => g.type === 2 && /absolute/i.test(g.name)) ||
    rawGroups.find((g) => g.type === 2) ||
    rawGroups.find((g) => /absolute/i.test(g.name)) ||
    rawGroups.find((g) => /correct order/i.test(g.name)) ||
    null
  const episodeGroupId = bestGroup?.id ?? null
  const seasonsList = (d.seasons || [])
    .filter((s: any) => s.season_number > 0)
    .map((s: any) => ({ season: s.season_number, episodeCount: s.episode_count }))

  const tmdb: Tmdb = {
    id: ref.id,
    type: ref.type,
    season: ref.season,
    imdbId: d.external_ids?.imdb_id || map?.imdb || null,
    logo,
    backdrop: d.backdrop_path || backdrops[0] || null,
    backdrops,
    overview: d.overview || null,
    tagline: d.tagline || null,
    rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    votes: d.vote_count || null,
    certification,
    networks: (d.networks || d.production_companies || []).slice(0, 4).map((n: any) => n.name),
    status: d.status || null,
    language: d.original_language || null,
    seasons: d.number_of_seasons ?? null,
    episodes: d.number_of_episodes ?? null,
    firstAir: d.first_air_date || d.release_date || null,
    lastAir: d.last_air_date || null,
    runtime: d.episode_run_time?.[0] || d.runtime || null,
    cast: (d.credits?.cast || []).slice(0, 10).map((c: any) => ({ name: c.name, character: c.character, photo: c.profile_path })),
    trailer: yt ? yt.key : null,
    episodeGroupId,
    seasonsList,
  }
  return { mapping: map, tmdb }
}

export async function tmdbEpisodesDirect(tmdbId: number, season: number): Promise<{ n: number; name: string | null; overview: string | null; still: string | null; runtime: number | null; air: string | null }[]> {
  const d = await get(`${TMDB}/tv/${tmdbId}/season/${season}?language=en-US`)
  return (d.episodes || []).map((e: any) => ({ n: e.episode_number, name: e.name || null, overview: e.overview || null, still: e.still_path || null, runtime: e.runtime || null, air: e.air_date || null }))
}

export async function tmdbEpisodeGroupDirect(groupId: string): Promise<{ n: number; name: string | null; overview: string | null; still: string | null; runtime: number | null; air: string | null }[]> {
  const d = await get(`${TMDB}/tv/episode_group/${groupId}?language=en-US`)
  const groups: any[] = d.groups || []
  if (!groups.length) return []

  const nonSpecials = groups.filter((g) => !/special/i.test(g.name || '') && g.order !== 0)
  const pool = nonSpecials.length ? nonSpecials : groups

  let chosenEpisodes: any[] = []
  if (pool.length === 1) {
    chosenEpisodes = pool[0].episodes || []
  } else {
    const sorted = [...pool].sort((a, b) => (b.episodes?.length || 0) - (a.episodes?.length || 0))
    const largest = sorted[0]
    const second = sorted[1]
    if (largest && (!second || (largest.episodes?.length || 0) > (second.episodes?.length || 0) * 2)) {
      chosenEpisodes = largest.episodes || []
    } else {
      const inOrder = [...pool].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      chosenEpisodes = inOrder.flatMap((g) => g.episodes || [])
    }
  }

  return chosenEpisodes.map((e: any) => {
    const n = typeof e.order === 'number' && e.order >= 0 ? e.order + 1 : Number(e.episode_number)
    return {
      n,
      name: e.name || null,
      overview: e.overview || null,
      still: e.still_path || null,
      runtime: e.runtime || null,
      air: e.air_date || null,
    }
  })
}

export async function tmdbAllSeasonsDirect(
  tmdbId: number,
  seasons: number[],
): Promise<{ n: number; name: string | null; overview: string | null; still: string | null; runtime: number | null; air: string | null }[]> {
  const results = await Promise.all(
    seasons.map((s) => tmdbEpisodesDirect(tmdbId, s).catch(() => []))
  )
  const out: { n: number; name: string | null; overview: string | null; still: string | null; runtime: number | null; air: string | null }[] = []
  let offset = 0
  for (const list of results) {
    if (!list.length) continue
    const firstNum = list[0].n
    const needsOffset = firstNum === 1 && offset > 0
    for (const ep of list) {
      out.push({
        ...ep,
        n: needsOffset ? ep.n + offset : ep.n,
      })
    }
    offset += list.length
  }
  return out
}
