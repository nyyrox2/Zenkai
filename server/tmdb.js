// Centralized TMDB Client for Zenkai Web
// Performs server-side TMDB fetching using Cloudflare environment variables:
// - TMDB_API_KEY
// - TMDB_BEARER_TOKEN (or TMDB_API_READ_ACCESS_TOKEN)
// Falls back to built-in credentials or the resilient Lovable proxy if env is unset.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
export const TMDB_API_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
export const TMDB_FALLBACK = "https://webpage-launchpad.lovable.app/api/public/proxy";

export const DEFAULT_TMDB_BEARER_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjN2RiNjE2OWJmZGQzZmM5ZjdkZDZjNDRlYThhZDEwMCIsIm5iZiI6MTc1NDM3NjY0MC40MDYwMDAxLCJzdWIiOiI2YWY0MDNjOWI4YTRlMzU1YjYzNGVkOTciLCJzY29wZXMiOlsicXBsX3JlYWQiXSwidmVyc2lvbiI6MX0.ww3C_pAWxT63xXVM9OAkq8aSEyFhmyA5VaobbE-E0y4";

export const DEFAULT_TMDB_API_KEY = "c7db6169bfdd3fc9f7dd6c44ea8ad100";

/**
 * Fetch from TMDB server-side using official v3 API (Bearer Token + API Key).
 * @param {string} endpoint - e.g. "trending/movie/week" or "/tv/269?append_to_response=images"
 * @param {object} [env] - Cloudflare worker/pages environment
 */
export async function tmdbFetch(endpoint, env = null) {
  const token =
    env?.TMDB_BEARER_TOKEN ||
    env?.TMDB_API_READ_ACCESS_TOKEN ||
    env?.TMDB_READ_ACCESS_TOKEN ||
    (typeof process !== "undefined" && (process.env?.TMDB_BEARER_TOKEN || process.env?.TMDB_API_READ_ACCESS_TOKEN)) ||
    DEFAULT_TMDB_BEARER_TOKEN;

  const apiKey =
    env?.TMDB_API_KEY ||
    env?.TMDB_KEY ||
    (typeof process !== "undefined" && (process.env?.TMDB_API_KEY || process.env?.TMDB_KEY)) ||
    DEFAULT_TMDB_API_KEY;

  // Normalize endpoint: strip leading slash or full TMDB URL
  let clean = endpoint.startsWith("http")
    ? endpoint.replace(/^https?:\/\/[^\/]+(?:\/3|\/api\/tmdb)?\/?/, "")
    : endpoint.replace(/^\/+/, "");

  const sep = clean.includes("?") ? "&" : "?";
  const hasKey = clean.includes("api_key=");
  const directUrl = `${TMDB_API_BASE}/${clean}${hasKey ? "" : `${sep}api_key=${apiKey}`}`;

  // Tier 1: Direct official TMDB API from Cloudflare edge
  try {
    const res = await fetch(directUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_e) {}

  // Tier 2: Resilient proxy fallback via Lovable Edge Proxy
  try {
    const fallbackUrl = `${TMDB_FALLBACK}?url=${encodeURIComponent(directUrl)}`;
    const res = await fetch(fallbackUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": UA,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_e) {}

  // Tier 3: Resilient midman fallback via Railway
  try {
    const railwayUrl = `https://zenkai-movies-production.up.railway.app/api/movies/${clean}`;
    const res = await fetch(railwayUrl, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && !data.error) return data;
    }
  } catch (_e) {}

  throw new Error(`TMDB fetch failed for ${endpoint}`);
}
