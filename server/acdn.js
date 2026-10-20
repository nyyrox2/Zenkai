// ACDN: multi-audio direct streams, resolved server-side.
// Port of the Android app's MultiAudioExtractor.kt (CloudStream AnimeDekho flow by phisher98):
//   1. anime-mapping.json  -> saltId / season / episode for the AniList id
//   2. AnimeDekho          -> search, episode page, iframes, then the ?trdekho=0..4 players
//   3. AnimeSalt (fallback) -> options-0 / options-1 / loadMi() players
// Each player page is turned into a direct stream: AbyssPlayer (enc-dec.app), as-cdn / ravok getVideo
// (HLS master playlist with several audio tracks), player.php multi-language, Pixel, or a plain .m3u8 / .mp4.
// Only direct streams are returned - an iframe can't be played by Zenkai's own player.
import { ANIME_MAPPING, pickMapping } from "./mapping.js";
import { normalizeAnimeSaltTitle, cleanTitleForSlug, extractSeason } from "./animesalt.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEKHO = "https://animedekho.app";
const DEKHO_COOKIE = "toronites_server=vidstream";
const SALT_MIRRORS = ["https://animesalt.cx", "https://animesalt.ac", "https://animesalt.ro"];
const MAX_DEPTH = 3; // guards nested iframe -> iframe -> iframe chains

/* ---------------- HTTP helpers ---------------- */
async function httpGet(url, referer, cookie) {
  try {
    const headers = {
      "User-Agent": UA,
      Referer: referer,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    if (cookie) headers.Cookie = cookie;
    const r = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(14000) });
    if (!r.ok) return null;
    const text = await r.text();
    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

const abs = (u, base) => {
  try {
    return new URL(u, base).href;
  } catch {
    return u;
  }
};
const usable = (u) => !!u && u.trim() !== "" && u.trim().toLowerCase() !== "about:blank";
const decodeB64 = (raw) => {
  const clean = raw.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const bin = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

const direct = (url, referer, kind) => ({
  streamUrl: url,
  referer,
  kind: kind || (/\.m3u8(\?|$)/i.test(url) ? "hls" : "file"),
  isDirect: true,
});

/* ---------------- Player resolvers ---------------- */

/** AbyssPlayer: the page carries an encrypted `datas` blob that enc-dec.app decrypts into quality-tagged sources. */
async function decryptAbyss(encrypted) {
  try {
    const r = await fetch("https://enc-dec.app/api/dec-abyss", {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/json", Origin: "https://playhydrax.com", Referer: "https://playhydrax.com/" },
      body: JSON.stringify({ text: encrypted }),
      signal: AbortSignal.timeout(14000),
    });
    if (!r.ok) return null;
    const sources = (await r.json())?.result?.sources;
    if (!Array.isArray(sources)) return null;

    // 1080p h264 > 720p h264 > 1080p av1 > 720p av1 > 480p > 360p
    let best = null;
    let bestScore = -1;
    for (const s of sources) {
      if (!s || s.status === false || !s.url) continue;
      const type = String(s.type || "").toLowerCase();
      const codec = String(s.codec || "").toLowerCase();
      let score = type.includes("1080") ? 100 : type.includes("720") ? 70 : type.includes("480") ? 40 : 20;
      score += codec === "h264" ? 30 : codec === "av1" ? 10 : 0;
      if (score > bestScore) {
        bestScore = score;
        best = s.url;
      }
    }
    return best ? direct(best, "https://abyssplayer.com/", "file") : null;
  } catch {
    return null;
  }
}

async function resolveAbyss(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Origin: "https://playhydrax.com", Referer: "https://playhydrax.com/" },
      signal: AbortSignal.timeout(14000),
    });
    if (!r.ok) return null;
    const m = (await r.text()).match(/const\s+datas\s*=\s*"([^"]*)"/);
    return m ? decryptAbyss(m[1]) : null;
  } catch {
    return null;
  }
}

