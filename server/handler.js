// One Web-standard handler shared by Cloudflare Pages Functions and the Vite dev server.
// handle(request) -> Response | null (null = not an API route)
import { resolveDirectStreamWorker } from "./direct-stream.js";
import { resolveFlixCloud, resolveReanimeEmbed } from "./flixcloud.js";
import { extractAnimeSaltPlayer } from "./animesalt.js";
import { resolveAcdn } from "./acdn.js";
import { validateProxyUrl } from "./ssrf.js";
import { shield } from "./shield.js";
import novelEngine from "./novel.js";
import * as manga from "./manga.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TMDB = "https://aniversee.vercel.app/api/tmdb";
const ANIBRIDGE = "https://anibridge.eliasbenb.dev/api/mappings?source.descriptor=anilist:";
const ARM = "https://arm.haglund.dev/api/v2/ids?source=anilist&id=";
const OPENSUBS = "https://opensubtitles-v3.strem.io/subtitles";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

const json = (data, status = 200, ttl = 0) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": ttl ? `public, max-age=${ttl}` : "no-store",
    },
  });

/* ---------- tiny TTL memo (per isolate / dev process) ---------- */
const memo = new Map();
async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v;
  const v = await fn();
  if (v) memo.set(key, { at: Date.now(), v });
  return v;
}

