import { ANIME_MAPPING, pickMapping } from "./mapping.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE_URL = "https://animesalt.cx";

// In-memory cache for mapping & resolved streams
let cachedMapping = null;
const streamCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadMapping(origin = "") {
  if (cachedMapping) return cachedMapping;
  // 1. Bundled copy (public/anime-mapping.json) - no network needed
  if (ANIME_MAPPING && Object.keys(ANIME_MAPPING).length) {
    cachedMapping = ANIME_MAPPING;
    return cachedMapping;
  }
  // 2. Fallback: fetch from current origin or Vercel CDN
  try {
    const targetUrl = origin
      ? `${origin}/anime-mapping.json`
      : "https://aniversee.vercel.app/anime-mapping.json";
    const res = await fetch(targetUrl);
    if (res.ok) {
      cachedMapping = await res.json();
      return cachedMapping;
    }
  } catch {}
  return {};
}

/**
 * Canonical AnimeSalt Title Normalization matching Android AnimeSaltResolver
 */
export function normalizeAnimeSaltTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function cleanTitleForSlug(title = "") {
  return title
    .replace(/\s*\(\d{4}\)\s*$/g, "")
    .replace(/\s*Season\s+\d+\s*$/gi, "")
    .replace(/\s*\d+(?:st|nd|rd|th)\s+season\s*$/gi, "")
    .replace(/\s*Final Season\s*$/gi, "")
    .replace(/\s*:\s*Part\s+\d+\s*$/gi, "")
    .replace(/\s*Part\s+\d+\s*$/gi, "")
    .replace(/\s*Cour\s+\d+\s*$/gi, "")
    .replace(/\s*[-–]\s*Season\s+\d+\s*$/gi, "")
    .replace(/\s*:.*$/g, "")
    .trim();
}

export function extractSeason(title = "", romajiTitle = "") {
  const patterns = [
    /\b(?:Season|Series|Part|S)\s*(\d+)\b/i,
    /\b(\d+)(?:st|nd|rd|th)\s+Season\b/i
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m && m[1]) return parseInt(m[1], 10);
  }
  if (romajiTitle) {
    for (const p of patterns) {
      const m = romajiTitle.match(p);
      if (m && m[1]) return parseInt(m[1], 10);
    }
  }
  return 1;
}

export function generateAnimeSaltSlug(title = "", season = 1, episode = 1) {
  const normalized = normalizeAnimeSaltTitle(title);
  return `${normalized}-${season}x${episode}`;
}

export function getCandidateSlugs({
  anilistId,
  episode = 1,
  title = "",
  romajiTitle = "",
  isMovie = false,
  mapping = {}
}) {
  // Direct Mapping via anime-mapping.json only (strict: never guess slugs or generate fuzzy fallbacks)
  const mapped = pickMapping(mapping, anilistId, episode, isMovie);
  if (!mapped?.slug) return [];
  return [mapped.slug];
}

function extractIframeSrc(snippet) {
  if (!snippet) return null;
  const ds = snippet.match(/data-src=["']([^"']+)["']/i);
  if (ds && ds[1] && ds[1].trim() !== "about:blank") return ds[1].trim();
  const s = snippet.match(/\bsrc=["']([^"']+)["']/i);
  if (s && s[1] && s[1].trim() !== "about:blank") return s[1].trim();
  return null;
}

/**
 * Extracts player embed URL (options-0 or options-1) from AnimeSalt episode page.
 * Aligned with Zenkai Android APK (AnimeSaltResolver.kt extractServers).
 * server = "1" / "mystream" (Server 1: MyStream / ACDN / Ravok)
 * server = "2" / "abyss"    (Server 2: Abyss / Multi-Audio Plyr)
 */
