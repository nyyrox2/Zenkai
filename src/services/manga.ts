/** Manga API client — /api/manga/* (Zenkai manga worker) plus AniList for rich metadata and a fallback shelf. */
import { apiUrl, failMsg } from './api'
import { DEFAULT_MANGA_SOURCE, MANGA_SOURCES, mangaSourceInfo, type MangaSourceId } from '../lib/mangaModels'

/** What the title is: Japanese manga, Korean manhwa (webtoons) or Chinese manhua. */
export type MangaKind = 'Manga' | 'Manhwa' | 'Manhua'
export const MANGA_KINDS: readonly MangaKind[] = ['Manga', 'Manhwa', 'Manhua']
/** The home page's server picker also has "All": every server at once. */
export type MangaScope = MangaSourceId | 'all'

export interface MangaItem {
  id: string
  title: string
  poster: string
  type?: string | null
  status?: string | null
  latest?: string | null
  score?: number | null
  chapters?: number | null
  updated?: string | null
  /** which server this title lives on */
  source: MangaSourceId
  /** Manga / Manhwa / Manhua, when the server said so (or the server only carries one kind) */
  kind?: MangaKind | null
}
export interface MangaHome {
  trending: MangaItem[]
  latest: MangaItem[]
  newRelease: MangaItem[]
  /** true when the worker returned nothing and AniList trending is shown instead */
  fallback: boolean
}
export interface MangaChapterRef {
  chapterId: string
  number: string
  title: string | null
  date?: string | null
  group?: string | null
  volume?: string | null
}
export interface MangaMeta {
  title: string
  nativeTitle: string | null
  cover: string | null
  banner: string | null
  color: string | null
  description: string
  genres: string[]
  score: number | null
  status: string | null
  format: string | null
  chapters: number | null
  volumes: number | null
  year: number | null
  authors: string[]
}

async function get<T>(path: string, timeout = 25000): Promise<T> {
  const ctl = new AbortController()
  const t = window.setTimeout(() => ctl.abort(), timeout)
  try {
    const res = await fetch(apiUrl(path), { signal: ctl.signal })
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (!res.ok || !data) throw new Error(failMsg(res, data))
    return data
  } finally {
    window.clearTimeout(t)
  }
}

const memo = new Map<string, Promise<unknown>>()
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key)
  if (hit) return hit as Promise<T>
  const p = fn().catch((e) => {
    memo.delete(key)
    throw e
  })
  memo.set(key, p)
  return p
}

/* ---------------- AniList ---------------- */
interface AniManga {
  id: number
  title: { romaji: string | null; english: string | null; native: string | null }
  coverImage: { extraLarge: string | null; large: string | null; color: string | null }
  bannerImage?: string | null
  description?: string | null
  genres?: string[]
  averageScore: number | null
  status?: string | null
  format?: string | null
  countryOfOrigin?: string | null
  chapters?: number | null
  volumes?: number | null
  startDate?: { year: number | null }
  staff?: { edges: { role: string | null; node: { name: { full: string } } }[] }
}

async function anilist<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null
  if (!res.ok || !json?.data) throw new Error(json?.errors?.[0]?.message ?? `AniList request failed (${res.status})`)
  return json.data
}

