// Bundled AniList -> AnimeSalt mapping (public/anime-mapping.json, same file the Android app ships).
// Imported (not fetched) so it works inside Cloudflare Pages Functions and the Vite dev server alike.
import mappingData from "../public/anime-mapping.json";

export const ANIME_MAPPING = mappingData;

/**
 * Picks the mapping entry for an AniList id + absolute episode number.
 * Mirrors AnimeMappingRepository in the Android app:
 *   - entries are checked from the highest startEpisode down, first one the episode reaches wins
 *   - finalEp = episode + episodeOffset when an offset is set, else episode - startEpisode + 1
 *   - season null / 0 means movie
 * Returns { saltId, season, finalEp, isMovie } or null when the title isn't mapped.
 */
export function pickMapping(mapping, anilistId, episode = 1, isMovie = false) {
  const raw = mapping?.[String(anilistId)];
  if (!raw) return null;
  const entries = Array.isArray(raw) ? raw : [raw];
  const sorted = [...entries].sort((a, b) => (b.startEpisode || 1) - (a.startEpisode || 1));
  const picked = sorted.find((e) => episode >= (e.startEpisode || 1)) || entries[0];
  if (!picked?.saltId) return null;
  const startEp = picked.startEpisode || 1;
  const finalEp = picked.episodeOffset ? Math.max(1, episode + picked.episodeOffset) : Math.max(1, episode - startEp + 1);
  return {
    saltId: picked.saltId,
    season: picked.season ?? 1,
    finalEp,
    isMovie: !!isMovie || picked.season === null || picked.season === 0,
  };
}