/** as-cdn / ravok / AWSStream: POST getVideo returns the HLS master playlist (several audio renditions). */
async function resolveAsCdn(domain, hash) {
  try {
    const r = await fetch(`https://${domain}/player/index.php?data=${hash}&do=getVideo`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Referer: `https://${domain}/video/${hash}`,
        Origin: `https://${domain}`,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams({ hash, r: "https://animesalt.cx/" }).toString(),
      signal: AbortSignal.timeout(14000),
    });
    if (!r.ok) return null;
    const body = (await r.text()).trim();
    if (!body.startsWith("{")) return null;
    const j = JSON.parse(body);
    const m3u8 = j.videoSource || j.securedLink || j.hls;
    return m3u8 ? direct(m3u8, `https://${domain}/`, "hls") : null;
  } catch {
    return null;
  }
}

/** player.php / multi-lang-plyr.php: `data=` is a base64 JSON array of { language, link }. */
async function resolveMultiLang(url, lang, depth) {
  try {
    const raw = url.match(/data=([a-zA-Z0-9%+/=_-]+)/)?.[1];
    if (!raw) return null;
    let b64 = raw;
    try {
      b64 = decodeURIComponent(raw);
    } catch {}
    const list = JSON.parse(decodeB64(b64));
    if (!Array.isArray(list)) return null;

    let want = null;
    let en = null;
    let hi = null;
    let first = null;
    for (const item of list) {
      const language = String(item?.language || "");
      const link = String(item?.link || "").replace(/\\\//g, "/");
      if (!link) continue;
      first ??= link;
      if (lang && language.toLowerCase().includes(lang.toLowerCase())) {
        want = link;
        break;
      }
      if (/english|dub/i.test(language)) en = link;
      if (/hindi/i.test(language)) hi = link;
    }
    const link = want ?? hi ?? en ?? first;
    if (!link) return null;
    return resolvePlayer(link, url, lang, depth + 1);
  } catch {
    return null;
  }
}

/** Pulls a stream out of a player page: nested iframe, as-cdn hash, Abyss blob, or a file:/source: config. */
async function resolveFromPage(pageUrl, referer, lang, depth) {
  const html = await httpGet(pageUrl, referer);
  if (!html) return null;

  const nested = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  if (usable(nested)) {
    const r = await resolvePlayer(abs(nested.trim(), pageUrl), pageUrl, lang, depth + 1);
    if (r) return r;
  }

  const cdn = html.match(/https?:\/\/(as-cdn\d*\.top)\/video\/([a-zA-Z0-9_-]+)/i);
  if (cdn) {
    const r = await resolveAsCdn(cdn[1], cdn[2]);
    if (r) return r;
  }

  const datas = html.match(/const\s+datas\s*=\s*"([^"]*)"/);
  if (datas) {
    const r = await decryptAbyss(datas[1]);
    if (r) return r;
  }

  const file = html.match(/(?:file|source|src)\s*:\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i)?.[1];
  return file ? direct(file, pageUrl) : null;
}

