import type { Mapping, Tmdb, TmdbBundle } from './api'

/**
 * Anime TMDB info straight from the browser via the /api/movies passthrough gateway.
 * Same steps and same result shape as tmdbFor() in server/handler.js; api.ts tries this first and
 * falls back to the /api/tmdb server route when anything here fails.
 */
const TMDB = '/api/movies'
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
  if (anilist === 900001) {
    return { anilist: 900001, mal: null, tmdb: { id: 2777, type: 'tv', season: 1 }, tvdb: null, imdb: null, anidb: null, source: 'anibridge' }
  }
  if (anilist === 900002) {
    return { anilist: 900002, mal: null, tmdb: { id: 205048, type: 'movie', season: null }, tvdb: null, imdb: null, anidb: null, source: 'anibridge' }
  }
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

export function resolveAnimeSeason(title: string, altTitle = ''): number | null {
  const t = `${title || ''} ${altTitle || ''}`.toLowerCase()

  // Franchise-specific arc/season mappings:
  if (t.includes('kimetsu no yaiba') || t.includes('demon slayer')) {
    if (t.includes('hashira geiko') || t.includes('hashira training')) return 5
    if (t.includes('katanakaji') || t.includes('swordsmith village')) return 4
    if (t.includes('yuukaku') || t.includes('entertainment district')) return 3
    if (t.includes('mugen train') || t.includes('mugen ressha')) return 2
    return 1
  }
  if (t.includes('jujutsu kaisen')) {
    if (t.includes('2nd season') || t.includes('season 2') || t.includes('shibuya') || t.includes('kaigyoku')) return 2
    return 1
  }
  if (t.includes('bleach')) {
    if (t.includes('thousand-year') || t.includes('sennen kessen') || t.includes('thousand year')) return 2
  }
  if (t.includes('shingeki no kyojin') || t.includes('attack on titan')) {
    if (t.includes('final season') || t.includes('the final') || t.includes('season 4') || t.includes('4th season')) return 4
    if (t.includes('season 3') || t.includes('3rd season')) return 3
    if (t.includes('season 2') || t.includes('2nd season')) return 2
    return 1
  }
  if (t.includes('dr. stone') || t.includes('dr stone')) {
    if (t.includes('science future')) return 4
    if (t.includes('new world')) return 3
    if (t.includes('stone wars')) return 2
    return 1
  }
  if (t.includes('kaguya-sama') || t.includes('kaguya sama')) {
    if (t.includes('ultra romantic')) return 3
    if (t.includes('season 2') || t.includes('2nd season') || t.includes('?')) return 2
    return 1
  }
  if (t.includes('mob psycho 100')) {
    if (t.includes('iii') || t.includes('3')) return 3
    if (t.includes('ii') || t.includes('2')) return 2
    return 1
  }
  if (t.includes('sword art online')) {
    if (t.includes('war of underworld') || t.includes('alicization')) return 3
    if (t.includes('ii') || t.includes('2')) return 2
    return 1
  }
  if (t.includes('gintama')) {
    if (t.includes('the final') || t.includes('the semi-final')) return 7
    if (t.includes('shirogane') || t.includes('silver soul')) return 6
    if (t.includes('porori')) return 5
    if (t.includes('season 4') || t.includes('2017') || t.includes('gintama.')) return 4
    if (t.includes('°') || t.includes('season 3') || t.includes('2015')) return 3
    if (t.includes('enchousen') || t.includes("'") || t.includes('season 2') || t.includes('2011')) return 2
    return 1
  }
  if (t.includes('re:zero') || t.includes('re: zero')) {
    if (t.includes('season 3') || t.includes('3rd season') || t.includes('3rd')) return 3
    if (t.includes('season 2') || t.includes('2nd season') || t.includes('2nd')) return 2
    return 1
  }
  if (t.includes('reincarnated as a slime') || t.includes('slime datta ken')) {
    if (t.includes('season 3') || t.includes('3rd season')) return 3
    if (t.includes('season 2') || t.includes('2nd season')) return 2
    return 1
  }
  if (t.includes('vinland saga')) {
    if (t.includes('season 2') || t.includes('2nd season')) return 2
    return 1
  }
  if (t.includes('mushoku tensei')) {
    if (t.includes('season 2') || t.includes('2nd season') || t.includes(' ii')) return 2
    return 1
  }
  if (t.includes('one punch man') || t.includes('one-punch man')) {
    if (t.includes('season 2') || t.includes('2nd season') || t.includes('2')) return 2
    return 1
  }
  if (t.includes('blue exorcist') || t.includes('ao no exorcist')) {
    if (t.includes('yuki no hate') || t.includes('beyond the snow')) return 4
    if (t.includes('shimane illuminati')) return 3
    if (t.includes('kyoto saga') || t.includes('kyoto')) return 2
    return 1
  }
  if (t.includes('shield hero') || t.includes('tate no yuusha')) {
    if (t.includes('season 3') || t.includes('3rd season')) return 3
    if (t.includes('season 2') || t.includes('2nd season')) return 2
    return 1
  }
  if (t.includes('classroom of the elite') || t.includes('youkoso jitsuryoku')) {
    if (t.includes('season 3') || t.includes('3rd season') || t.includes(' 3')) return 3
    if (t.includes('season 2') || t.includes('2nd season') || t.includes(' ii') || t.includes(' 2')) return 2
    return 1
  }

  const regex = /\b(?:season\s*(\d+)|(\d+)(?:st|nd|rd|th)\s*season|part\s*(\d+)|cour\s*(\d+))\b/i
  const match = t.match(regex)
  if (match) {
    const num = parseInt(match[1] || match[2] || match[3] || match[4], 10)
    if (!isNaN(num) && num > 0 && num <= 30) return num
  }

  if (/\b(?:vi|6th)\b/i.test(t)) return 6
  if (/\b(?:v|5th)\b/i.test(t)) return 5
  if (/\b(?:iv|4th)\b/i.test(t)) return 4
  if (/\b(?:iii|3rd)\b/i.test(t)) return 3
  if (/\b(?:ii|2nd)\b/i.test(t)) return 2

  return null
}

