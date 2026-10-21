import type { AniAiringEntry, AniCardMedia, AniMedia, AniMediaDetails, AniStreamingEpisode, HomeData, WatchOrderEntry } from '../types/anime'
import { getSeason } from '../lib/utils'
import { fetchAnimeFallback } from './fallback'
import { AniListDownError, markAniListDown, markAniListUp } from '../lib/anilistStatus'
import { catalogFromMal, homeFromMal, searchFromMal } from './malFallback'

const ENDPOINT = 'https://graphql.anilist.co'
const TTL = 5 * 60 * 1000

const cache = new Map<string, { at: number; data: unknown }>()

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = query + JSON.stringify(variables)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.data as T

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
  } catch {
    throw new AniListDownError('AniList is unreachable right now.')
  }

  const json = await res.json().catch(() => null)

  if (!res.ok || json?.errors?.length) {
    if (res.status === 429) throw new AniListDownError('AniList rate limit reached. Please wait a minute and retry.')
    if (res.status >= 500) throw new AniListDownError(`AniList is down (${res.status}).`)
    if (res.status === 404) throw new Error('Anime not found.')
    throw new Error(json?.errors?.[0]?.message ?? `AniList request failed (${res.status})`)
  }

  markAniListUp()
  cache.set(key, { at: Date.now(), data: json.data })
  return json.data as T
}

/** AniList first; when it is down, run the MAL / TMDB fallback and flag the site-wide "AniList is down" banner. */
async function guard<T>(run: () => Promise<T>, fb: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (!(err instanceof AniListDownError)) throw err
    markAniListDown()
    try {
      return await fb()
    } catch {
      throw new Error('AniList is down and the MAL fallback failed too. Try again in a minute.')
    }
  }
}

const MEDIA_FIELDS = /* GraphQL */ `
  fragment MediaFields on Media {
    id
    idMal
    title { romaji english native }
    coverImage { extraLarge large color }
    bannerImage
    description(asHtml: false)
    genres
    averageScore
    popularity
    episodes
    duration
    format
    status
    season
    seasonYear
    trailer { id site thumbnail }
    nextAiringEpisode { episode airingAt timeUntilAiring }
  }
`

const CARD_FIELDS = /* GraphQL */ `
  fragment CardFields on Media {
    id
    idMal
    title { romaji english native }
    coverImage { extraLarge large color }
    genres
    averageScore
    episodes
    format
    status
    seasonYear
  }
`

/* ---------- Home: one request, five rows (only the hero rows carry full fields) ---------- */
export const fetchHome = (): Promise<HomeData> => guard(homeAniList, homeFromMal)
async function homeAniList(): Promise<HomeData> {
  const { season, year } = getSeason()
  const query = /* GraphQL */ `
    query ($season: MediaSeason, $year: Int) {
      trending: Page(perPage: 12) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ...MediaFields }
      }
      season: Page(perPage: 18) {
        media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ...CardFields }
      }
      popular: Page(perPage: 18) {
        media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ...CardFields }
      }
      top: Page(perPage: 18) {
        media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ...CardFields }
      }
      upcoming: Page(perPage: 18) {
        media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC, isAdult: false) { ...CardFields }
      }
    }
    ${MEDIA_FIELDS}
    ${CARD_FIELDS}
  `
  type P<T> = { media: T[] }
  const data = await gql<{ trending: P<AniMedia>; season: P<AniCardMedia>; popular: P<AniCardMedia>; top: P<AniCardMedia>; upcoming: P<AniCardMedia> }>(
    query,
    { season, year },
  )
  return {
    trending: data.trending.media,
    season: data.season.media,
    popular: data.popular.media,
    top: data.top.media,
    upcoming: data.upcoming.media,
  }
}

/* ---------- Search ---------- */
export const searchAnime = (search: string, genre?: string): Promise<AniMedia[]> =>
  guard(() => searchAniList(search, genre), () => searchFromMal(search))
async function searchAniList(search: string, genre?: string): Promise<AniMedia[]> {
  const query = /* GraphQL */ `
    query ($search: String, $genre: String, $sort: [MediaSort]) {
      Page(perPage: 12) {
        media(type: ANIME, search: $search, genre: $genre, sort: $sort, isAdult: false) { ...MediaFields }
      }
    }
    ${MEDIA_FIELDS}
  `
  const variables: Record<string, unknown> = {
    sort: search ? ['SEARCH_MATCH', 'POPULARITY_DESC'] : ['POPULARITY_DESC'],
  }
  if (search) variables.search = search
  if (genre) variables.genre = genre
  const data = await gql<{ Page: { media: AniMedia[] } }>(query, variables)
  return data.Page.media
}

