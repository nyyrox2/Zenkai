/**
 * Manga data models for the web, ported 1:1 from the Android app's `MangaModels.kt`
 * (com.nyyrox.aniverse.data.manga). Field names and meanings match the Kotlin classes so the same
 * JSON, ids and saved items can move between the app and the site.
 */

/* ---------------- MangaSource ---------------- */
export type MangaSourceId = 'weebcentral' | 'demonicscans' | 'comick' | 'manhua' | 'asura' | 'mangadex'

export interface MangaSourceInfo {
  id: MangaSourceId
  displayName: string
  baseUrl: string
  badge: string | null
}

/** Same order as the Kotlin enum, which is the order of the server tabs in the app. */
export const MANGA_SOURCES: readonly MangaSourceInfo[] = [
  { id: 'weebcentral', displayName: 'WeebCentral', baseUrl: 'https://weebcentral.com', badge: 'Classic' },
  { id: 'demonicscans', displayName: 'Demonic Scans', baseUrl: 'https://demonicscans.org', badge: 'Action / Manhwa' },
  { id: 'comick', displayName: 'ComicK', baseUrl: 'https://comick.art', badge: 'Manhwa & Manga' },
  { id: 'manhua', displayName: 'Manhua', baseUrl: 'https://comick.art', badge: 'Cultivation & Action' },
  { id: 'asura', displayName: 'Asura Scans', baseUrl: 'https://asuracomic.net', badge: 'Action / Regression' },
  { id: 'mangadex', displayName: 'MangaDex', baseUrl: 'https://mangadex.org', badge: 'Multilingual' },
]

/**
 * `MangaSource.fromId`: blank is WeebCentral, "mh" is Manhua, "ds" is Demonic Scans, matching is case-insensitive.
 */
export function mangaSourceFromId(id?: string | null): MangaSourceInfo {
  if (!id || !id.trim()) return MANGA_SOURCES[0]
  const s = id.toLowerCase().trim()
  if (s === 'wc' || s === 'weeb' || s === 'webtoon') return MANGA_SOURCES[0]
  if (s === 'ds' || s === 'demonic' || s === 'demonicscans') return MANGA_SOURCES[1]
  if (s === 'mh') return MANGA_SOURCES.find((x) => x.id === 'manhua') ?? MANGA_SOURCES[0]
  return MANGA_SOURCES.find((x) => x.id === s) ?? MANGA_SOURCES[0]
}

/**
 * What the website opens on when a link carries no `?source=`. WeebCentral is the server the site has always
 * used, so existing links, saved reading progress and bookmarks keep working untouched.
 */
export const DEFAULT_MANGA_SOURCE: MangaSourceId = 'weebcentral'

export const isMangaSource = (s?: string | null): s is MangaSourceId => !!s && MANGA_SOURCES.some((x) => x.id === s)

/** Like `mangaSourceFromId`, but an absent or unknown value means the site default rather than ComicK. */
export function resolveMangaSource(s?: string | null): MangaSourceId {
  if (!s) return DEFAULT_MANGA_SOURCE
  const id = s.toLowerCase().trim()
  if (id === 'mh') return 'manhua'
  if (id === 'ds' || id === 'demonic' || id === 'demonicscans') return 'demonicscans'
  if (id === 'wc' || id === 'weeb' || id === 'webtoon') return 'weebcentral'
  return isMangaSource(id) ? id : DEFAULT_MANGA_SOURCE
}

export const mangaSourceInfo = (id: MangaSourceId): MangaSourceInfo => MANGA_SOURCES.find((s) => s.id === id) ?? MANGA_SOURCES[0]

/** Query params that carry the server in a link. The default server is left out so old URLs stay valid. */
export const sourceParams = (source: MangaSourceId): Record<string, string> => (source === DEFAULT_MANGA_SOURCE ? {} : { source })

/** Key used by the "continue reading" shelf. The default server keeps the bare id, so nothing saved earlier is lost. */
export const readingKey = (source: MangaSourceId, id: string) => (source === DEFAULT_MANGA_SOURCE ? id : `${source}:${id}`)

/** Link to a manga's details page on a specific server. */
export const mangaHref = (m: { id: string; title: string; poster?: string | null; source: MangaSourceId }) =>
  `/manga/${encodeURIComponent(m.id)}?${new URLSearchParams({ title: m.title, cover: m.poster ?? '', ...sourceParams(m.source) })}`

/* ---------------- data classes ---------------- */
export interface MangaCard {
  id: string
  title: string
  poster?: string | null
  /** default "Manga" */
  type?: string | null
  chapter?: string | null
  updated?: string | null
  source: MangaSourceId
}

export interface MangaInfo {
  id: string
  title: string
  altTitle?: string | null
  poster?: string | null
  description: string
  type?: string | null
  status?: string | null
  rating?: string | null
  genres: string[]
  source: MangaSourceId
  banner?: string | null
  anilistId?: number | null
  totalChapters?: number | null
  authors: string[]
}

export interface MangaChapter {
  number: string
  title?: string | null
  chapterId: string
  releaseDate?: string | null
  url: string
  group?: string | null
  volume?: string | null
  source: MangaSourceId
}

export interface MangaHome {
  trending: MangaCard[]
  latest: MangaCard[]
  newRelease: MangaCard[]
}

/* ---------------- bookmarks & history ---------------- */
export type MangaBookmarkType = 'SERIES' | 'CHAPTER' | 'PAGE'

export interface MangaBookmarkItem {
  mangaId: string
  title: string
  poster?: string | null
  type?: string | null
  /** default "SERIES" */
  bookmarkType: MangaBookmarkType
  chapterId?: string | null
  chapterNumber?: string | null
  pageIndex: number
  pageCount: number
  latestChapter?: string | null
  /** epoch ms */
  updatedAt: number
}

export interface MangaHistoryItem {
  mangaId: string
  title: string
  poster?: string | null
  type?: string | null
  chapterId: string
  chapterNumber: string
  chapterTitle?: string | null
  pageIndex: number
  pageCount: number
  updatedAt: number
}

/* ---------------- reader mode ---------------- */
export const MangaReaderMode = {
  VERTICAL_WEBTOON: 'VERTICAL_WEBTOON',
  HORIZONTAL_RTL: 'HORIZONTAL_RTL',
  HORIZONTAL_LTR: 'HORIZONTAL_LTR',
  HORIZONTAL_PAGED: 'HORIZONTAL_PAGED',
} as const
export type MangaReaderMode = (typeof MangaReaderMode)[keyof typeof MangaReaderMode]

export const readerModeIsPaged = (m: MangaReaderMode) => m === 'HORIZONTAL_RTL' || m === 'HORIZONTAL_LTR' || m === 'HORIZONTAL_PAGED'
export const readerModeIsRtl = (m: MangaReaderMode) => m === 'HORIZONTAL_RTL' || m === 'HORIZONTAL_PAGED'

/** The website's reader stores its mode as 'webtoon' | 'ltr' | 'rtl'. These map it to and from the app's enum. */
export type ReaderPref = 'webtoon' | 'ltr' | 'rtl'
export const readerModeFromPref = (p: ReaderPref): MangaReaderMode => (p === 'rtl' ? 'HORIZONTAL_RTL' : p === 'ltr' ? 'HORIZONTAL_LTR' : 'VERTICAL_WEBTOON')
export const readerModeToPref = (m: MangaReaderMode): ReaderPref => (m === 'VERTICAL_WEBTOON' ? 'webtoon' : readerModeIsRtl(m) ? 'rtl' : 'ltr')