export function findMatchingSeason(seasons: any[], title: string, romaji = '', baseShowName = ''): number | null {
  if (!Array.isArray(seasons) || seasons.length === 0) return null
  const fullText = `${title || ''} ${romaji || ''}`.toLowerCase()
  const baseName = (baseShowName || '').toLowerCase().trim()

  const arcCandidates = seasons
    .filter((s) => s.season_number > 0)
    .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))

  for (const s of arcCandidates) {
    const sName = (s.name || '').toLowerCase().trim()
    if (sName.length >= 3 && !/^season\s+\d+$/i.test(sName)) {
      if (baseName && sName === baseName) continue
      const coreName = sName.replace(/\s*(?:arc|saga|hen|part\s*\d+|cour\s*\d+)\s*$/i, '').trim()
      if (fullText.includes(sName) || (coreName.length >= 3 && fullText.includes(coreName))) {
        return s.season_number
      }
    }
  }

  const detected = resolveAnimeSeason(title, romaji)
  if (detected && seasons.some((s) => s.season_number === detected)) {
    return detected
  }

  if (detected) {
    const numMatch = seasons.find((s) => {
      const sName = (s.name || '').toLowerCase()
      return (
        sName.includes(`season ${detected}`) ||
        sName.includes(`${detected}nd season`) ||
        sName.includes(`${detected}rd season`) ||
        sName.includes(`${detected}th season`)
      )
    })
    if (numMatch) return numMatch.season_number
  }

  return detected || null
}

export const cleanTitle = (t = '') => {
  let s = (t || '').trim()
  s = s.replace(/\s*\(\d{4}\)\s*$/g, '')
  s = s
    .replace(/\s*[-–:]\s*(?:The\s+)?Final\s+Season.*$/i, '')
    .replace(/\s*[-–:]\s*Season\s+\d+.*$/i, '')
    .replace(/\s*[-–:]\s*\d+(?:st|nd|rd|th)\s+Season.*$/i, '')
    .replace(/\s*[-–:]\s*(?:Part|Cour)\s+\d+.*$/i, '')
    .replace(/\s*[-–:]\s*(?:Swordsmith Village|Entertainment District|Hashira Training|Mugen Train|Shibuya|New World|Stone Wars|Ultra Romantic|War of Underworld|Alicization|Kyoto Saga|Shimane Illuminati|Thousand-Year Blood War).*$/i, '')
    .replace(/\s*(Final Season|Season\s+\d+|\d+(st|nd|rd|th)\s+Season|Cour\s+\d+|Part\s+\d+)\s*$/gi, '')
    .replace(/\s*[-–:]\s*$/, '')
    .trim()
  return s || t.trim()
}