/* ---------- Details ---------- */
const DETAILS_QUERY = /* GraphQL */ `
  query ($id: Int, $idMal: Int) {
    Media(id: $id, idMal: $idMal, type: ANIME) {
      ...MediaFields
      meanScore
      favourites
      source
      countryOfOrigin
      siteUrl
      startDate { year month day }
      endDate { year month day }
      synonyms
      studios { edges { isMain node { id name } } }
      tags { name rank isMediaSpoiler }
      rankings { rank type allTime year season context }
      characters(sort: [ROLE, RELEVANCE], perPage: 12) {
        edges {
          role
          node { id name { full } image { large } }
          voiceActors(language: JAPANESE, sort: RELEVANCE) { id name { full } image { large } }
        }
      }
      staff(sort: RELEVANCE, perPage: 8) {
        edges { role node { id name { full } image { large } } }
      }
      relations {
        edges {
          relationType(version: 2)
          node {
            id type
            title { romaji english native }
            coverImage { large color }
            format status averageScore seasonYear episodes
          }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 14) {
        nodes {
          mediaRecommendation {
            id
            title { romaji english native }
            coverImage { large color }
            averageScore format episodes seasonYear
          }
        }
      }
      externalLinks { site url }
      streamingEpisodes { title thumbnail }
      stats {
        scoreDistribution { score amount }
        statusDistribution { status amount }
      }
    }
  }
  ${MEDIA_FIELDS}
`

/** AniList first; if it's down / rate limited, rebuild the page from TMDB (ids via AniBridge). "Not found" is not a fallback case. */
async function withFallback(run: () => Promise<AniMediaDetails>, id: number, fromMal: boolean): Promise<AniMediaDetails> {
  try {
    return await run()
  } catch (err) {
    if (err instanceof Error && err.message === 'Anime not found.') throw err
    markAniListDown()
    try {
      return await fetchAnimeFallback(id, fromMal)
    } catch {
      throw err
    }
  }
}

export const fetchAnimeById = (id: number) =>
  withFallback(async () => (await gql<{ Media: AniMediaDetails }>(DETAILS_QUERY, { id })).Media, id, false)

export const fetchAnimeByMalId = (idMal: number) =>
  withFallback(async () => (await gql<{ Media: AniMediaDetails }>(DETAILS_QUERY, { idMal })).Media, idMal, true)

/* ---------- Catalog (Trending / Popular / Top / Browse) ---------- */
export interface CatalogParams {
  search?: string
  genre?: string
  format?: string
  year?: number
  season?: string
  status?: string
  sort: string
  minPopularity?: number
}

export const fetchCatalog = (p: CatalogParams, page: number): Promise<{ items: AniCardMedia[]; hasNext: boolean }> =>
  guard(() => catalogAniList(p, page), () => catalogFromMal(p, page))
async function catalogAniList(p: CatalogParams, page: number): Promise<{ items: AniCardMedia[]; hasNext: boolean }> {
  const query = /* GraphQL */ `
    query ($page: Int, $search: String, $genre: String, $format: MediaFormat, $year: Int, $season: MediaSeason, $status: MediaStatus, $sort: [MediaSort], $pop: Int) {
      Page(page: $page, perPage: 24) {
        pageInfo { hasNextPage }
        media(type: ANIME, isAdult: false, search: $search, genre: $genre, format: $format, seasonYear: $year, season: $season, status: $status, sort: $sort, popularity_greater: $pop) { ...CardFields }
      }
    }
    ${CARD_FIELDS}
  `
  const variables: Record<string, unknown> = { page, sort: [p.sort] }
  if (p.search) {
    variables.search = p.search
    variables.sort = ['SEARCH_MATCH', p.sort]
  }
  if (p.genre) variables.genre = p.genre
  if (p.format) variables.format = p.format
  if (p.year) variables.year = p.year
  if (p.season) variables.season = p.season
  if (p.status) variables.status = p.status
  if (p.minPopularity) variables.pop = p.minPopularity
  const data = await gql<{ Page: { pageInfo: { hasNextPage: boolean }; media: AniCardMedia[] } }>(query, variables)
  return { items: data.Page.media, hasNext: data.Page.pageInfo.hasNextPage }
}

/* ---------- Schedule ---------- */
export const fetchAiring = (from: number, to: number): Promise<AniAiringEntry[]> =>
  airingAniList(from, to).catch((err) => {
    if (!(err instanceof AniListDownError)) throw err
    markAniListDown()
    throw new Error('AniList is down, and the schedule needs it. Try again in a minute.')
  })
