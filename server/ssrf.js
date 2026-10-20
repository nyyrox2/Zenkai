const FORBIDDEN_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // AWS/Cloud metadata
  "metadata.google.internal",
  "instance-data"
]);

// Allowed streaming CDN domains and video providers
const ALLOWED_STREAM_DOMAINS = [
  "megaplay.buzz",
  "nexabloom.top",
  "stellarfrontier.world",
  "phantomharbor.top",
  "shadowharbor.top",
  "hiddenvertex.top",
  "emeralddrift.top",
  "eclipseharbor.space",
  "broforgotsave.online",
  "imgnex.top",
  "akirax.top",
  "shiora.top",
  "krussdomi.com",
  "advancedairesearchlab.top",
  "animeapps.top",
  "nukitashi.top",
  "playeng.animeapps.top",
  "novelfire.net",
  "novelfull.com",
  "anikototv.to",
  "animegg.org",
  "anineko.to",
  "anizone.to",
  "aniwave.to",
  "animesalt.cx",
  "animesalt.ac",
  "animesalt.ro",
  "ravok.buzz",
  "acdn.top",
  "abyssplayer.com",
  "playhydrax.com",
  "flixcloud.cc",
  "enc-dec.app",
  "reanime.to",
  "atomic4cdn.com",
  "rundowncdn.com",
  "rundowncdn.top",
  "vividcdn.com",
  "vividcdn.top",
  "fallencdn.com",
  "fallencdn.top",
  "akamaized.net",
  "cloudflare.com",
  "workers.dev",
  "opensubtitles.org",
  "opensubtitles-v3.strem.io",
  "strem.io",
  "tmdb.org",
  "themoviedb.org",
  "image.tmdb.org"
];
export function validateProxyUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "Missing URL parameter" };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Protocol check
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS protocols permitted" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. Strict loopback / metadata block
  if (FORBIDDEN_HOSTNAMES.has(hostname)) {
    return { valid: false, error: "Target host restricted (SSRF prevention)" };
  }

  // 2. Private IP range block
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/.test(hostname)) {
    return { valid: false, error: "Private IP addresses prohibited" };
  }

  // Internal suffixes
  if (hostname.endsWith(".internal") || hostname.endsWith(".local") || hostname.endsWith(".lan")) {
    return { valid: false, error: "Internal network targets prohibited" };
  }

  // 3. Domain validation: Host must match allowed streaming domains or media patterns
  const isMediaPattern =
    /\.(m3u8|ts|m4s|m3u|mp4|vtt|srt|key|jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(parsed.pathname) ||
    /cdn|stream|video|m3u8|hls|media|chunk|segment|seg-|sub|caption|fetch|anime|harbor|drift|frontier|vertex|space/i.test(hostname) ||
    /stream|anime|subtitles/i.test(parsed.pathname) ||
    /^as-cdn\d*\.top$/i.test(hostname); // ACDN players (as-cdn26.top, ...)

  const isAllowed = ALLOWED_STREAM_DOMAINS.some(domain =>
    hostname === domain || hostname.endsWith("." + domain)
  ) || isMediaPattern;

  if (!isAllowed) {
    return { valid: false, error: "Target host not in permitted media streaming list" };
  }

  return { valid: true, url: parsed };
}

// =====================================================================
// 5. ABUSE SIGNALS CHECK
