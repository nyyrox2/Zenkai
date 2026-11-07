export type Section = 'anime' | 'novel' | 'manga' | 'movies'

export const SECTIONS: { id: Section; label: string; to: string; kanji: string }[] = [
  { id: 'anime', label: 'Anime', to: '/home', kanji: 'アニメ' },
  { id: 'novel', label: 'Novels', to: '/novel', kanji: '小説' },
  { id: 'manga', label: 'Manga', to: '/manga', kanji: '漫画' },
  { id: 'movies', label: 'Movies', to: '/movies', kanji: '映画' },
]

/** Which part of the site a pathname belongs to. */
export function sectionOf(pathname: string): Section {
  if (pathname.startsWith('/novel')) return 'novel'
  if (pathname.startsWith('/manga')) return 'manga'
  if (pathname.startsWith('/movies')) return 'movies'
  return 'anime'
}

/** Full-screen readers hide the site chrome. */
export const isReaderPath = (pathname: string) => /^\/(novel|manga)\/[^/]+(\/[^/]+)?\/read\//.test(pathname)

/** The anime watch page is a full-bleed player: no navbar, dock or footer. */
export const isWatchPath = (pathname: string) => /^\/watch\/\d+/.test(pathname)

/** Details pages drop the navbar and keep their own Back button. */
export const isDetailsPath = (pathname: string) =>
  /^\/(anime|mal)\/[^/]+\/?$|^\/manga\/(?!browse$|find$)[^/]+\/?$|^\/novel\/(?!find$)[^/]+\/[^/]+\/?$|^\/movies\/(movie|tv)\/[^/]+\/?$/.test(pathname)

/** Any full-screen player or reader. Details pages must never "go back" into one of these. */
export const isPlayerPath = (pathname: string) => isReaderPath(pathname) || isWatchPath(pathname) || /^\/movies\/watch\//.test(pathname)
