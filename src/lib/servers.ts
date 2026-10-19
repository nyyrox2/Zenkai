export interface EmbedCtx {
  anilistId: number
  malId: number | null
  tmdb: { id: number; type: 'tv' | 'movie'; season: number | null } | null
  episode: number
  audio: 'sub' | 'dub'
  isMovie: boolean
}

export interface ServerDef {
  id: string
  name: string
  note: string
  /** direct = our HLS player, embed = iframe, animesalt = iframe resolved by the API (multi audio) */
  kind: 'direct' | 'embed' | 'animesalt'
  /** audio can be switched sub/dub for this server */
  audio: boolean
  /** one stream carrying several audio tracks, picked inside the player (shows the "Multi audio" tag) */
  multi?: boolean
  salt?: '1' | '2'
  /** iframe url, or null when the ids this server needs aren't known */
  url?: (c: EmbedCtx) => string | null
}

const tv = (c: EmbedCtx, movie: (id: number) => string, show: (id: number, s: number) => string) => {
  if (!c.tmdb) return null
  return c.isMovie || c.tmdb.type === 'movie' ? movie(c.tmdb.id) : show(c.tmdb.id, c.tmdb.season ?? 1)
}

export const SERVERS: ServerDef[] = [
  { id: 'megaplay', name: 'MegaPlay', note: 'Direct HLS · Sub / Dub', kind: 'direct', audio: true },
  { id: 'vidstream', name: 'Vidstream', note: 'Direct HLS · Sub / Dub', kind: 'direct', audio: true },
  { id: 'flixcloud', name: 'FlixCloud', note: 'Direct HLS · Sub / Dub', kind: 'direct', audio: true },
  { id: 'acdn', name: 'ACDN', note: 'Direct HLS · Multi audio', kind: 'direct', audio: false, multi: true },
  { id: 'animesalt-1', name: 'AnimeSalt 1', note: 'Multi audio', kind: 'animesalt', audio: false, salt: '1' },
  { id: 'animesalt-2', name: 'AnimeSalt 2', note: 'Multi audio', kind: 'animesalt', audio: false, salt: '2' },
  { id: 'reanime', name: 'ReAnime', note: 'Embed · AniList', kind: 'embed', audio: true, url: (c) => `/api/embed/reanime?id=${c.anilistId}&ep=${c.episode}&audio=${c.audio}` },
  { id: 'zokoanime', name: 'ZokoAnime', note: 'Embed · MAL', kind: 'embed', audio: true, url: (c) => (c.malId ? `https://zokoanime.video/stream/mal/${c.malId}/${c.episode}/${c.audio}?color=dc143c` : null) },
  { id: 'tryembed', name: 'TryEmbed', note: 'Embed · MAL', kind: 'embed', audio: true, url: (c) => (c.malId ? `https://tryembed.us.cc/embed/anime/mal/${c.malId}/${c.episode}/${c.audio}?skin=silicon&autoSkip=true` : null) },
  { id: 'vidnest', name: 'Vidnest', note: 'Embed · AniList', kind: 'embed', audio: true, url: (c) => `https://vidnest.fun/anime/${c.anilistId}/${c.episode}/${c.audio}` },
  { id: 'yumezone', name: 'YumeZone', note: 'Embed · AniList', kind: 'embed', audio: true, url: (c) => `https://yumezone.qzz.io/embed/megaplay/ani/${c.anilistId}/${c.episode}/${c.audio}` },
  { id: 'vidzee', name: 'VidZee', note: 'Embed · TMDB', kind: 'embed', audio: false, url: (c) => tv(c, (i) => `https://player.vidzee.wtf/embed/movie/${i}?lang=en`, (i, s) => `https://player.vidzee.wtf/embed/tv/${i}/${s}/${c.episode}?lang=en`) },
  { id: 'vidlove', name: 'VidLove', note: 'Embed · TMDB', kind: 'embed', audio: false, url: (c) => tv(c, (i) => `https://player.vidlove.cc/embed/movie/${i}`, (i, s) => `https://player.vidlove.cc/embed/tv/${i}/${s}/${c.episode}`) },
  { id: '1embed', name: '1Embed', note: 'Embed · TMDB', kind: 'embed', audio: false, url: (c) => tv(c, (i) => `https://1embed.cc/embed/movie/${i}`, (i, s) => `https://1embed.cc/embed/tv/${i}/${s}/${c.episode}`) },
  { id: 'cinemaos', name: 'CinemaOS', note: 'Embed · TMDB', kind: 'embed', audio: false, url: (c) => tv(c, (i) => `https://cinemaos.tech/player/${i}?lang=en`, (i, s) => `https://cinemaos.tech/player/${i}/${s}/${c.episode}?lang=en`) },
  { id: '2embed', name: '2Embed', note: 'Embed · TMDB', kind: 'embed', audio: false, url: (c) => tv(c, (i) => `https://www.2embed.stream/embed/movie/${i}`, (i, s) => `https://www.2embed.stream/embed/tv/${i}/${s}/${c.episode}`) },
]

export const serverById = (id: string) =>
  SERVERS.find((s) => s.id === id) ??
  (id === 'flixcloud-1' || id === 'flixcloud-2' ? SERVERS.find((s) => s.id === 'flixcloud') : undefined) ??
  (id === 'recloud' ? SERVERS.find((s) => s.id === 'reanime') : undefined) ??
  SERVERS[0]

/** Direct (Zenkai player) servers; all are offered for both SUB and DUB. */
export const DIRECT = SERVERS.filter((s) => s.kind === 'direct')