/** Any player url -> direct stream (or null). Mirrors resolveIframeToServer in MultiAudioExtractor.kt. */
async function resolvePlayer(iframeUrl, referer, lang = "", depth = 0) {
  if (!usable(iframeUrl) || depth > MAX_DEPTH) return null;
  const url = iframeUrl.trim();

  // 1. AbyssPlayer
  if (/abyssplayer\.com/i.test(url)) {
    const r = await resolveAbyss(url);
    if (r) return r;
  }

  // 2. as-cdn / ravok / any /video/<hash> CDN player
  const cdn = url.match(/https?:\/\/([a-zA-Z0-9_.-]+)\/video\/([a-zA-Z0-9_-]+)/i);
  if (cdn) {
    const r = await resolveAsCdn(cdn[1], cdn[2]);
    if (r) return r;
  }

  // 3. Multi-language player.php
  if (/player\.php|multi-lang-plyr\.php/i.test(url)) {
    const r = await resolveMultiLang(url, lang, depth);
    if (r) return r;
  }

  // 4. Pixel player (direct file)
  if (/pixel/i.test(url)) {
    const html = await httpGet(url, referer);
    const f = html?.match(/file\s*:\s*"([^"]+)"/i)?.[1];
    if (f) return direct(f.replace(/\\\//g, "/"), url);
  }

  // 5. Already a stream url
  if (/\.(m3u8|mp4)(\?|$)/i.test(url)) return direct(url, referer);

  // 6. Look inside the page
  return resolveFromPage(url, referer, lang, depth);
}

/* ---------------- AnimeDekho ---------------- */
async function findDekhoEpisodePage(title, season, episode, isMovie) {
  try {
    const searchUrl = `${DEKHO}/?s=${encodeURIComponent(title)}`;
    const html = await httpGet(searchUrl, `${DEKHO}/`, DEKHO_COOKIE);
    if (!html) return null;

    let links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*lnk-blk/gi)].map((m) => m[1]);
    if (!links.length) links = [...html.matchAll(/href="([^"]+)"[^>]*class="lnk-blk"/gi)].map((m) => m[1]);
    if (!links.length) return null;

    const seriesUrl = abs(links[0], DEKHO);
    const seriesHtml = await httpGet(seriesUrl, searchUrl, DEKHO_COOKIE);
    if (!seriesHtml) return null;
    if (isMovie) return seriesUrl;

    // Episode list: prefer the exact season, then fall back to a match on episode number alone.
    const items = [];
    for (const ul of seriesHtml.matchAll(/<ul[^>]+class="[^"]*seasons-lst[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi)) {
      for (const li of ul[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
        const href = li[1].match(/href="([^"]+)"/i)?.[1];
        const m = li[1].match(/<span>S(\d+)-E(\d+)<\/span>|E(\d+)|Episode\s*(\d+)/i);
        if (!href || !m) continue;
        const ep = Number(m[2] || m[3] || m[4] || m[1]);
        const se = m[2] ? Number(m[1]) : null;
        items.push({ href: abs(href, seriesUrl), ep, se });
      }
    }
    const exact = items.find((i) => i.ep === episode && i.se === season);
    if (exact) return exact.href;
    const loose = items.find((i) => i.ep === episode);
    if (loose) return loose.href;

    const epi = [...seriesHtml.matchAll(/href="([^"]*\/epi\/[^"]+)"/gi)].map((m) => m[1]);
    const hit = epi.find((l) => l.includes(`-${season}x${episode}/`)) || epi.find((l) => l.includes(`x${episode}/`) || l.includes(`-${episode}/`));
    return hit ? abs(hit, seriesUrl) : null;
  } catch {
    return null;
  }
}

async function fromAnimeDekho({ title, season, episode, finalEp = episode, isMovie, saltId, slugs = [] }, lang) {
  try {
    let epUrl = await findDekhoEpisodePage(title, season, episode, isMovie);
    if (!epUrl && finalEp !== episode) {
      epUrl = await findDekhoEpisodePage(title, season, finalEp, isMovie);
    }
    if (!epUrl) {
      const candidates = slugs.map((s) => `${DEKHO}/epi/${s}/`);
      for (const cand of candidates) {
        const html = await httpGet(cand, `${DEKHO}/`, DEKHO_COOKIE);
        if (html && html.length > 500) {
          epUrl = cand;
          break;
        }
      }
    }
    if (!epUrl) return null;

    const epHtml = await httpGet(epUrl, `${DEKHO}/`, DEKHO_COOKIE);
    if (!epHtml) return null;

    // iframes on the episode page (embed -> as-cdn -> getVideo)
    const iframes = [...epHtml.matchAll(/<iframe[^>]+src="([^"]+)"/gi)].map((m) => m[1].trim()).filter(usable);
    for (const src of iframes) {
      const r = await resolvePlayer(abs(src, epUrl), epUrl, lang);
      if (r) return { ...r, slug: epUrl.match(/\/epi\/([^/]+)/)?.[1] || slugs[0] };
    }

    // post id from the body class, then the trdekho=0..4 player slots
    const bodyClass = epHtml.match(/<body[^>]+class="([^"]+)"/i)?.[1] || "";
    const postId = bodyClass.match(/(?:term|postid)-(\d+)/)?.[1];
    if (postId) {
      const type = isMovie ? 1 : 2;
      for (let n = 0; n <= 4; n++) {
        const trUrl = `${DEKHO}/?trdekho=${n}&trid=${postId}&trtype=${type}`;
        const html = await httpGet(trUrl, epUrl, DEKHO_COOKIE);
        const src = html?.match(/<iframe[^>]+src="([^"]+)"/i)?.[1]?.trim();
        if (!usable(src)) continue;
        const r = await resolvePlayer(abs(src, trUrl), trUrl, lang);
        if (r) return { ...r, slug: epUrl.match(/\/epi\/([^/]+)/)?.[1] || slugs[0] };
      }
    }
  } catch {
    /* fall through to AnimeSalt */
  }
  return null;
}

