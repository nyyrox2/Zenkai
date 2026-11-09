import type { AniMedia, AniMediaDetails } from '../types/anime'

export const CUSTOM_SHOWS: AniMediaDetails[] = [
  {
    id: 900001,
    idMal: null,
    title: {
      romaji: 'Oggy and the Cockroaches',
      english: 'Oggy and the Cockroaches',
      native: 'Oggy et les Cafards',
    },
    coverImage: {
      extraLarge: 'https://image.tmdb.org/t/p/w500/aFAN9aKm0OblOr30ROejJCV8rGf.jpg',
      large: 'https://image.tmdb.org/t/p/w500/aFAN9aKm0OblOr30ROejJCV8rGf.jpg',
      color: '#3b82f6',
    },
    bannerImage: 'https://image.tmdb.org/t/p/w1280/fVO7r9tAnauny8DAqbetlQ1tVtu.jpg',
    description:
      'Oggy, an anthropomorphic cat, would prefer to spend his days watching television and eating, but is continually pestered by three mischievous cockroaches: Joey, Marky, and Dee Dee.',
    genres: ['Comedy', 'Action', 'Animation'],
    averageScore: 82,
    meanScore: 82,
    popularity: 95000,
    episodes: 39,
    duration: 21,
    format: 'TV',
    status: 'FINISHED',
    season: 'FALL',
    seasonYear: 1999,
    favourites: 4500,
    source: 'ORIGINAL',
    countryOfOrigin: 'FR',
    siteUrl: 'https://animesalt.cx/series/oggy-and-the-cockroaches/',
    startDate: { year: 1999, month: 9, day: 6 },
    endDate: { year: 2019, month: 1, day: 30 },
    synonyms: ['Oggy and the Cockroaches', 'Oggy', 'Oggy et les Cafards', 'Oggy Show'],
    trailer: null,
    nextAiringEpisode: null,
    studios: { edges: [{ isMain: true, node: { id: 1, name: 'Xilam Animation / Gaumont' } }] },
    tags: [
      { name: 'Slapstick', rank: 95, isMediaSpoiler: false },
      { name: 'Cats', rank: 90, isMediaSpoiler: false },
      { name: 'Classic Cartoon', rank: 85, isMediaSpoiler: false },
    ],
    rankings: [],
    characters: { edges: [] },
    staff: { edges: [] },
    relations: {
      edges: [
        {
          relationType: 'SIDE_STORY',
          node: {
            id: 900002,
            type: 'ANIME',
            title: {
              romaji: 'Oggy and the Cockroaches: The Movie',
              english: 'Oggy and the Cockroaches: The Movie',
              native: 'Oggy et les Cafards, le film',
            },
            coverImage: {
              large: 'https://image.tmdb.org/t/p/w500/dKUMAflFNp7sWGPjOSqw16J0X72.jpg',
              color: '#ef4444',
            },
            format: 'MOVIE',
            status: 'FINISHED',
            averageScore: 78,
            seasonYear: 2013,
            episodes: 1,
          },
        },
      ],
    },
    recommendations: { nodes: [] },
    externalLinks: [
      { site: 'AnimeSalt', url: 'https://animesalt.cx/series/oggy-and-the-cockroaches/' },
    ],
    streamingEpisodes: Array.from({ length: 39 }, (_, i) => ({
      title: `Episode ${i + 1}`,
      thumbnail: 'https://image.tmdb.org/t/p/w500/fVO7r9tAnauny8DAqbetlQ1tVtu.jpg',
    })),
    stats: {
      scoreDistribution: [],
      statusDistribution: [],
    },
  },
  {
    id: 900002,
    idMal: null,
    title: {
      romaji: 'Oggy and the Cockroaches: The Movie',
      english: 'Oggy and the Cockroaches: The Movie',
      native: 'Oggy et les Cafards, le film',
    },
    coverImage: {
      extraLarge: 'https://image.tmdb.org/t/p/w500/dKUMAflFNp7sWGPjOSqw16J0X72.jpg',
      large: 'https://image.tmdb.org/t/p/w500/dKUMAflFNp7sWGPjOSqw16J0X72.jpg',
      color: '#ef4444',
    },
    bannerImage: 'https://image.tmdb.org/t/p/w1280/nVRLa3jrEZG24qMkv4VBMdNckt6.jpg',
    description:
      'Ever since the world was born, two forces have been locked in perpetual battle. Their struggle is so titanic that they were bound to meet across all time and space: Oggy, the good-natured cat, and the terrible cockroaches!',
    genres: ['Comedy', 'Adventure', 'Animation'],
    averageScore: 78,
    meanScore: 78,
    popularity: 65000,
    episodes: 1,
    duration: 80,
    format: 'MOVIE',
    status: 'FINISHED',
    season: 'SUMMER',
    seasonYear: 2013,
    favourites: 2200,
    source: 'ORIGINAL',
    countryOfOrigin: 'FR',
    siteUrl: 'https://animesalt.cx/movies/oggy-and-the-cockroaches-the-movie/',
    startDate: { year: 2013, month: 8, day: 7 },
    endDate: { year: 2013, month: 8, day: 7 },
    synonyms: ['Oggy Movie', 'Oggy and the Cockroaches The Movie', 'Oggy and the Cockroaches Movie'],
    trailer: null,
    nextAiringEpisode: null,
    studios: { edges: [{ isMain: true, node: { id: 1, name: 'Xilam Animation' } }] },
    tags: [
      { name: 'Slapstick', rank: 95, isMediaSpoiler: false },
      { name: 'Cats', rank: 90, isMediaSpoiler: false },
      { name: 'Movie', rank: 90, isMediaSpoiler: false },
    ],
    rankings: [],
    characters: { edges: [] },
    staff: { edges: [] },
    relations: {
      edges: [
        {
          relationType: 'PARENT',
          node: {
            id: 900001,
            type: 'ANIME',
            title: {
              romaji: 'Oggy and the Cockroaches',
              english: 'Oggy and the Cockroaches',
              native: 'Oggy et les Cafards',
            },
            coverImage: {
              large: 'https://image.tmdb.org/t/p/w500/aFAN9aKm0OblOr30ROejJCV8rGf.jpg',
              color: '#3b82f6',
            },
            format: 'TV',
            status: 'FINISHED',
            averageScore: 82,
            seasonYear: 1999,
            episodes: 39,
          },
        },
      ],
    },
    recommendations: { nodes: [] },
    externalLinks: [
      { site: 'AnimeSalt', url: 'https://animesalt.cx/movies/oggy-and-the-cockroaches-the-movie/' },
    ],
    streamingEpisodes: [
      {
        title: 'Oggy and the Cockroaches: The Movie',
        thumbnail: 'https://image.tmdb.org/t/p/w500/nVRLa3jrEZG24qMkv4VBMdNckt6.jpg',
      },
    ],
    stats: {
      scoreDistribution: [],
      statusDistribution: [],
    },
  },
]

export function getCustomShowById(id: number | string): AniMediaDetails | null {
  const numId = Number(id)
  return CUSTOM_SHOWS.find((show) => show.id === numId) || null
}

export function searchCustomShows(search: string): AniMedia[] {
  if (!search) return []
  const clean = search.trim().toLowerCase()
  if (!clean) return []

  const tokens = clean.split(/\s+/).filter(Boolean)
  return CUSTOM_SHOWS.filter((show) => {
    const titles = [
      show.title.english || '',
      show.title.romaji || '',
      show.title.native || '',
      ...(show.synonyms || []),
    ].map((t) => t.toLowerCase())

    // If query matches any token
    return tokens.some((token) => titles.some((t) => t.includes(token)))
  })
}