export async function tmdbDirect(anilistId: number, title: string, format?: string | null, romaji?: string | null): Promise<TmdbBundle> {
  const map = anilistId ? await mapOf(anilistId) : null
  let ref = map?.tmdb ? { id: map.tmdb.id, type: map.tmdb.type, season: map.tmdb.season } : null

  const detectedSeason = resolveAnimeSeason(title, romaji || '')
  if (ref && !ref.season && detectedSeason) {
    ref.season = detectedSeason
  }

  if (!ref && title) {
    try {
      const want = format === 'MOVIE' ? 'movie' : 'tv'
      const hasSpecificSubtitle = /[:\-\–]|100\s*years|thousand\s*year|final|re:|0|saga|season|arc/i.test(title)
      let hit: any = null

      if (hasSpecificSubtitle && want === 'tv') {
        try {
          const directRes = await get(`${TMDB}/search/multi?query=${encodeURIComponent(title.trim())}`)
          hit = directRes.results?.find((r: any) => {
            if (r.media_type !== 'tv') return false
            const rName = (r.name || r.title || '').toLowerCase()
            const tName = title.toLowerCase()
            return rName.includes(tName) || tName.includes(rName)
          })
          if (hit) {
            ref = { id: hit.id, type: 'tv', season: 1 }
          }
        } catch {
          /* try base franchise search */
        }
      }

      if (!ref) {
        const cleaned = cleanTitle(title)
        const res = await get(`${TMDB}/search/multi?query=${encodeURIComponent(cleaned || title)}`)
        hit = res.results?.find((r: any) => r.media_type === want) || res.results?.find((r: any) => r.media_type === 'tv' || r.media_type === 'movie')
        if (hit) ref = { id: hit.id, type: hit.media_type, season: detectedSeason || null }
      }
    } catch {
      /* no match */
    }
  }
  if (!ref) return { mapping: map, tmdb: null }

  const d = await get(
    `${TMDB}/${ref.type}/${ref.id}?language=en-US&append_to_response=images,videos,credits,external_ids,content_ratings,release_dates,watch/providers&include_image_language=en,null`,
  )

  if (ref.type === 'tv' && Array.isArray(d.seasons) && d.seasons.length > 0) {
    const matched = findMatchingSeason(d.seasons, title, romaji || '', d.name || d.title)
    if (matched) {
      ref.season = matched
    } else if (ref.season && ref.season > 1) {
      const exists = d.seasons.some((s: any) => s.season_number === ref.season)
      if (!exists && d.number_of_seasons === 1) {
        ref.season = 1
      }
    }
  }

  let seasonOverview: string | null = null
  let seasonPoster: string | null = null
  if (ref.type === 'tv' && ref.season && ref.season > 1) {
    try {
      const seasonData = await get(`${TMDB}/tv/${ref.id}/season/${ref.season}?language=en-US`)
      if (seasonData) {
        if (seasonData.overview && seasonData.overview.trim()) {
          seasonOverview = seasonData.overview.trim()
        }
        if (seasonData.poster_path) {
          seasonPoster = seasonData.poster_path
        }
      }
    } catch {
      /* fallback to show-level info */
    }
  }

  const pngs = (d.images?.logos || []).filter((l: any) => l.file_path && !l.file_path.toLowerCase().endsWith('.svg'))
  const logo = pngs.sort((a: any, b: any) => Number(b.iso_639_1 === 'en') - Number(a.iso_639_1 === 'en') || b.vote_average - a.vote_average)[0]?.file_path ?? null
  const textless = (d.images?.backdrops || []).filter((b: any) => !b.iso_639_1).sort((a: any, b: any) => b.vote_average - a.vote_average)
  const backdrops: string[] = (textless.length ? textless : d.images?.backdrops || []).slice(0, 6).map((b: any) => b.file_path)
  const certification =
    d.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US')?.rating ||
    d.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US')?.release_dates?.find((x: any) => x.certification)?.certification ||
    null
  const yt = (d.videos?.results || []).find((v: any) => v.site === 'YouTube' && /trailer|teaser/i.test(v.type))

  const wpResults = (d['watch/providers'] || d.watch_providers)?.results || {}
  const wpCountry = wpResults['US'] || wpResults['IN'] || wpResults['GB'] || Object.values(wpResults)[0] as any
  const flat = wpCountry?.flatrate || wpCountry?.ads || wpCountry?.buy || []
  const watchProviders = flat.length > 0 ? {
    link: wpCountry?.link || null,
    providers: flat.slice(0, 8).map((p: any) => ({
      id: p.provider_id,
      name: p.provider_name,
      logo: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null,
    })),
  } : null

  const tmdb: Tmdb = {
    id: ref.id,
    type: ref.type,
    season: ref.season || 1,
    imdbId: d.external_ids?.imdb_id || map?.imdb || null,
    logo,
    backdrop: d.backdrop_path || backdrops[0] || null,
    poster: seasonPoster || d.poster_path || null,
    backdrops,
    overview: seasonOverview || d.overview || null,
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
    watchProviders,
  }
  return { mapping: map, tmdb }
}