/* ---------------- AnimeSalt fallback ---------------- */
function optionIframe(html, id, base) {
  const m = html.match(new RegExp(`<div[^>]+id=["']${id}["'][^>]*>[\\s\\S]*?<iframe[^>]+(?:data-src|src)=["']([^"']+)["']`, "i"));
  const u = m?.[1]?.trim();
  return usable(u) ? abs(u, base) : null;
}

async function fromAnimeSalt({ saltId, slugs = [], isMovie }, lang) {
  for (const s of slugs) {
    const path = isMovie ? `/movies/${s}/` : `/episode/${s}/`;
    for (const mirror of SALT_MIRRORS) {
      try {
        const html = await httpGet(`${mirror}${path}`, `${mirror}/`);
        if (!html) continue;

        for (const opt of ["options-0", "options-1"]) {
          const u = optionIframe(html, opt, mirror);
          if (!u) continue;
          const r = await resolvePlayer(u, `${mirror}/`, lang);
          if (r) return { ...r, slug: s };
        }

        for (const m of html.matchAll(/loadMi\(\{\s*value:\s*'([^']+)'/gi)) {
          try {
            const src = decodeB64(m[1]).match(/<iframe[^>]*(?:data-src|src)=["']([^"']+)["']/i)?.[1]?.trim();
            if (!usable(src)) continue;
            const r = await resolvePlayer(abs(src, mirror), `${mirror}/`, lang);
            if (r) return { ...r, slug: s };
          } catch {
            /* next button */
          }
        }
      } catch {
        /* next mirror */
      }
    }
  }
  return null;
}

/* ---------------- Public API ---------------- */

/** AniList id + episode -> { saltId, season, episode, finalEp, isMovie, slug, mapped }. Strict mapping only. */
export function resolveCandidate({ anilistId, episode = 1, title = "", isMovie = false, mapping = ANIME_MAPPING }) {
  const mapped = pickMapping(mapping, anilistId, episode, isMovie);
  if (mapped) return { ...mapped, mapped: true };
  return null;
}

export function getCandidateSlugsForAcdn({ saltId, season = 1, episode = 1, slug, isMovie = false }) {
  if (slug) return [slug];
  if (isMovie) return [saltId];
  return [`${saltId}-${season}x${episode}`];
}

/**
 * Resolves the ACDN multi-audio stream for one episode.
 * Returns { streamUrl, referer, kind: 'hls' | 'file', mapped, slug } or null.
 */
export async function resolveAcdn({ anilistId, episode = 1, title = "", isMovie = false, lang = "" }) {
  const cand = resolveCandidate({ anilistId, episode, title, isMovie });
  if (!cand || !cand.saltId) return null;
  const slugs = getCandidateSlugsForAcdn({
    saltId: cand.saltId,
    season: cand.season,
    episode: cand.episode,
    slug: cand.slug,
    isMovie: cand.isMovie,
  });
  const slug = cand.slug || slugs[0];
  const ctx = {
    title,
    season: cand.season,
    episode: cand.episode,
    finalEp: cand.episode,
    isMovie: cand.isMovie,
    saltId: cand.saltId,
    slug,
    slugs,
  };

  const hit = (await fromAnimeSalt(ctx, lang)) || (await fromAnimeDekho(ctx, lang));
  return hit ? { ...hit, mapped: true, slug: hit.slug || slug } : null;
}