export async function extractAnimeSaltPlayer({
  anilistId,
  episode = 1,
  title = "",
  romajiTitle = "",
  isMovie = false,
  audio = "multi",
  server = "1",
  origin = ""
}) {
  const cacheKey = `${anilistId || title}:${episode}:${isMovie}`;
  const cached = streamCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const srv = String(server || "1").toLowerCase();
    const isServer2 = srv === "2" || srv === "abyss";
    const chosen = isServer2
      ? (cached.data.abyssUrl || cached.data.myStreamUrl || cached.data.embedUrl)
      : (cached.data.myStreamUrl || cached.data.abyssUrl || cached.data.embedUrl);
    return {
      ...cached.data,
      server: isServer2 ? "2" : "1",
      embedUrl: chosen
    };
  }

  const mapping = await loadMapping(origin);
  const slugs = getCandidateSlugs({ anilistId, episode, title, romajiTitle, isMovie, mapping });
  if (!slugs.length) {
    return {
      success: false,
      error: "Anime not mapped in anime-mapping.json. Please add a mapping for this title."
    };
  }

  for (const slug of slugs) {
    const candidateUrls = isMovie
      ? [
          `${BASE_URL}/movies/${slug}/`,
          `https://animesalt.ac/movies/${slug}/`,
          `https://animesalt.ro/movies/${slug}/`
        ]
      : [
          `${BASE_URL}/episode/${slug}/`,
          `https://animesalt.ac/episode/${slug}/`,
          `https://animesalt.ro/episode/${slug}/`
        ];

    for (const pageUrl of candidateUrls) {
      try {
        const resp = await fetch(pageUrl, {
          headers: {
            "User-Agent": UA,
            Referer: `${BASE_URL}/`
          }
        });

        if (!resp.ok) continue;
        const html = await resp.text();
        if (html.length < 500) continue;

        let myStreamUrl = null;
        let abyssUrl = null;
        const allIframes = [];

        // 1. Extract options-0: Server 1 (MyStream / as-cdn / ravok)
        const opt0Match = html.match(
          /<div[^>]+id=["'](?:options?|opt)-0["'][^>]*>([\s\S]*?)<\/div>/i
        );
        if (opt0Match && opt0Match[1]) {
          const raw = extractIframeSrc(opt0Match[1]);
          if (raw) myStreamUrl = raw.startsWith("/") ? `${BASE_URL}${raw}` : raw;
        }
        if (!myStreamUrl) {
          const directMatch = html.match(
            /<div[^>]+id=["'](?:options?|opt)-0["'][^>]*>[\s\S]*?<iframe[^>]+(?:data-src|src)=["']([^"']+)["']/i
          );
          if (directMatch && directMatch[1] && directMatch[1] !== "about:blank") {
            let u = directMatch[1].trim();
            if (u.startsWith("/")) u = `${BASE_URL}${u}`;
            myStreamUrl = u;
          }
        }

        // 2. Extract options-1: Server 2 (Abyss / player.php multi-audio Plyr)
        const opt1Match = html.match(
          /<div[^>]+id=["'](?:options?|opt)-1["'][^>]*>([\s\S]*?)<\/div>/i
        );
        if (opt1Match && opt1Match[1]) {
          const raw = extractIframeSrc(opt1Match[1]);
          if (raw) abyssUrl = raw.startsWith("/") ? `${BASE_URL}${raw}` : raw;
        }
        if (!abyssUrl) {
          const directMatch = html.match(
            /<div[^>]+id=["'](?:options?|opt)-1["'][^>]*>[\s\S]*?<iframe[^>]+(?:data-src|src)=["']([^"']+)["']/i
          );
          if (directMatch && directMatch[1] && directMatch[1] !== "about:blank") {
            let u = directMatch[1].trim();
            if (u.startsWith("/")) u = `${BASE_URL}${u}`;
            abyssUrl = u;
          }
        }

        // 3. Parse all iframes inside page
        for (const ifr of html.matchAll(/<iframe[^>]*>/gi)) {
          const u = extractIframeSrc(ifr[0]);
          if (u && u !== "about:blank") {
            const full = u.startsWith("/") ? `${BASE_URL}${u}` : u;
            if (!allIframes.includes(full)) {
              allIframes.push(full);
            }
          }
        }

        if (!myStreamUrl) {
          myStreamUrl =
            allIframes.find(
              u =>
                u.includes("/video/") ||
                u.includes("as-cdn") ||
                u.includes("ravok") ||
                u.includes("acdn")
            ) || (allIframes.length > 0 ? allIframes[0] : null);
        }

        if (!abyssUrl) {
          abyssUrl =
            allIframes.find(u => u.includes("player.php") || u.includes("abyss")) ||
            (allIframes.length > 1 ? allIframes[1] : null);
        }

        const srv = String(server || "1").toLowerCase();
        const isServer2 = srv === "2" || srv === "abyss";
        const selectedPlayer = isServer2
          ? (abyssUrl || myStreamUrl || allIframes[0])
          : (myStreamUrl || abyssUrl || allIframes[0]);

        if (selectedPlayer) {
          // Attempt direct HLS stream extraction if video hash is present
          let directStreamUrl = null;
          const hashMatch = selectedPlayer.match(/\/video\/([a-zA-Z0-9_-]+)/i);
          if (hashMatch) {
            try {
              const hash = hashMatch[1];
              const originHost = new URL(selectedPlayer).origin;
              const postUrl = `${originHost}/player/index.php?data=${hash}&do=getVideo`;
              const postBody = new URLSearchParams({
                hash,
                r: pageUrl
              }).toString();

              const gvResp = await fetch(postUrl, {
                method: "POST",
                headers: {
                  "User-Agent": UA,
                  Referer: selectedPlayer,
                  "X-Requested-With": "XMLHttpRequest",
                  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                },
                body: postBody
              });

              if (gvResp.ok) {
                const gvData = await gvResp.json().catch(() => null);
                directStreamUrl = gvData?.videoSource || gvData?.securedLink || null;
              }
            } catch {}
          }

          const result = {
            success: true,
            slug,
            pageUrl,
            embedUrl: selectedPlayer,
            server: isServer2 ? "2" : "1",
            myStreamUrl,
            abyssUrl,
            directStreamUrl,
            allIframes
          };

          streamCache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        }
      } catch (err) {
        // try next candidate
      }
    }
  }

  return {
    success: false,
    error: "Failed to extract AnimeSalt player"
  };
}