const plain = (s?: string | null) =>
  (s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/**
 * Manga / Manhwa / Manhua from whatever the server gave us (a type or format string, or an origin country), then from
 * the server itself when it only carries one kind. Unknown stays null rather than guessing.
 */
export function mangaKind(type: string | null | undefined, source?: MangaSourceId, country?: string | null): MangaKind | null {
  const t = (type ?? '').toLowerCase()
  if (/manhwa|webtoon|korea/.test(t)) return 'Manhwa'
  if (/manhua|donghua|chinese|china/.test(t)) return 'Manhua'
  if (/manga|one[ _-]?shot|doujin|japan/.test(t)) return 'Manga'
  const c = (country ?? '').toUpperCase()
  if (c === 'KR') return 'Manhwa'
  if (c === 'CN' || c === 'TW' || c === 'HK') return 'Manhua'
  if (c === 'JP') return 'Manga'
  if (source === 'manhua') return 'Manhua'
  if (source === 'asura' || source === 'demonicscans') return 'Manhwa'
  if (source === 'weebcentral') return 'Manga'
  return null
}

const titleOf = (t: AniManga['title']) => t.english || t.romaji || t.native || 'Untitled'

/** AniList trending manga — only used when the manga worker has nothing to show. */
async function anilistTrending(source: MangaSourceId): Promise<MangaItem[]> {
  const d = await anilist<{ Page: { media: AniManga[] } }>(
    `query { Page(perPage: 24) { media(type: MANGA, sort: TRENDING_DESC, isAdult: false) {
      id title { romaji english native } coverImage { extraLarge large color } averageScore format status chapters countryOfOrigin } } }`,
    {},
  )
  return d.Page.media.map((m) => ({
    id: `al-${m.id}`,
    title: titleOf(m.title),
    poster: m.coverImage.extraLarge || m.coverImage.large || '',
    type: m.format ? m.format.replace(/_/g, ' ') : null,
    status: m.status,
    score: m.averageScore ? m.averageScore / 10 : null,
    chapters: m.chapters ?? null,
    source,
    kind: mangaKind(m.format, undefined, m.countryOfOrigin),
  }))
}

export function fetchMangaMeta(title: string): Promise<MangaMeta | null> {
  return once(`meta:${title.toLowerCase()}`, async () => {
    try {
      const d = await anilist<{ Media: AniManga | null }>(
        `query ($s: String) { Media(search: $s, type: MANGA, sort: SEARCH_MATCH) {
          id title { romaji english native } coverImage { extraLarge large color } bannerImage description(asHtml: false)
          genres averageScore status format chapters volumes startDate { year }
          staff(perPage: 4, sort: RELEVANCE) { edges { role node { name { full } } } } } }`,
        { s: title },
      )
      const m = d.Media
      if (!m) return null
      return {
        title: titleOf(m.title),
        nativeTitle: m.title.native,
        cover: m.coverImage.extraLarge || m.coverImage.large,
        banner: m.bannerImage ?? null,
        color: m.coverImage.color,
        description: plain(m.description),
        genres: m.genres ?? [],
        score: m.averageScore ? m.averageScore / 10 : null,
        status: m.status ? m.status.replace(/_/g, ' ') : null,
        format: m.format ? m.format.replace(/_/g, ' ') : null,
        chapters: m.chapters ?? null,
        volumes: m.volumes ?? null,
        year: m.startDate?.year ?? null,
        authors: (m.staff?.edges ?? []).map((e) => e.node.name.full),
      }
    } catch {
      return null // metadata is a bonus; the worker still gives us chapters
    }
  })
}

/** A manga as AniList knows it, with every name it goes by: the way into "search all servers". */
export interface AniMangaHit {
  id: number
  /** main title (English, else romaji) */
  title: string
  /** every other name worth trying on a server: romaji, synonyms, native last */
  alt: string[]
  cover: string
  score: number | null
  kind: MangaKind | null
  year: number | null
  status: string | null
  chapters: number | null
}

const aniHit = (m: AniManga & { synonyms?: string[] }): AniMangaHit => {
  const title = titleOf(m.title)
  const latin = (m.synonyms ?? []).filter((x) => /[a-z]/i.test(x))
  const names = [m.title.romaji, m.title.english, ...latin, m.title.native].filter((x): x is string => !!x && x !== title)
  return {
    id: m.id,
    title,
    alt: [...new Set(names)].slice(0, 6),
    cover: m.coverImage.extraLarge || m.coverImage.large || '',
    score: m.averageScore ? m.averageScore / 10 : null,
    kind: mangaKind(m.format, undefined, m.countryOfOrigin),
    year: m.startDate?.year ?? null,
    status: m.status ? m.status.replace(/_/g, ' ') : null,
    chapters: m.chapters ?? null,
  }
}

export function searchAniListManga(term: string): Promise<AniMangaHit[]> {
  const t = term.trim()
  if (t.length < 2) return Promise.resolve([])
  return once(`ani-search:${t.toLowerCase()}`, async () => {
    try {
      const d = await anilist<{ Page: { media: (AniManga & { synonyms?: string[] })[] } }>(
        `query ($s: String) { Page(perPage: 16) { media(search: $s, type: MANGA, sort: SEARCH_MATCH, isAdult: false) {
          id title { romaji english native } synonyms coverImage { extraLarge large color } averageScore format status chapters countryOfOrigin startDate { year } } } }`,
        { s: t },
      )
      return d.Page.media.map(aniHit)
    } catch {
      return [] // AniList being down must never break plain server search
    }
  })
}

/* ---------------- browse (AniList catalogue) ---------------- */
export interface MangaCatalogParams {
  search?: string
  kind?: MangaKind
  genre?: string
  tag?: string
  format?: string
  year?: number
  status?: string
  sort: string
  minPopularity?: number
}
const KIND_COUNTRY: Record<MangaKind, string> = { Manga: 'JP', Manhwa: 'KR', Manhua: 'CN' }

export async function fetchMangaCatalog(p: MangaCatalogParams, page: number): Promise<{ items: AniMangaHit[]; hasNext: boolean }> {
  const d = await anilist<{ Page: { pageInfo: { hasNextPage: boolean }; media: (AniManga & { synonyms?: string[] })[] } }>(
    `query ($page: Int, $search: String, $genre: String, $tag: String, $formats: [MediaFormat], $country: CountryCode, $status: MediaStatus, $from: FuzzyDateInt, $to: FuzzyDateInt, $sort: [MediaSort], $pop: Int) {
      Page(page: $page, perPage: 24) {
        pageInfo { hasNextPage }
        media(type: MANGA, isAdult: false, search: $search, genre: $genre, tag: $tag, format_in: $formats, countryOfOrigin: $country, status: $status,
              startDate_greater: $from, startDate_lesser: $to, sort: $sort, popularity_greater: $pop) {
          id title { romaji english native } synonyms coverImage { extraLarge large color } averageScore format status chapters countryOfOrigin startDate { year } } } }`,
    {
      page,
      search: p.search || undefined,
      genre: p.genre || undefined,
      tag: p.tag || undefined,
      formats: p.format ? [p.format] : ['MANGA', 'ONE_SHOT'], // light novels live in the Novels section
      country: p.kind ? KIND_COUNTRY[p.kind] : undefined,
      status: p.status || undefined,
      from: p.year ? p.year * 10000 : undefined,
      to: p.year ? p.year * 10000 + 1232 : undefined,
      sort: p.search ? ['SEARCH_MATCH', p.sort] : [p.sort],
      pop: p.minPopularity || undefined,
    },
  )
  return { items: d.Page.media.map(aniHit), hasNext: d.Page.pageInfo.hasNextPage }
}

/** Link to the page that looks one AniList title up on every server by all of its names. */
export const findOnServersHref = (m: Pick<AniMangaHit, 'title' | 'alt' | 'cover'>) => `/manga/find?${new URLSearchParams({ title: m.title, alt: m.alt.join('|'), cover: m.cover })}`

/* ---------------- servers ---------------- */
const withSource = (path: string, source: MangaSourceId) => `${path}${path.includes('?') ? '&' : '?'}source=${source}`
const tag = (items: MangaItem[] | undefined, source: MangaSourceId): MangaItem[] =>
  (items ?? []).map((i) => {
    const src = i.source ?? source
    return { ...i, source: src, kind: i.kind ?? mangaKind(i.type, src) }
  })

type Shelves = Omit<MangaHome, 'fallback'>
const EMPTY: Shelves = { trending: [], latest: [], newRelease: [] }

/** One server's shelves exactly as the worker gave them (no AniList fallback). */
async function rawHome(source: MangaSourceId): Promise<Shelves> {
  try {
    const d = await get<Shelves>(withSource('/api/manga/home', source))
    return { trending: tag(d.trending, source), latest: tag(d.latest, source), newRelease: tag(d.newRelease, source) }
  } catch {
    return EMPTY
  }
}

const normTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Round-robin across servers so no single one fills the shelf, dropping titles another server already supplied. */
function interleave(lists: MangaItem[][], max = 30): MangaItem[] {
  const seen = new Set<string>()
  const out: MangaItem[] = []
  for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const m = l[i]
      const key = m && normTitle(m.title)
      if (m && key && !seen.has(key)) {
        seen.add(key)
        out.push(m)
      }
    }
  }
  return out
}

