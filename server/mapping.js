// Bundled AniList -> AnimeSalt mapping (public/anime-mapping.json, same file the Android app ships).
// Imported (not fetched) so it works inside Cloudflare Pages Functions and the Vite dev server alike.
import mappingData from "../public/anime-mapping.json";

export const ANIME_MAPPING = mappingData;

/**
 * Picks the mapping entry for an AniList id + absolute episode number.
 * Continuous anime (e.g. One Piece, Black Clover, Naruto) keep their episode numbers across seasons on AnimeSalt.
 * When episodeOffset is defined (e.g. split-cour anime), finalEp = episode + episodeOffset.
 * When episodeOffset is not defined, finalEp = episode (does NOT subtract startEpisode).
 * Returns { saltId, season, episode, finalEp, isMovie, slug } or null when the title isn't mapped.
 */
export function pickMapping(mapping, anilistId, episode = 1, isMovie = false) {
  const raw = mapping?.[String(anilistId).trim()];
  if (!raw) return null;
  const entries = Array.isArray(raw) ? raw : [raw];
  const sorted = [...entries].sort((a, b) => (b.startEpisode || 1) - (a.startEpisode || 1));
  const picked = sorted.find((e) => episode >= (e.startEpisode || 1)) || entries[0];
  if (!picked?.saltId) return null;
  const ep = picked.episodeOffset !== undefined ? Math.max(1, episode + picked.episodeOffset) : episode;
  const isMov = !!isMovie || picked.season === null || picked.season === 0;
  const slug = isMov ? picked.saltId : `${picked.saltId}-${picked.season ?? 1}x${ep}`;
  return {
    saltId: picked.saltId,
    season: picked.season ?? 1,
    episode: ep,
    finalEp: ep,
    isMovie: isMov,
    slug,
  };
}