async function airingAniList(from: number, to: number): Promise<AniAiringEntry[]> {
  const query = /* GraphQL */ `
    query ($page: Int, $from: Int, $to: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
          id airingAt episode
          media {
            id idMal title { romaji english native } coverImage { extraLarge large color }
            genres averageScore episodes format status seasonYear isAdult countryOfOrigin popularity
          }
        }
      }
    }
  `
  type Res = { Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: AniAiringEntry[] } }
  const out: AniAiringEntry[] = []
  for (let page = 1; page <= 4; page++) {
    const data = await gql<Res>(query, { page, from, to })
    out.push(...data.Page.airingSchedules)
    if (!data.Page.pageInfo.hasNextPage) break
  }
  return out.filter((e) => !e.media.isAdult)
}

/* ---------- Light details for the player page ---------- */
const LITE_QUERY = /* GraphQL */ `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ...MediaFields
      streamingEpisodes { title thumbnail }
      relations {
        edges {
          relationType(version: 2)
          node { id type format title { romaji english native } }
        }
      }
    }
  }
  ${MEDIA_FIELDS}
`
export interface AniLite extends AniMedia {
  streamingEpisodes: AniStreamingEpisode[]
  relations: { edges: { relationType: string; node: { id: number; type: string; format: string | null; title: AniMedia['title'] } }[] }
}

export const fetchAnimeLite = (id: number): Promise<AniLite> =>
  guard(
    async () => (await gql<{ Media: AniLite }>(LITE_QUERY, { id })).Media,
    () => fetchAnimeFallback(id, false) as Promise<AniLite>,
  )

/* ---------- Watch order (franchise walk through PREQUEL / SEQUEL / SIDE_STORY / SPIN_OFF / PARENT) ---------- */
interface OrderNode {
  id: number
  type: string
  title: AniMedia['title']
  format: string | null
  status: string | null
  episodes: number | null
  seasonYear: number | null
  averageScore: number | null
  startDate: { year: number | null; month: number | null; day: number | null }
  coverImage: { large: string | null; color: string | null }
  relations: { edges: { relationType: string; node: { id: number; type: string } }[] }
}

const FOLLOW = new Set(['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF'])
const EXTRA_FORMATS = new Set(['SPECIAL', 'OVA', 'MUSIC', 'TV_SHORT'])

export async function fetchWatchOrder(rootId: number): Promise<WatchOrderEntry[]> {
  const query = /* GraphQL */ `
    query ($ids: [Int]) {
      Page(perPage: 50) {
        media(id_in: $ids, type: ANIME) {
          id type title { romaji english native } format status episodes seasonYear averageScore
          startDate { year month day } coverImage { large color }
          relations { edges { relationType(version: 2) node { id type } } }
        }
      }
    }
  `
  const nodes = new Map<number, OrderNode>()
  const meta = new Map<number, { side: boolean; relation: string }>([[rootId, { side: false, relation: 'This anime' }]])
  let frontier = [rootId]

  for (let depth = 0; depth < 7 && frontier.length && nodes.size < 40; depth++) {
    const data = await gql<{ Page: { media: OrderNode[] } }>(query, { ids: frontier })
    const next: number[] = []
    for (const n of data.Page.media) {
      nodes.set(n.id, n)
      const here = meta.get(n.id)!
      for (const e of n.relations.edges) {
        if (!FOLLOW.has(e.relationType) || e.node.type !== 'ANIME' || meta.has(e.node.id)) continue
        const side = here.side || e.relationType === 'SIDE_STORY' || e.relationType === 'SPIN_OFF'
        meta.set(e.node.id, { side, relation: e.relationType })
        next.push(e.node.id)
      }
    }
    frontier = next
  }

  const stamp = (n: OrderNode) => (n.startDate.year ?? n.seasonYear ?? 9999) * 10000 + (n.startDate.month ?? 12) * 100 + (n.startDate.day ?? 28)
  return [...nodes.values()]
    .sort((a, b) => stamp(a) - stamp(b))
    .map((n) => {
      const m = meta.get(n.id)!
      return {
        id: n.id,
        title: n.title,
        image: n.coverImage.large,
        color: n.coverImage.color,
        format: n.format,
        status: n.status,
        episodes: n.episodes,
        year: n.startDate.year ?? n.seasonYear,
        score: n.averageScore,
        main: !m.side && !EXTRA_FORMATS.has(n.format ?? ''),
        relation: m.relation,
      }
    })
}