export function fetchMangaHome(source: MangaScope = DEFAULT_MANGA_SOURCE): Promise<MangaHome> {
  return once(`home:${source}`, async () => {
    const homes = source === 'all' ? await Promise.all(MANGA_SOURCES.map((s) => rawHome(s.id))) : [await rawHome(source)]
    const d: Shelves = {
      trending: interleave(homes.map((h) => h.trending)),
      latest: interleave(homes.map((h) => h.latest)),
      newRelease: interleave(homes.map((h) => h.newRelease)),
    }
    if (!d.trending.length && !d.latest.length && !d.newRelease.length) {
      const trending = await anilistTrending(source === 'all' ? DEFAULT_MANGA_SOURCE : source)
      return { trending, latest: [], newRelease: [], fallback: true }
    }
    return { ...d, fallback: false }
  })
}

export async function searchManga(term: string, source: MangaScope = DEFAULT_MANGA_SOURCE): Promise<MangaItem[]> {
  if (source === 'all') return searchMangaEverywhere(term)
  const d = await get<{ results: MangaItem[] }>(withSource(`/api/manga/search?q=${encodeURIComponent(term)}`, source))
  return tag(d.results, source)
}

/** Universal search: every server at once, merged best-match first. A server that is down is simply skipped. */
export async function searchMangaEverywhere(term: string): Promise<MangaItem[]> {
  const lists = await Promise.all(MANGA_SOURCES.map((s) => searchManga(term, s.id).catch(() => [] as MangaItem[])))
  const q = normTitle(term)
  const rank = (m: MangaItem) => (normTitle(m.title) === q ? 0 : normTitle(m.title).startsWith(q) ? 1 : 2)
  return interleave(lists, 60)
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i)
    .map((x) => x.m)
}

