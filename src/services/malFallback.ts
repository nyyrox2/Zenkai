import type { AniCardMedia, AniMedia } from '../types/anime'
import type { CatalogParams } from './anilist'
import { get as jikan } from './jikan'

/**
 * AniList is down -> list pages (home / search / browse) come from MyAnimeList (Jikan).
 * Our ids are AniList ids, so every MAL id is translated with AniBridge's sibling ARM in ONE batch call;
 * titles ARM can't map are dropped.
 */
const ARM = 'https://arm.haglund.dev/api/v2/ids?include=anilist,myanimelist'

/* eslint-disable @typescript-eslint/no-explicit-any */
const idCache = new Map<number, number | null>()

async function toAniList(mal: number[]): Promise<void> {
  const need = [...new Set(mal)].filter((m) => !idCache.has(m))
  if (!need.length) return
  const ctl = new AbortController()
  const t = window.setTimeout(() => ctl.abort(), 12000)
  try {
    const r = await fetch(ARM, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(need.map((m) => ({ myanimelist: m }))),
    })
    if (!r.ok) throw new Error(String(r.status))
    const out = (await r.json()) as ({ anilist?: number | null } | null)[]
    need.forEach((m, i) => idCache.set(m, out[i]?.anilist ?? null))
  } finally {
    window.clearTimeout(t)
  }
}

const FORMAT: Record<string, string> = { TV: 'TV', Movie: 'MOVIE', OVA: 'OVA', ONA: 'ONA', Special: 'SPECIAL', 'TV Special': 'TV_SPECIAL', Music: 'MUSIC' }
const STATUS: Record<string, string> = { 'Finished Airing': 'FINISHED', 'Currently Airing': 'RELEASING', 'Not yet aired': 'NOT_YET_RELEASED' }

function toMedia(j: any, id: number): AniMedia {
  const cover = j.images?.jpg?.large_image_url || j.images?.webp?.large_image_url || j.images?.jpg?.image_url || null
  const yt = j.trailer?.youtube_id
  return {
    id,
    idMal: j.mal_id,
    title: { romaji: j.title ?? null, english: j.title_english ?? j.title ?? null, native: j.title_japanese ?? null },
    coverImage: { extraLarge: cover, large: cover, color: null },
    bannerImage: null,
    description: j.synopsis ?? null,
    genres: (j.genres || []).map((g: any) => g.name),
    averageScore: j.score ? Math.round(j.score * 10) : null,
    popularity: j.members ?? null,
    episodes: j.episodes ?? null,
    duration: parseInt(j.duration, 10) || null,
    format: FORMAT[j.type] ?? 'TV',
    status: STATUS[j.status] ?? null,
    season: j.season ? String(j.season).toUpperCase() : null,
    seasonYear: j.year ?? (j.aired?.from ? new Date(j.aired.from).getFullYear() : null),
    trailer: yt ? { id: yt, site: 'youtube', thumbnail: j.trailer?.images?.maximum_image_url ?? null } : null,
    nextAiringEpisode: null,
  }
}

const safe = (j: any) => !/Rx|Hentai/i.test(j.rating || '') && !(j.genres || []).some((g: any) => g.name === 'Hentai')

/** Maps raw Jikan lists to AniList-id media in one ARM call. */
async function mapLists(...lists: any[][]): Promise<AniMedia[][]> {
  await toAniList(lists.flat().map((j) => j.mal_id))
  return lists.map((list) => {
    const seen = new Set<number>()
    const out: AniMedia[] = []
    for (const j of list) {
      const id = idCache.get(j.mal_id)
      if (!id || seen.has(id) || !safe(j)) continue
      seen.add(id)
      out.push(toMedia(j, id))
    }
    return out
  })
}

export async function homeFromMal() {
  const ok = (r: PromiseSettledResult<any[]>) => (r.status === 'fulfilled' ? r.value : [])
  const [now, top, pop, soon] = (
    await Promise.allSettled([
      jikan<any[]>('/seasons/now?limit=24&sfw'),
      jikan<any[]>('/top/anime?limit=24&sfw'),
      jikan<any[]>('/top/anime?filter=bypopularity&limit=24&sfw'),
      jikan<any[]>('/seasons/upcoming?limit=24&sfw'),
    ])
  ).map(ok)
  const [n, t, p, u] = await mapLists(now, top, pop, soon)
  if (!n.length && !t.length && !p.length) throw new Error('No fallback data')
  const card = (l: AniMedia[]): AniCardMedia[] => l.slice(0, 18)
  return { trending: n.slice(0, 12), season: card(n), popular: card(p), top: card(t), upcoming: card(u) }
}

export async function searchFromMal(search: string): Promise<AniMedia[]> {
  const q = search ? `&q=${encodeURIComponent(search)}` : ''
  const [list] = await mapLists(await jikan<any[]>(`/anime?limit=12&sfw&order_by=members&sort=desc${q}`))
  return list
}

const ORDER: Record<string, string> = {
  SCORE_DESC: 'score',
  START_DATE_DESC: 'start_date',
  FAVOURITES_DESC: 'favorites',
}
const TYPE: Record<string, string> = { TV: 'tv', MOVIE: 'movie', OVA: 'ova', ONA: 'ona', SPECIAL: 'special', MUSIC: 'music' }
const JSTATUS: Record<string, string> = { RELEASING: 'airing', FINISHED: 'complete', NOT_YET_RELEASED: 'upcoming' }

export async function catalogFromMal(p: CatalogParams, page: number): Promise<{ items: AniCardMedia[]; hasNext: boolean }> {
  let path: string
  if (p.year && p.season && !p.search) {
    path = `/seasons/${p.year}/${p.season.toLowerCase()}?page=${page}&limit=24&sfw`
  } else {
    const q = new URLSearchParams({ page: String(page), limit: '24', sfw: 'true', order_by: ORDER[p.sort] ?? 'members', sort: 'desc' })
    if (p.search) q.set('q', p.search)
    if (p.format && TYPE[p.format]) q.set('type', TYPE[p.format])
    if (p.status && JSTATUS[p.status]) q.set('status', JSTATUS[p.status])
    if (p.year) {
      q.set('start_date', `${p.year}-01-01`)
      q.set('end_date', `${p.year}-12-31`)
    }
    path = `/anime?${q}`
  }
  const raw = await jikan<any[]>(path)
  const [items] = await mapLists(raw)
  return { items, hasNext: raw.length >= 24 }
}
