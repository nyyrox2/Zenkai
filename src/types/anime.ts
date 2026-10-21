/* ---------------- AniList ---------------- */
export interface AniTitle {
  romaji: string | null
  english: string | null
  native: string | null
}

export interface AniCover {
  extraLarge: string | null
  large: string | null
  color: string | null
}

export interface AniTrailer {
  id: string | null
  site: string | null
  thumbnail: string | null
}

export interface AniDate {
  year: number | null
  month: number | null
  day: number | null
}

export interface AniMedia {
  id: number
  idMal: number | null
  title: AniTitle
  coverImage: AniCover
  bannerImage: string | null
  description: string | null
  genres: string[]
  averageScore: number | null
  popularity: number | null
  episodes: number | null
  duration: number | null
  format: string | null
  status: string | null
  season: string | null
  seasonYear: number | null
  trailer: AniTrailer | null
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null
}

export interface AniPerson {
  id: number
  name: { full: string }
  image: { large: string | null }
}

export interface AniCharacterEdge {
  role: string
  node: AniPerson
  voiceActors: AniPerson[]
}

export interface AniStaffEdge {
  role: string | null
  node: AniPerson
}

export interface AniRelationEdge {
  relationType: string
  node: {
    id: number
    type: string
    title: AniTitle
    coverImage: { large: string | null; color: string | null }
    format: string | null
    status: string | null
    averageScore: number | null
    seasonYear: number | null
    episodes: number | null
  }
}

export interface AniRecommendationNode {
  mediaRecommendation: {
    id: number
    title: AniTitle
    coverImage: { large: string | null; color: string | null }
    averageScore: number | null
    format: string | null
    episodes: number | null
    seasonYear: number | null
  } | null
}

export interface AniStreamingEpisode {
  title: string | null
  thumbnail: string | null
}

export interface AniMediaDetails extends AniMedia {
  /** true when AniList was unreachable and this was rebuilt from TMDB */
  fallback?: boolean
  streamingEpisodes: AniStreamingEpisode[]
  meanScore: number | null
  favourites: number | null
  source: string | null
  countryOfOrigin: string | null
  siteUrl: string | null
  startDate: AniDate
  endDate: AniDate
  synonyms: string[]
  studios: { edges: { isMain: boolean; node: { id: number; name: string } }[] }
  tags: { name: string; rank: number; isMediaSpoiler: boolean }[]
  rankings: {
    rank: number
    type: string
    allTime: boolean | null
    year: number | null
    season: string | null
    context: string
  }[]
  characters: { edges: AniCharacterEdge[] }
  staff: { edges: AniStaffEdge[] }
  relations: { edges: AniRelationEdge[] }
  recommendations: { nodes: AniRecommendationNode[] }
  externalLinks: { site: string; url: string }[]
  stats: {
    scoreDistribution: { score: number; amount: number }[]
    statusDistribution: { status: string; amount: number }[]
  } | null
}

/** Lightweight media used by rows, grids and the schedule (no description / trailer / airing data). */
export type AniCardMedia = Pick<
  AniMedia,
  'id' | 'idMal' | 'title' | 'coverImage' | 'genres' | 'averageScore' | 'episodes' | 'format' | 'status' | 'seasonYear'
>

export interface HomeData {
  trending: AniMedia[]
  season: AniCardMedia[]
  popular: AniCardMedia[]
  top: AniCardMedia[]
  upcoming: AniCardMedia[]
}

export interface AniAiringEntry {
  id: number
  airingAt: number
  episode: number
  media: AniCardMedia & { isAdult: boolean; countryOfOrigin: string | null; popularity: number | null }
}

export interface WatchOrderEntry {
  id: number
  title: AniTitle
  image: string | null
  color: string | null
  format: string | null
  status: string | null
  episodes: number | null
  year: number | null
  score: number | null
  /** true for the main story line (TV / movies), false for side stories, OVAs, specials */
  main: boolean
  relation: string
}

/* ---------------- Jikan (MyAnimeList) ---------------- */
export interface JikanNamed {
  mal_id: number
  name: string
}

export interface JikanAnimeSummary {
  mal_id: number
  title: string
  title_english: string | null
  images: {
    webp?: { large_image_url?: string | null }
    jpg?: { large_image_url?: string | null }
  }
  score: number | null
  type: string | null
  episodes: number | null
  year: number | null
  genres: JikanNamed[]
}

export interface JikanFull {
  mal_id: number
  score: number | null
  scored_by: number | null
  rank: number | null
  popularity: number | null
  members: number | null
  favorites: number | null
  rating: string | null
  synopsis: string | null
  background: string | null
  broadcast: { string: string | null } | null
  producers: JikanNamed[]
  licensors: JikanNamed[]
  themes: JikanNamed[]
  demographics: JikanNamed[]
  theme: { openings: string[]; endings: string[] }
  streaming: { name: string; url: string }[]
}

export interface JikanStats {
  watching: number
  completed: number
  on_hold: number
  dropped: number
  plan_to_watch: number
  total: number
  scores: { score: number; votes: number; percentage: number }[]
}

/* ---------------- UI ---------------- */
export interface CardItem {
  id: number
  href: string
  title: string
  image: string
  /** larger variant used for hi-dpi screens */
  image2x?: string
  color?: string | null
  score: number | null // 0 - 100
  format?: string | null
  episodes?: number | null
  year?: number | null
  genres?: string[]
  caption?: string
}