/** Fetch only landscape backdrops for a title (sorted by votes, textless first). */
export async function tmdbBackdrops(type: string, id: number): Promise<string[]> {
  try {
    const d = await get(`${TMDB}/${type}/${id}/images?include_image_language=en,null`)
    const byVotes = (a: any, b: any) => b.vote_average - a.vote_average
    const bd = (d.backdrops || []).sort((a: any, b: any) => Number(!!a.iso_639_1) - Number(!!b.iso_639_1) || byVotes(a, b))
    return bd.slice(0, 30).map((i: any) => `https://image.tmdb.org/t/p/w1280${i.file_path}`)
  } catch {
    return []
  }
}

/** Every TMDB backdrop + poster for a title (textless backdrops first). */
export async function tmdbGallery(type: string, id: number): Promise<string[]> {
  const d = await get(`${TMDB}/${type}/${id}/images?include_image_language=en,null`)
  const byVotes = (a: any, b: any) => b.vote_average - a.vote_average
  const bd = (d.backdrops || []).sort((a: any, b: any) => Number(!!a.iso_639_1) - Number(!!b.iso_639_1) || byVotes(a, b))
  const ps = (d.posters || []).sort(byVotes)
  return [...bd.slice(0, 40), ...ps.slice(0, 20)].map((i: any) => `https://image.tmdb.org/t/p/w1280${i.file_path}`)
}

export async function tmdbEpisodesDirect(
  tmdbId: number,
  season: number,
): Promise<{ n: number; name: string | null; overview: string | null; still: string | null; runtime: number | null; air: string | null }[]> {
  // If requesting an explicit sequel season (e.g. season 2, 3), fetch that season directly
  if (season > 1) {
    const d = await get(`${TMDB}/tv/${tmdbId}/season/${season}?language=en-US`)
    return (d.episodes || []).map((e: any) => ({
      n: e.episode_number,
      name: e.name || null,
      overview: e.overview || null,
      still: e.still_path || null,
      runtime: e.runtime || null,
      air: e.air_date || null,
    }))
  }

  // For season 1 / main show: try to fetch absolute episode group first (gives all episodes for long-running shows)
  try {
    const eg = await get(`${TMDB}/tv/${tmdbId}/episode_groups`, 8000)
    const groups: Array<{ id: string; name: string; type: number }> = eg?.results || []
    const best =
      groups.find((g) => g.type === 2 && /no specials/i.test(g.name)) ||
      groups.find((g) => g.type === 2 && /absolute/i.test(g.name)) ||
      groups.find((g) => g.type === 2) ||
      groups.find((g) => /absolute|correct order/i.test(g.name))

    if (best) {
      const d = await get(`${TMDB}/tv/episode_group/${best.id}?language=en-US`, 12000)
      const pool = (d.groups || []).filter((g: any) => !/special/i.test(g.name || '') && g.order !== 0)
      const list = pool.length ? pool : d.groups || []
      let eps: any[] = []
      if (list.length === 1) {
        eps = list[0].episodes || []
      } else if (list.length > 1) {
        const sorted = [...list].sort((a: any, b: any) => (b.episodes?.length || 0) - (a.episodes?.length || 0))
        const largest = sorted[0]
        const second = sorted[1]
        if (largest && (!second || (largest.episodes?.length || 0) > (second.episodes?.length || 0) * 2)) {
          eps = largest.episodes || []
        } else {
          const inOrder = [...list].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
          eps = inOrder.flatMap((g: any) => g.episodes || [])
        }
      }
      if (eps.length > 0) {
        return eps.map((e: any) => ({
          n: typeof e.order === 'number' && e.order >= 0 ? e.order + 1 : Number(e.episode_number),
          name: e.name || null,
          overview: e.overview || null,
          still: e.still_path || null,
          runtime: e.runtime || null,
          air: e.air_date || null,
        }))
      }
    }
  } catch {
    /* fallback to standard season 1 */
  }

  const d = await get(`${TMDB}/tv/${tmdbId}/season/1?language=en-US`)
  return (d.episodes || []).map((e: any) => ({
    n: e.episode_number,
    name: e.name || null,
    overview: e.overview || null,
    still: e.still_path || null,
    runtime: e.runtime || null,
    air: e.air_date || null,
  }))
}
