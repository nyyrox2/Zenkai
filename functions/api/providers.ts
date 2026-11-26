// api/providers.ts
// Server-side provider registry + URL resolver.
// Provider domains/templates live ONLY here — never shipped in the client bundle.
type SearchType  = 'tmdb' | 'anilist';
type ContentType = 'movie' | 'tv' | 'anime';

type Tag = 'Multi audio' | '4K' | 'Direct' | 'Regional';

interface ProviderDef {
  id:             string;
  label:          string;
  searchType:     SearchType;
  contentTypes:   ContentType[];
  priority:       number;
  /** badges shown next to the server name */
  tags?: Tag[];
  movieUrl?:      (id: number | string, lang?: string) => string;
  tvUrl?:         (id: number | string, s: number, e: number, lang?: string) => string;
  animeUrl?:      (id: number | string, ep: number, lang?: string) => string;
}

const PROVIDER_DEFS: ProviderDef[] = [
  // ── MovieBox (Direct stream player with multi-audio dubs) ──
  {
    id: 'moviebox', label: 'MovieBox (Direct HLS)',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 0,
    tags: ['Direct', 'Multi audio', '4K'],
    movieUrl: (id) => `/api/movies/stream?id=${id}&type=movie`,
    tvUrl:    (id, s, e) => `/api/movies/stream?id=${id}&type=tv&s=${s}&e=${e}`,
  },
  // ── Regional HLS Server (Direct stream player auto-selecting Indian & Regional dubs) ──
  {
    id: 'moviebox-regional', label: 'Regional HLS (Direct)',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 1,
    tags: ['Direct', 'Regional', 'Multi audio', '4K'],
    movieUrl: (id) => `/api/movies/stream?id=${id}&type=movie&regional=true`,
    tvUrl:    (id, s, e) => `/api/movies/stream?id=${id}&type=tv&s=${s}&e=${e}&regional=true`,
  },
  // ── Regional Servers (Indian & Pan-Asian Regional Audio Specialists) ──
  // ── Cineverse / ModiPlay (Shang-Chi: MultiMovies #1 Bollywood & South Indian server) ──
  {
    id: 'cineverse', label: 'Shang-Chi (Regional)',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 2,
    tags: ['Regional', 'Multi audio'],
    movieUrl: (id) => `https://rozgarlelo.modiplay.xyz/embed/tmdb/movie?id=${id}`,
    tvUrl:    (id, s, e) => `https://rozgarlelo.modiplay.xyz/embed/tmdb/tv?id=${id}&s=${s}&e=${e}`,
  },
  // ── Vidbolt (Quicksilver: Fast Regional & Multi-Audio server) ──
  {
    id: 'vidbolt', label: 'Quicksilver (Regional)',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 3,
    tags: ['Regional', 'Multi audio'],
    movieUrl: (id) => `https://vidbolt.xyz/movie/${id}`,
    tvUrl:    (id, s, e) => `https://vidbolt.xyz/tv/${id}/${s}/${e}`,
  },
  // ── Vidout (Daredevil: Cloudflare edge regional mirror) ──
  {
    id: 'vidout', label: 'Daredevil (Regional)',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 4,
    tags: ['Regional', 'Multi audio'],
    movieUrl: (id) => `https://vidout.pages.dev/movie/tmdb_${id}`,
    tvUrl:    (id, s, e) => `https://vidout.pages.dev/tv/tmdb_${id}_${s}_${e}`,
  },
  // ── Top tier: Multi-audio & 4K embeds (no extension required) ──
  // ── VidLink (Deadpool: 4K, Multi-audio, clean modern UI, customized theme) ──
  {
    id: 'vidlink', label: 'Deadpool (4K)',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 5,
    tags: ['Multi audio', '4K'],
    movieUrl: (id) =>
      `https://vidlink.pro/movie/${id}?primaryColor=E50914&secondaryColor=121319&iconColor=ffffff`,
    tvUrl: (id, s, e) =>
      `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=E50914&secondaryColor=121319&iconColor=ffffff`,
  },
  // ── CinemaOS (Scarlet Witch) ──
  {
    id: 'cinemaos', label: 'Scarlet Witch',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 6,
    tags: ['Regional', 'Multi audio'],
    movieUrl: (id, lang = 'en') => `https://cinemaos.tech/player/${id}?lang=${lang}`,
    tvUrl:    (id, s, e, lang = 'en') => `https://cinemaos.tech/player/${id}/${s}/${e}?lang=${lang}`,
    animeUrl: (id, ep, lang = 'en') => `https://cinemaos.tech/player/${id}/1/${ep}?lang=${lang}`,
  },
  // ── Vidzee (Captain America) ──
  {
    id: 'vidzee', label: 'Captain America',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 7,
    tags: ['Regional', 'Multi audio'],
    movieUrl: (id, lang = 'en') => `https://player.vidzee.wtf/embed/movie/${id}?lang=${lang}`,
    tvUrl:    (id, s, e, lang = 'en') => `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}?lang=${lang}`,
    animeUrl: (id, ep, lang = 'en') => `https://player.vidzee.wtf/embed/tv/${id}/1/${ep}?lang=${lang}`,
  },
  // ── Videasy (Iron Man: 4K, Netflix overlay, built-in episode selector) ──
  {
    id: 'videasy', label: 'Iron Man (4K)',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 8,
    tags: ['Multi audio', '4K'],
    movieUrl: (id) =>
      `https://player.videasy.to/movie/${id}?color=E50914&overlay=true&nextEpisode=true`,
    tvUrl: (id, s, e) =>
      `https://player.videasy.to/tv/${id}/${s}/${e}?color=E50914&overlay=true&nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true`,
  },
  {
    id: 'videasy-anime', label: 'Iron Man Anime',
    searchType: 'anilist', contentTypes: ['anime'], priority: 1,
    animeUrl: (id, ep) =>
      `https://player.videasy.to/anime/${id}/${ep}?color=E50914&overlay=true&nextEpisode=true&autoplayNextEpisode=true`,
  },
  // ── SmashyStream (Wolverine: multi-server fallback, ultra high uptime) ──
  {
    id: 'smashystream', label: 'Wolverine',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 8,
    movieUrl: (id) => `https://player.smashystream.com/movie/${id}`,
    tvUrl:    (id, s, e) => `https://player.smashystream.com/tv/${id}?s=${s}&e=${e}`,
  },
  // ── Vidsrc.pm (Loki: high-speed VIP mirror covering entire TMDB catalog) ──
  {
    id: 'vidsrc-pm', label: 'Loki',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 9,
    movieUrl: (id) => `https://vidsrc.pm/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://vidsrc.pm/embed/tv/${id}/${s}/${e}`,
  },
  // ── Additional Movie & TV providers ──────────────────────────────────────────
  {
    id: 'nontongo', label: 'Vision',
    searchType: 'tmdb', contentTypes: ['movie'], priority: 10,
    movieUrl: (id) => `https://www.NontonGo.win/embed/movie/${id}`,
  },
  {
    id: 'vidup', label: 'Thor',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 11,
    movieUrl: (id) => `https://vidup.to/movie/${id}?server=zenith`,
    tvUrl:    (id, s, e) => `https://vidup.to/tv/${id}/${s}/${e}?server=zenith`,
  },
  {
    id: 'vidcore', label: 'Hulk',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 12,
    movieUrl: (id) => `https://vidcore.net/movie/${id}?server=Crystal&autoPlay=true`,
    tvUrl:    (id, s, e) => `https://vidcore.net/tv/${id}/${s}/${e}?server=Crystal&autoPlay=true`,
  },
  {
    id: 'vidsrc-ru', label: 'Black Widow',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 13,
    movieUrl: (id) => `https://vidsrcme.ru/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://vidsrcme.ru/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidlove', label: 'Hawkeye',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 14,
    movieUrl: (id) => `https://player.vidlove.cc/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://player.vidlove.cc/embed/tv/${id}/${s}/${e}`,
    animeUrl: (id, ep) => `https://player.vidlove.cc/embed/tv/${id}/1/${ep}`,
  },
  {
    id: '1embed', label: 'Spider-Man',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 15,
    movieUrl: (id) => `https://1embed.cc/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://1embed.cc/embed/tv/${id}/${s}/${e}`,
    animeUrl: (id, ep) => `https://1embed.cc/embed/tv/${id}/1/${ep}`,
  },
  {
    id: 'cinesrc', label: 'Doctor Strange',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 16,
    movieUrl: (id) => `https://cinesrc.st/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://cinesrc.st/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'primesrc', label: 'Black Panther',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 17,
    movieUrl: (id) => `https://primesrc.me/embed/movie?tmdb=${id}`,
    tvUrl:    (id, s, e) =>
      `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}&fallback=false&serverOrder=PrimeVid,Voe,Dood`,
  },
  {
    id: 'vidnest-tv', label: 'Ant-Man',
    searchType: 'tmdb', contentTypes: ['tv'], priority: 18,
    tvUrl: (id, s, e) => `https://vidnest.fun/tv/${id}/${s}/${e}`,
  },
  // ── Anime-only (AniList routing) ────────────────────────────────────────────
  {
    id: 'megaplay-dub', label: 'Star-Lord Dub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 1,
    animeUrl: (id, ep) => `https://megaplay.buzz/stream/ani/${id}/${ep}/dub`,
  },
  {
    id: 'megaplay-sub', label: 'Star-Lord Sub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 2,
    animeUrl: (id, ep) => `https://megaplay.buzz/stream/ani/${id}/${ep}/sub`,
  },
  {
    id: 'vidnest-sub', label: 'Gamora Sub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 3,
    animeUrl: (id, ep) => `https://vidnest.fun/anime/${id}/${ep}/sub`,
  },
  {
    id: 'vidnest-dub', label: 'Gamora Dub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 4,
    animeUrl: (id, ep) => `https://vidnest.fun/anime/${id}/${ep}/dub`,
  },
  {
    id: 'vidnest-hindi', label: 'Gamora Hindi',
    searchType: 'anilist', contentTypes: ['anime'], priority: 5,
    animeUrl: (id, ep) => `https://vidnest.fun/anime/${id}/${ep}/hindi`,
  },
  {
    id: 'vidnest-pahe-sub', label: 'Rocket Sub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 6,
    animeUrl: (id, ep) => `https://vidnest.fun/animepahe/${id}/${ep}/sub`,
  },
  {
    id: 'vidnest-pahe-dub', label: 'Rocket Dub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 7,
    animeUrl: (id, ep) => `https://vidnest.fun/animepahe/${id}/${ep}/dub`,
  },
];