export function fetchMangaChapters(id: string, source: MangaSourceId = DEFAULT_MANGA_SOURCE): Promise<MangaChapterRef[]> {
  return once(`chapters:${source}:${id}`, async () => {
    const d = await get<{ chapters: MangaChapterRef[] }>(withSource(`/api/manga/chapters?id=${encodeURIComponent(id)}`, source), 40000)
    return d.chapters ?? []
  })
}

export async function fetchMangaPages(chapterId: string, source: MangaSourceId = DEFAULT_MANGA_SOURCE): Promise<string[]> {
  const d = await get<{ pages: string[] }>(withSource(`/api/manga/pages?chapterId=${encodeURIComponent(chapterId)}`, source), 40000)
  if (!d.pages?.length) throw new Error('No pages came back for this chapter.')
  return d.pages
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Best match for a title in a list of search hits: exact title first, then the top result. */
export const bestMatch = (hits: MangaItem[], title: string): MangaItem | undefined => hits.find((h) => norm(h.title) === norm(title)) ?? hits[0]

/** AniList-fallback shelf items (`al-123`) have no server id yet: find the real one by title. */
export async function resolveWorkerId(id: string, title: string, source: MangaSourceId = DEFAULT_MANGA_SOURCE): Promise<string | null> {
  if (!id.startsWith('al-')) return id
  const hits = await searchManga(title, source).catch(() => [])
  return bestMatch(hits, title)?.id ?? null
}

/** Page images: straight from the CDN first; the Referer-spoofing proxy is the retry (it sends the server's own site as the referer). */
export const proxiedImage = (url: string, source: MangaSourceId = DEFAULT_MANGA_SOURCE) =>
  apiUrl(`/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(`${mangaSourceInfo(source).baseUrl}/`)}`)
