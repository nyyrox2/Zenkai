import type { AniCardMedia, AniMedia } from '../types/anime'
import type { CatalogParams } from './anilist'
import { getSeason } from '../lib/utils'

/**
 * AniList is down -> Kitsu first. Its `mappings` already carry the AniList + MAL ids,
 * so there is no ID-translation hop (that hop was what made the MAL fallback fragile). Max page size is 20.
 */
const K = 'https://kitsu.io/api/edge/anime'

/* eslint-disable @typescript-eslint/no-explicit-any */
async function kitsu(params: Record<string, string>): Promise<AniMedia[]> {
  const q = new URLSearchParams({ ...params, include: 'mappings,genres', 'fields[mappings]': 'externalSite,externalId', 'fields[genres]': 'name' })
  const ctl = new AbortController()
  const t = window.setTimeout(() => ctl.abort(), 10000)
  try {
    const r = await fetch(`${K}?${q}`, { signal: ctl.signal })
    if (!r.ok) throw new Error(String(r.status))
    const j = await r.json()
    const inc = new Map<string, any>((j.included || []).map((i: any) => [`${i.type}:${i.id}`, i.attributes]))
    const seen = new Set<number>()
    const out: AniMedia[] = []
    for (const a of j.data || []) {
      const m = toMedia(a, inc)
      if (!m || seen.has(m.id)) continue
      seen.add(m.id)
      out.push(m)
    }
    return out
  } finally {
    window.clearTimeout(t)
  }
}

const FORMAT: Record<string, string> = { TV: 'TV', movie: 'MOVIE', OVA: 'OVA', ONA: 'ONA', special: 'SPECIAL', music: 'MUSIC' }
const STATUS: Record<string, string> = { current: 'RELEASING', finished: 'FINISHED', upcoming: 'NOT_YET_RELEASED', unreleased: 'NOT_YET_RELEASED', tba: 'NOT_YET_RELEASED' }

function toMedia(d: any, inc: Map<string, any>): AniMedia | null {
  const a = d.attributes
  if (a.nsfw || a.ageRating === 'R18') return null
  const maps = (d.relationships?.mappings?.data || []).map((r: any) => inc.get(`mappings:${r.id}`)).filter(Boolean)
  const ext = (site: string) => Number(maps.find((m: any) => m.externalSite === site)?.externalId) || null
  const id = ext('anilist/anime')
  if (!id) return null
  const cover = a.posterImage?.large || a.posterImage?.original || null
  const start = a.startDate ? new Date(a.startDate) : null
  return {
    id,
    idMal: ext('myanimelist/anime'),
    title: { romaji: a.titles?.en_jp ?? a.canonicalTitle ?? null, english: a.titles?.en ?? a.canonicalTitle ?? null, native: a.titles?.ja_jp ?? null },
    coverImage: { extraLarge: cover, large: cover, color: null },
    bannerImage: a.coverImage?.large || a.coverImage?.original || null,
    description: a.synopsis ?? null,
    genres: (d.relationships?.genres?.data || []).map((r: any) => inc.get(`genres:${r.id}`)?.name).filter(Boolean),
    averageScore: a.averageRating ? Math.round(parseFloat(a.averageRating)) : null,
    popularity: a.userCount ?? null,
    episodes: a.episodeCount ?? null,
    duration: a.episodeLength ?? null,
    format: FORMAT[a.subtype] ?? 'TV',
    status: STATUS[a.status] ?? null,
    season: start ? getSeason(start).season : null,
    seasonYear: start ? start.getFullYear() : null,
    trailer: a.youtubeVideoId ? { id: a.youtubeVideoId, site: 'youtube', thumbnail: null } : null,
    nextAiringEpisode: null,
  }
}

const page = (n: number, extra: Record<string, string>) => ({ 'page[limit]': String(n), ...extra })

export async function homeFromKitsu() {
  const { season, year } = getSeason()
  const [now, top, pop, soon] = await Promise.all([
    kitsu(page(20, { 'filter[season]': season.toLowerCase(), 'filter[seasonYear]': String(year), sort: 'popularityRank' })),
    kitsu(page(20, { sort: 'ratingRank' })),
    kitsu(page(20, { sort: 'popularityRank' })),
    kitsu(page(20, { 'filter[status]': 'upcoming', sort: 'popularityRank' })),
  ])
  if (!now.length && !top.length && !pop.length) throw new Error('No fallback data')
  const card = (l: AniMedia[]): AniCardMedia[] => l.slice(0, 18)
  return { trending: now.slice(0, 12), season: card(now), popular: card(pop), top: card(top), upcoming: card(soon) }
}

export const searchFromKitsu = (search: string) =>
  kitsu(page(12, search ? { 'filter[text]': search } : { sort: 'popularityRank' }))

const SORT: Record<string, string> = { SCORE_DESC: 'ratingRank', START_DATE_DESC: '-startDate', FAVOURITES_DESC: '-favoritesCount' }
const CAT: Record<string, string> = { 'Sci-Fi': 'science-fiction', 'Mahou Shoujo': 'magical-girl' }

export async function catalogFromKitsu(p: CatalogParams, n: number): Promise<{ items: AniCardMedia[]; hasNext: boolean }> {
  const q: Record<string, string> = page(20, { 'page[offset]': String((n - 1) * 20), sort: SORT[p.sort] ?? 'popularityRank' })
  if (p.search) q['filter[text]'] = p.search
  if (p.genre) q['filter[categories]'] = CAT[p.genre] ?? p.genre.toLowerCase().replace(/\s+/g, '-')
  if (p.format) q['filter[subtype]'] = Object.keys(FORMAT).find((k) => FORMAT[k] === p.format) ?? 'TV'
  if (p.status) q['filter[status]'] = Object.keys(STATUS).find((k) => STATUS[k] === p.status) ?? 'finished'
  if (p.year) q['filter[seasonYear]'] = String(p.year)
  if (p.season) q['filter[season]'] = p.season.toLowerCase()
  const items = await kitsu(q)
  return { items, hasNext: items.length >= 15 }
}