function getProviders(ct: ContentType): ProviderDef[] {
  return PROVIDER_DEFS.filter(p => p.contentTypes.includes(ct)).sort((a, b) => a.priority - b.priority);
}

function buildUrl(
  p: ProviderDef,
  tmdbId: number,
  anilistId: number | null,
  ct: ContentType,
  s: number,
  e: number,
  lang?: string,
): string {
  const id = p.searchType === 'anilist' ? (anilistId ?? tmdbId) : tmdbId;
  if (ct === 'movie' && p.movieUrl) return p.movieUrl(id, lang);
  if (ct === 'anime' && p.animeUrl) return p.animeUrl(id, e, lang);
  if (ct === 'tv'    && p.tvUrl)    return p.tvUrl(id, s, e, lang);
  if (p.tvUrl)    return p.tvUrl(id, s, e, lang);
  if (p.movieUrl) return p.movieUrl(id, lang);
  return '';
}

// Public-safe shape — only what the UI needs to render provider buttons.
function publicMeta(p: ProviderDef) {
  return { id: p.id, label: p.label, tags: p.tags ?? [] };
}

const VALID_CT: ContentType[] = ['movie', 'tv', 'anime'];

export async function onRequest(context: { request: Request }) {
  const url = new URL(context.request.url);
  const params = url.searchParams;
  const action = params.get('action');
  const contentType = params.get('contentType');
  const providerId = params.get('providerId');
  const tmdbId = params.get('tmdbId');
  const anilistId = params.get('anilistId');
  const season = params.get('season');
  const episode = params.get('episode');
  const lang = params.get('lang');

  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });

  if (context.request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return new Response(null, { status: 204, headers });
  }

  const ct: ContentType = VALID_CT.includes(contentType as ContentType)
    ? (contentType as ContentType)
    : 'movie';

  if (action === 'resolve') {
    const provider = PROVIDER_DEFS.find(p => p.id === String(providerId || ''));
    if (!provider) return Response.json({ error: 'Unknown provider' }, { status: 404, headers });

    const tmdbIdNum = parseInt(String(tmdbId || '0'), 10);
    const anilistIdNum = anilistId ? parseInt(String(anilistId), 10) : null;
    const seasonNum = parseInt(String(season || '1'), 10);
    const episodeNum = parseInt(String(episode || '1'), 10);
    const langStr = lang || 'en';

    const resolvedUrl = buildUrl(provider, tmdbIdNum, anilistIdNum, ct, seasonNum, episodeNum, langStr);
    if (!resolvedUrl) {
      return Response.json({ error: 'Could not resolve URL for this provider/content type' }, { status: 400, headers });
    }

    headers.set('Cache-Control', 'no-store');
    return Response.json({ url: resolvedUrl }, { status: 200, headers });
  }

  headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return Response.json({ providers: getProviders(ct).map(publicMeta) }, { status: 200, headers });
}