const getJson = async (url, init = {}) => {
  const r = await fetch(url, { ...init, headers: { Accept: "application/json", "User-Agent": UA, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

/* ====================================================================
 * AniBridge mapping (AniList -> MAL / TMDB / TVDB / IMDb / AniDB), ARM fallback
 * ==================================================================== */
function parseMapping(data, anilistId) {
  const out = { anilist: anilistId, mal: null, tmdb: null, tvdb: null, imdb: null, anidb: null };
  const seen = [];
  const walk = (v) => {
    if (!v) return;
    if (typeof v === "string") {
      if (/^[a-z_]+:[^\s]+$/i.test(v)) seen.push(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(data);
  for (const d of seen) {
    const [provider, id, scope] = d.split(":");
    const p = provider.toLowerCase();
    const season = scope && /^s\d+$/i.test(scope) ? parseInt(scope.slice(1), 10) : null;
    if ((p === "mal" || p === "myanimelist") && !out.mal) out.mal = Number(id) || null;
    else if (p.startsWith("tmdb") && !out.tmdb) out.tmdb = { id: Number(id), type: p.includes("movie") ? "movie" : "tv", season };
    else if (p.startsWith("tvdb") && !out.tvdb) out.tvdb = Number(id) || null;
    else if (p.startsWith("imdb") && !out.imdb) out.imdb = id;
    else if (p === "anidb" && !out.anidb) out.anidb = Number(id) || null;
  }
  return out;
}

const mapOf = (anilistId) =>
  cached(`map:${anilistId}`, 24 * 3600e3, async () => {
    try {
      const m = parseMapping(await getJson(ANIBRIDGE + anilistId), anilistId);
      if (m.mal || m.tmdb || m.imdb) return { ...m, source: "anibridge" };
    } catch {}
    try {
      const a = await getJson(ARM + anilistId);
      return {
        anilist: anilistId,
        mal: a.myanimelist ?? null,
        tmdb: a.themoviedb ? { id: a.themoviedb, type: a.type === "MOVIE" ? "movie" : "tv", season: a["themoviedb-season"] ?? null } : null,
        tvdb: a.thetvdb ?? null,
        imdb: a.imdb ?? null,
        anidb: a.anidb ?? null,
        source: "arm",
      };
    } catch {}
    return null;
  });

/* ====================================================================
 * TMDB details + artwork (through the same aniversee.vercel.app proxy)
 * ==================================================================== */
const cleanTitle = (t = "") =>
  t
    .replace(/\s*\(\d{4}\)\s*$/g, "")
    .replace(/\s*(Final Season|Season\s+\d+|\d+(st|nd|rd|th)\s+Season|Cour\s+\d+|Part\s+\d+)\s*$/gi, "")
    .replace(/\s*:\s*$/, "")
    .trim();

async function tmdbFor(anilistId, title, format) {
  const map = anilistId ? await mapOf(anilistId) : null;
  let ref = map?.tmdb ? { id: map.tmdb.id, type: map.tmdb.type, season: map.tmdb.season } : null;

  if (!ref && title) {
    try {
      const want = format === "MOVIE" ? "movie" : "tv";
      const res = await getJson(`${TMDB}/search/multi?query=${encodeURIComponent(cleanTitle(title) || title)}`);
      const hit = res.results?.find((r) => r.media_type === want) || res.results?.find((r) => r.media_type === "tv" || r.media_type === "movie");
      if (hit) ref = { id: hit.id, type: hit.media_type, season: null };
    } catch {}
  }
  if (!ref) return { map, tmdb: null };

  const d = await getJson(
    `${TMDB}/${ref.type}/${ref.id}?language=en-US&append_to_response=images,videos,credits,external_ids,content_ratings,release_dates&include_image_language=en,null`,
  );

  const pngs = (d.images?.logos || []).filter((l) => l.file_path && !l.file_path.toLowerCase().endsWith(".svg"));
  const logo = pngs.sort((a, b) => (b.iso_639_1 === "en") - (a.iso_639_1 === "en") || b.vote_average - a.vote_average)[0]?.file_path ?? null;
  const textless = (d.images?.backdrops || []).filter((b) => !b.iso_639_1).sort((a, b) => b.vote_average - a.vote_average);
  const backdrops = (textless.length ? textless : d.images?.backdrops || []).slice(0, 6).map((b) => b.file_path);

  const certification =
    d.content_ratings?.results?.find((r) => r.iso_3166_1 === "US")?.rating ||
    d.release_dates?.results?.find((r) => r.iso_3166_1 === "US")?.release_dates?.find((x) => x.certification)?.certification ||
    null;
  const yt = (d.videos?.results || []).find((v) => v.site === "YouTube" && /trailer|teaser/i.test(v.type));

  return {
    map,
    tmdb: {
      id: ref.id,
      type: ref.type,
      season: ref.season,
      imdbId: d.external_ids?.imdb_id || map?.imdb || null,
      logo,
      backdrop: d.backdrop_path || backdrops[0] || null,
      backdrops,
      overview: d.overview || null,
      tagline: d.tagline || null,
      rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      votes: d.vote_count || null,
      certification,
      networks: (d.networks || d.production_companies || []).slice(0, 4).map((n) => n.name),
      status: d.status || null,
      language: d.original_language || null,
      seasons: d.number_of_seasons ?? null,
      episodes: d.number_of_episodes ?? null,
      firstAir: d.first_air_date || d.release_date || null,
      lastAir: d.last_air_date || null,
      runtime: d.episode_run_time?.[0] || d.runtime || null,
      cast: (d.credits?.cast || []).slice(0, 10).map((c) => ({ name: c.name, character: c.character, photo: c.profile_path })),
      trailer: yt ? yt.key : null,
    },
  };
}

/* ====================================================================
 * Subtitles (OpenSubtitles Stremio addon, keyed by IMDb id from TMDB/AniBridge)
 * ==================================================================== */
const LANGS = { eng: "English", spa: "Spanish", fre: "French", fra: "French", ger: "German", deu: "German", ita: "Italian", por: "Portuguese", pob: "Portuguese (BR)", ara: "Arabic", rus: "Russian", hin: "Hindi", jpn: "Japanese", chi: "Chinese", zho: "Chinese", ind: "Indonesian", tha: "Thai", vie: "Vietnamese", kor: "Korean", tur: "Turkish", pol: "Polish", dut: "Dutch", nld: "Dutch" };

async function subtitlesFor(anilistId, title, ep, format) {
  const { tmdb, map } = await cached(`tmdb:${anilistId}:${title}`, 24 * 3600e3, () => tmdbFor(anilistId, title, format)).then((v) => v || {});
  const imdb = tmdb?.imdbId || map?.imdb;
  if (!imdb) return [];
  const season = tmdb?.season || map?.tmdb?.season || 1;
  const url = tmdb?.type === "movie" ? `${OPENSUBS}/movie/${imdb}.json` : `${OPENSUBS}/series/${imdb}:${season}:${ep}.json`;
  const data = await getJson(url).catch(() => null);
  const count = {};
  return (data?.subtitles || []).slice(0, 60).map((s, i) => {
    const language = LANGS[s.lang] || (s.lang ? s.lang[0].toUpperCase() + s.lang.slice(1) : "English");
    count[language] = (count[language] || 0) + 1;
    return { id: s.id || `os_${i}`, label: count[language] > 1 ? `${language} #${count[language]}` : language, language, lang: s.lang, url: s.url, source: "OpenSubtitles" };
  });
}

/* ====================================================================
 * Proxy (HLS playlists are rewritten so segments also pass through here)
 * ==================================================================== */
function refererFor(host, requested) {
  if (requested && !/flixcloud\.cc|megaplay/.test(requested)) return requested;
  if (/krussdomi|advancedairesearchlab/.test(host)) return "https://krussdomi.com/";
  if (/animeapps|nukitashi|playeng/.test(host)) return "https://playeng.animeapps.top/";
  if (/nexabloom|stellarfrontier|phantomharbor|shadowharbor|hiddenvertex|emeralddrift|eclipseharbor|megaplay|megap|shiora|akirax|imgnex/.test(host)) return "https://megaplay.buzz/";
  if (/animesalt|as-cdn|acdn\.top|ravok/.test(host)) return "https://animesalt.cx/";
  if (/flixcloud|atomic4cdn|rundowncdn|vividcdn|fallencdn|enc-dec/.test(host)) return "https://flixcloud.cc/";
  return requested || null;
}

async function proxy(request, url, proxyBase = "/proxy") {
  const target = url.searchParams.get("url");
  const check = validateProxyUrl(target);
  if (!check.valid) return json({ error: check.error }, 403);
  const t = check.url;
  const referer = refererFor(t.hostname.toLowerCase(), url.searchParams.get("referer")) || `${t.origin}/`;

  const headers = new Headers({ "User-Agent": UA, Referer: referer, Origin: referer.replace(/\/$/, ""), Accept: "*/*" });
  const range = request.headers.get("Range");
  if (range) headers.set("Range", range);

  let up;
  try {
    up = await fetch(t, { headers });
  } catch (e) {
    return json({ error: "Proxy fetch failed: " + e.message }, 502);
  }

  const out = new Headers(CORS);
  const type = up.headers.get("Content-Type") || "";
  const isPlaylist =
    /mpegurl/i.test(type) ||
    /\.m3u8?$/i.test(t.pathname) ||
    t.pathname.includes("parse-flixcloud") ||
    (t.searchParams.get("url") || "").includes(".m3u8");

  if (up.ok && isPlaylist) {
    const text = await up.text();
    if (/^\s*</.test(text)) return new Response(text, { status: up.status, headers: out });
    const direct = url.searchParams.get("seg") === "1"; // segments straight from the CDN, only playlists/keys use the Worker
    const base = t.hostname.includes("enc-dec.app") && t.searchParams.get("url")
      ? new URL(t.searchParams.get("url"))
      : t;
    const wrap = (u, keep) => {
      try {
        const abs = new URL(u, base);
        if (!abs.search && base.search && !u.includes("?")) abs.search = base.search;
        if (direct && keep && !/rundowncdn|flixcloud|vividcdn|fallencdn/.test(abs.hostname)) return abs.href;
        return `${proxyBase}?url=${encodeURIComponent(abs.href)}&referer=${encodeURIComponent(referer)}${direct ? "&seg=1" : ""}`;
      } catch {
        return u;
      }
    };
    let variant = false;
    const body = text
      .split(/\r?\n/)
      .map((l) => {
        const s = l.trim();
        if (!s) return l;
        if (s.startsWith("#")) {
          variant = s.startsWith("#EXT-X-STREAM-INF");
          return s.replace(/URI=["']([^"']+)["']/g, (_, u) => `URI="${wrap(u, s.startsWith("#EXT-X-MAP"))}"`);
        }
        const plist = variant || /\.m3u8?(\?|$)/i.test(s) || s.includes("parse-flixcloud");
        variant = false;
        return wrap(s, !plist);
      })
      .join("\n");
    out.set("Content-Type", "application/vnd.apple.mpegurl");
    out.set("Cache-Control", "no-store");
    return new Response(body, { status: up.status, headers: out });
  }

  if (type) out.set("Content-Type", type);
  if (/\.(bin|key)$/i.test(t.pathname)) out.set("Content-Type", "application/octet-stream");
  for (const h of ["Content-Length", "Content-Range", "Accept-Ranges"]) {
    const v = up.headers.get(h);
    if (v) out.set(h, v);
  }
  if (up.ok && /\.(ts|m4s|mp4|aac|key|bin|png|webp)$/i.test(t.pathname)) out.set("Cache-Control", "public, max-age=3600");
  return new Response(up.body, { status: up.status, headers: out });
}

/* ====================================================================
 * Router
 * ==================================================================== */

/* ====================================================================
 * Zenkai Android app: live GitHub release data
 * One cached request for the repo + latest releases, so visitors never hit GitHub's 60/h anonymous limit.
 * ==================================================================== */
const APP_REPO = "Nyyrox/Zenkai";
const RELEASE_TTL = 5 * 60e3;
let releaseSnap = null; // { at, v } kept per isolate / dev process; served stale if GitHub is down

const pickRelease = (r) => ({
  tag_name: r.tag_name,
  name: r.name,
  body: r.body || "",
  html_url: r.html_url,
  published_at: r.published_at,
  prerelease: !!r.prerelease,
  draft: !!r.draft,
  assets: (r.assets || []).map((a) => ({
    name: a.name,
    size: a.size,
    download_count: a.download_count,
    browser_download_url: a.browser_download_url,
    content_type: a.content_type,
    updated_at: a.updated_at,
  })),
});

async function loadAppRelease(env) {
  const token = env?.GITHUB_TOKEN || globalThis.process?.env?.GITHUB_TOKEN;
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const [repo, releases] = await Promise.all([
    getJson(`https://api.github.com/repos/${APP_REPO}`, { headers }),
    getJson(`https://api.github.com/repos/${APP_REPO}/releases?per_page=30`, { headers }),
  ]);
  return {
    repo: {
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      open_issues_count: repo.open_issues_count,
      pushed_at: repo.pushed_at,
    },
    releases: releases.filter((r) => !r.draft).map(pickRelease),
    fetchedAt: new Date().toISOString(),
  };
}

/* ---------- Filler lists (animefillerlist.com: canon / mixed canon+filler / filler per episode) ---------- */
const slugOf = (t) => t.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Misses are cached too ({ max: 0 }), so an unknown title costs one request a day.
const fillerOf = (slug) =>
  cached(`filler:${slug}`, 24 * 3600e3, async () => {
    const out = { max: 0, filler: [], mixed: [] };
    try {
      const r = await fetch(`https://www.animefillerlist.com/shows/${slug}`, {
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
        redirect: "follow",
      });
      if (!r.ok) return out;
      const html = await r.text();
      // rows look like <tr class="odd mixed_canon/filler"><td class="Number">12</td>…<td class="Type">Mixed Canon/Filler</td>
      for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const num = row[1].match(/class=["']?Number["']?[^>]*>\s*(\d+)/i);
        const type = row[1].match(/class=["']?Type["']?[^>]*>\s*(?:<[^>]+>\s*)*([^<]*)/i);
        if (!num || !type) continue;
        const n = Number(num[1]);
        out.max = Math.max(out.max, n);
        if (/mixed/i.test(type[1])) out.mixed.push(n);
        else if (/filler/i.test(type[1])) out.filler.push(n);
      }
    } catch {
      /* unreachable: treated as a miss */
    }
    return out;
  });

// The show page slug is a guess from the title: also try it without "Season 2" / "Part 2" / ": subtitle" / "The".
const slugVariants = (t) => {
  const base = t.replace(/\s*[:\-–]\s*(season|part|cour)\s*\d+.*$/i, "").replace(/\s+(season|part|cour)\s*\d+.*$/i, "");
  return [t, base, base.replace(/\s*:.*$/, ""), base.replace(/^the\s+/i, ""), base.replace(/uu/gi, "u")].map(slugOf);
};

function getProxyBase(request, env) {
  // Never use external proxy when running on dev/local server
  if (env?.IS_DEV) return "/proxy";
  try {
    const host = new URL(request.url).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) {
      return "/proxy";
    }
  } catch {}

  let p = env?.STREAM_PROXY_URL || env?.VITE_STREAM_PROXY_URL || globalThis.process?.env?.STREAM_PROXY_URL || globalThis.process?.env?.VITE_STREAM_PROXY_URL || "";
  p = p.trim().replace(/\/+$/, "");
  if (!p) return "/proxy";
  try {
    const parsed = new URL(p);
    if (!parsed.pathname || parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = "/api/public/proxy";
      p = parsed.href.replace(/\/+$/, "");
    }
  } catch {}
  return p;
}

export async function handle(request, env) {
  const proxyBase = getProxyBase(request, env);
  const url = new URL(request.url);
  const path = url.pathname;
  const q = (k, d = "") => url.searchParams.get(k) ?? d;

  if (request.method === "OPTIONS" && (path.startsWith("/api/") || path === "/proxy"))
    return new Response(null, { status: 204, headers: CORS });

  const blocked = await shield(request, env, path, json);
  if (blocked) return blocked;

  if (path === "/proxy" || path === "/api/proxy") return proxy(request, url, proxyBase);

  if (path === "/api/stream") {
    const anilistId = parseInt(q("id", "0"), 10);
    const episode = parseInt(q("ep", "1"), 10) || 1;
    const server = q("server", "megaplay").toLowerCase();
    const audio = q("audio", "sub").toLowerCase();
    const title = q("title");
    if (!anilistId && !title) return json({ error: "Missing id or title" }, 400);

    // ACDN: multi-audio direct stream (anime-mapping.json + AnimeDekho / AnimeSalt), audio is picked inside the player
    if (server === "acdn") {
      const isMovie = q("format").toUpperCase() === "MOVIE" || q("isMovie") === "true";
      const lang = q("lang");
      try {
        const r = await cached(`acdn:${anilistId}:${episode}:${isMovie}:${lang}:${title}`, 10 * 60e3, () =>
          resolveAcdn({ anilistId, episode, title, isMovie, lang }),
        );
        if (!r?.streamUrl) return json({ error: "No multi-audio stream found on ACDN for this episode" }, 404);
        return json({
          success: true,
          server: "ACDN",
          audio: "multi",
          multiAudio: true,
          streamUrl: `${proxyBase}?url=${encodeURIComponent(r.streamUrl)}&referer=${encodeURIComponent(r.referer || "https://animesalt.cx/")}&seg=1`,
          subtitles: [],
          intro: null,
          outro: null,
        });
      } catch (e) {
        return json({ error: e.message || "ACDN resolution failed" }, 502);
      }
    }

    // FlixCloud: direct HLS from Re:Anime / FlixCloud (enc-dec / Web Crypto decrypted)
    if (server.startsWith("flixcloud")) {
      try {
        const r = await cached(`flixcloud:${anilistId}:${episode}:${audio}:1:${title}`, 10 * 60e3, () =>
          resolveFlixCloud({ anilistId, episode, audio, title, preferredServer: "1" })
        );
        if (!r?.streamUrl) return json({ error: `No ${audio.toUpperCase()} stream found on FlixCloud` }, 404);
        return json({
          success: true,
          server: "FlixCloud",
          audio: r.audio,
          streamUrl: `${proxyBase}?url=${encodeURIComponent(r.streamUrl)}&referer=${encodeURIComponent(r.referer || "https://flixcloud.cc/")}`,
          subtitles: r.subtitles || [],
          intro: r.intro,
          outro: r.outro,
        });
      } catch (e) {
        return json({ error: e.message || "FlixCloud resolution failed" }, 502);
      }
    }

    try {
      const r = await resolveDirectStreamWorker({ anilistId, episode, audio, server, title });
      if (!r?.streamUrl) return json({ error: `No ${audio.toUpperCase()} stream found on ${server}` }, 404);
      return json({
        success: true,
        server: r.server,
        audio: r.audio,
        streamUrl: `${proxyBase}?url=${encodeURIComponent(r.streamUrl)}&referer=${encodeURIComponent(r.referer || "https://megaplay.buzz/")}&seg=1`,
        subtitles: r.subtitles || [],
        intro: r.intro,
        outro: r.outro,
      });
    } catch (e) {
      return json({ error: e.message || "Stream resolution failed" }, 502);
    }
  }

  if (path === "/api/subtitles") {
    try {
      const subs = await subtitlesFor(parseInt(q("id", "0"), 10), q("title"), parseInt(q("ep", "1"), 10) || 1, q("format").toUpperCase());
      return json({ success: true, subtitles: subs }, 200, 3600);
    } catch {
      return json({ success: false, subtitles: [] }, 200);
    }
  }

  const mapMatch = path.match(/^\/api\/mapping\/(\d+)\/?$/);
  if (mapMatch) {
    const m = await mapOf(parseInt(mapMatch[1], 10));
    return m ? json({ success: true, data: m }, 200, 86400) : json({ success: false, data: null }, 200, 600);
  }

  if (path === "/api/tmdb") {
    const id = parseInt(q("id", "0"), 10);
    const title = q("title");
    if (!id && !title) return json({ error: "Missing id or title" }, 400);
    try {
      const r = await cached(`tmdb:${id}:${title}`, 24 * 3600e3, () => tmdbFor(id, title, q("format").toUpperCase()));
      return json({ success: !!r?.tmdb, mapping: r?.map ?? null, tmdb: r?.tmdb ?? null }, 200, 86400);
    } catch {
      return json({ success: false, mapping: null, tmdb: null }, 200, 300);
    }
  }

  // Search endpoint: /api/movies/search?q=dune&type=multi|movie|tv  ->  { results: [normalised titles] }
  if (path === "/api/movies/search") {
    const term = q("q").trim();
    const kind = ["movie", "tv"].includes(q("type")) ? q("type") : "multi";
    if (term.length < 2) return json({ results: [] }, 200, 60);
    try {
      const d = await cached(`msearch:${kind}:${term.toLowerCase()}`, 10 * 60e3, () => getJson(`${TMDB}/search/${kind}?query=${encodeURIComponent(term)}&include_adult=false&language=en-US`));
      const results = (d.results || [])
        .filter((r) => (r.media_type ? r.media_type === "movie" || r.media_type === "tv" : true) && r.poster_path)
        .slice(0, 20)
        .map((r) => ({
          id: r.id,
          type: r.media_type === "tv" || kind === "tv" ? "tv" : "movie",
          title: r.title || r.name,
          poster: r.poster_path,
          backdrop: r.backdrop_path || null,
          year: (r.release_date || r.first_air_date || "").slice(0, 4) || null,
          rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
          overview: r.overview || "",
          genreIds: r.genre_ids || [],
        }));
      return json({ results }, 200, 600);
    } catch {
      return json({ error: "Search is unavailable right now" }, 502);
    }
  }

  // Movies / TV catalogue: whitelisted read-only passthrough to the TMDB proxy, e.g. /api/movies/trending/movie/week
  if (path.startsWith("/api/movies/")) {
    const sub = path.slice("/api/movies/".length).replace(/\/+$/, "");
    const ok = /^(trending\/(movie|tv)\/(day|week)|(movie|tv)\/(popular|top_rated|now_playing|upcoming|airing_today|on_the_air)|discover\/(movie|tv)|search\/(movie|tv|multi)|(movie|tv)\/\d+(\/(similar|recommendations))?|tv\/\d+\/season\/\d+)$/.test(sub);
    if (!ok) return json({ error: "Unsupported path" }, 400);
    const qs = new URLSearchParams(url.searchParams);
    if (!qs.has("language")) qs.set("language", "en-US");
    qs.set("include_adult", "false");
    qs.sort();
    try {
      const d = await cached(`movies:${sub}?${qs}`, 10 * 60e3, () => getJson(`${TMDB}/${sub}?${qs}`));
      return json(d, 200, 600);
    } catch {
      return json({ error: "TMDB is unavailable right now" }, 502);
    }
  }

  if (path === "/api/tmdb/episodes") {
    const id = parseInt(q("id", "0"), 10);
    const season = parseInt(q("season", "1"), 10) || 1;
    if (!id) return json({ error: "Missing id" }, 400);

    if (season === 1) {
      try {
        const eg = await cached(`tmdb-eg:${id}`, 24 * 3600e3, () => getJson(`${TMDB}/tv/${id}/episode_groups`));
        const groups = eg?.results || [];
        const best =
          groups.find((g) => g.type === 2 && /no specials/i.test(g.name)) ||
          groups.find((g) => g.type === 2 && /absolute/i.test(g.name)) ||
          groups.find((g) => g.type === 2) ||
          groups.find((g) => /absolute|correct order/i.test(g.name));

        if (best) {
          const d = await cached(`tmdb-eps-grp:${best.id}`, 24 * 3600e3, () => getJson(`${TMDB}/tv/episode_group/${best.id}?language=en-US`));
          const pool = (d.groups || []).filter((g) => !/special/i.test(g.name || "") && g.order !== 0);
          const list = pool.length ? pool : d.groups || [];
          let chosen = [];
          if (list.length === 1) {
            chosen = list[0].episodes || [];
          } else if (list.length > 1) {
            const sorted = [...list].sort((a, b) => (b.episodes?.length || 0) - (a.episodes?.length || 0));
            const largest = sorted[0];
            const second = sorted[1];
            if (largest && (!second || (largest.episodes?.length || 0) > (second.episodes?.length || 0) * 2)) {
              chosen = largest.episodes || [];
            } else {
              const inOrder = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              chosen = inOrder.flatMap((g) => g.episodes || []);
            }
          }
          if (chosen.length > 0) {
            const episodes = chosen.map((e) => {
              const n = typeof e.order === "number" && e.order >= 0 ? e.order + 1 : Number(e.episode_number);
              return { n, name: e.name || null, overview: e.overview || null, still: e.still_path || null, runtime: e.runtime || null, air: e.air_date || null };
            });
            return json({ success: true, episodes }, 200, 86400);
          }
        }
      } catch {
        /* fallback to season 1 */
      }
    }

    try {
      const d = await cached(`tmdb-eps:${id}:${season}`, 24 * 3600e3, () => getJson(`${TMDB}/tv/${id}/season/${season}?language=en-US`));
      const episodes = (d.episodes || []).map((e) => ({ n: e.episode_number, name: e.name || null, overview: e.overview || null, still: e.still_path || null, runtime: e.runtime || null, air: e.air_date || null }));
      return json({ success: true, episodes }, 200, 86400);
    } catch {
      return json({ success: false, episodes: [] }, 200, 300); // client falls back to AniList
    }
  }

  if (path === "/api/filler") {
    // ponytail: AnimeFillerList has no API, so read its public show page (cached a day; it asks for a 10s crawl delay)
    // and guess the slug from the titles. Upgrade path: a build-time JSON bundle of all shows.
    const slugs = [...new Set(url.searchParams.getAll("t").flatMap(slugVariants).filter(Boolean))].slice(0, 6);
    for (const s of slugs) {
      const d = await fillerOf(s);
      if (d.max) return json({ success: true, ...d }, 200, 86400);
    }
    return json({ success: false }, 200, 3600);
  }

  if (path === "/api/embed/animesalt") {
    const anilistId = parseInt(q("id", "0"), 10);
    const format = q("format").toUpperCase();
    try {
      const r = await extractAnimeSaltPlayer({
        anilistId,
        episode: parseInt(q("ep", "1"), 10) || 1,
        title: q("title"),
        isMovie: q("isMovie") === "true" || format === "MOVIE",
        audio: q("audio", "multi"),
        server: q("server", "1"),
      });
      const two = ["2", "abyss"].includes(q("server", "1").toLowerCase());
      const embedUrl = r.success ? (two ? r.abyssUrl || r.myStreamUrl || r.embedUrl : r.myStreamUrl || r.abyssUrl || r.embedUrl) : null;
      return embedUrl ? json({ success: true, embedUrl }, 200, 1800) : json({ success: false, error: r.error || "Not found on AnimeSalt" }, 404);
    } catch (e) {
      return json({ success: false, error: e.message }, 500);
    }
  }

  if (path === "/api/embed/reanime") {
    const anilistId = parseInt(q("id", "0"), 10);
    const episode = parseInt(q("ep", "1"), 10) || 1;
    const audio = q("audio", "sub").toLowerCase();
    try {
      const embedUrl = await cached(`embed:reanime:${anilistId}:${episode}:${audio}`, 30 * 60e3, () =>
        resolveReanimeEmbed({ anilistId, episode, audio })
      );
      if (embedUrl) {
        if (q("format") === "json" || request.headers.get("accept")?.includes("application/json")) {
          return json({ success: true, embedUrl }, 200, 1800);
        }
        return new Response(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${embedUrl}"><script>location.replace(${JSON.stringify(embedUrl)})</script></head><body>Redirecting to <a href="${embedUrl}">ReAnime player</a>...</body></html>`,
          {
            status: 302,
            headers: {
              ...CORS,
              Location: embedUrl,
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=1800",
            },
          }
        );
      }
      return json({ success: false, error: "No ReAnime embed found for this episode" }, 404);
    } catch (e) {
      return json({ success: false, error: e.message }, 500);
    }
  }

  if (path === "/api/app/release") {
    try {
      if (!releaseSnap || Date.now() - releaseSnap.at > RELEASE_TTL) releaseSnap = { at: Date.now(), v: await loadAppRelease(env) };
      return json({ success: true, ...releaseSnap.v }, 200, 60);
    } catch (e) {
      if (releaseSnap) return json({ success: true, stale: true, ...releaseSnap.v }, 200, 30);
      return json({ success: false, error: String(e.message || e) }, 502);
    }
  }

  /* ---------- Novels (NovelFire / NovelFull / WebNovel) ---------- */
  if (path.startsWith("/api/novel/")) {
    const source = q("source", "novelfire");
    const engine = novelEngine.getSource(source);
    const page = parseInt(q("page", "1"), 10) || 1;
    const slug = q("slug");
    try {
      switch (path) {
        case "/api/novel/home":
          return json(await cached(`nhome:${source}:${page}`, 15 * 60e3, () => engine.getHome(page)), 200, 900);
        case "/api/novel/search": {
          const term = q("q").trim();
          if (!term) return json({ results: [] });
          return json({ results: await cached(`nsearch:${source}:${term}:${page}`, 10 * 60e3, () => engine.search(term, page)) }, 200, 600);
        }
        case "/api/novel/detail":
          if (!slug) return json({ error: "Missing novel slug" }, 400);
          return json({ detail: await cached(`ndetail:${source}:${slug}`, 3600e3, () => engine.getDetail(slug)) }, 200, 3600);
        case "/api/novel/chapters":
          if (!slug) return json({ error: "Missing novel slug" }, 400);
          return json(await cached(`nch:${source}:${slug}`, 3600e3, () => engine.getChapters(slug, page)), 200, 3600);
        case "/api/novel/read": {
          const novelSlug = q("novelSlug") || slug;
          const chapterSlug = q("chapterSlug") || q("ch") || "chapter-1";
          if (!novelSlug) return json({ error: "Missing novel slug" }, 400);
          const c = await cached(`nread:${source}:${novelSlug}:${chapterSlug}`, 2 * 3600e3, async () => {
            const r = await engine.getChapterContent(novelSlug, chapterSlug);
            return r.paragraphs?.length ? r : null; // never memoise failures
          });
          return c ? json(c, 200, 7200) : json({ ...(await engine.getChapterContent(novelSlug, chapterSlug)) }, 200);
        }
      }
    } catch (e) {
      return json({ error: "Novel source unavailable: " + e.message }, 502);
    }
    return json({ error: "Unknown novel route" }, 404);
  }

  /* ---------- Manga (five servers; see manga.js) ---------- */
  if (path.startsWith("/api/manga/")) {
    const source = manga.parseSource(q("source"));
    try {
      if (path === "/api/manga/sources") return json({ sources: manga.SOURCES, default: manga.DEFAULT_SOURCE }, 200, 3600);
      if (path === "/api/manga/home") return json(await cached(`mhome:${source}`, 15 * 60e3, () => manga.getHome(source)), 200, 900);
      if (path === "/api/manga/search") {
        const term = q("q").trim();
        return term ? json(await cached(`msearch:${source}:${term}`, 10 * 60e3, () => manga.search(term, source)), 200, 600) : json({ results: [] });
      }
      if (path === "/api/manga/chapters") {
        const id = q("id");
        if (!id) return json({ error: "Missing manga id" }, 400);
        return json(await cached(`mch:${source}:${id}`, 30 * 60e3, () => manga.getChapters(id, source)), 200, 1800);
      }
      if (path === "/api/manga/pages") {
        const chapterId = q("chapterId") || q("id");
        if (!chapterId) return json({ error: "Missing chapterId" }, 400);
        const ttl = source === "mangadex" ? 600 : 3600; // MangaDex image hosts rotate, keep those short
        const r = await cached(`mpg:${source}:${chapterId}`, ttl * 1e3, async () => {
          const x = await manga.getPages(chapterId, source);
          return x.pages.length ? x : null;
        });
        return json(r ?? { chapterId, pages: [] }, 200, r ? ttl : 0);
      }
    } catch (e) {
      return json({ error: `Manga source unavailable (${source}): ` + e.message }, 502);
    }
    return json({ error: "Unknown manga route" }, 404);
  }

  return null;
}
