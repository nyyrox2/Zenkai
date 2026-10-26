// Share-card (OG) tags for /anime/:id, /mal/:id, /movies/:type/:id and /manga/:id.
// Bots don't run JS, so the tags are injected at the edge. Every card walks a chain of sources and never
// fails just because one of them is down: TMDB art -> AniList banner -> AniList cover -> Jikan/MAL cover -> site default.
import { tmdbFor, mapOf } from "./handler.js";

const BOT = /meta-external|instagram|facebook|bot|crawl|spider|facebookexternalhit|facebot|whatsapp|telegram|discord|slack|twitter|linkedin|pinterest|skype|vkshare|embedly|preview|iMessage|applebot|redditbot|mastodon|signal|viber|line\//i;
const TMDB = "https://aniversee.vercel.app/api/tmdb";
const TMDB_IMG = "https://image.tmdb.org/t/p/w1280";
const UA = "Mozilla/5.0 (compatible; ZenkaiShare/1.0)";
const plain = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const httpsUrl = (u) => (typeof u === "string" && /^https:\/\/[^\s"'<>]+$/i.test(u) && u.length < 600 ? u : null);

/** Chat apps give up on a link preview after a few seconds, so every upstream gets a short leash. */
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

const memo = new Map();
const remember = (key, v) => { memo.set(key, { at: Date.now(), v }); return v; };
const recall = (key) => { const hit = memo.get(key); return hit && Date.now() - hit.at < 6 * 3600e3 ? hit.v : null; };

async function getJson(url, ms = 3500) {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/** Own AniList GraphQL call (direct, no third party). One retry on 429/5xx; successful results go in the Cloudflare edge cache. */
async function anilistMedia(cacheKey, query, variables) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const ck = new Request(`https://share-cache.invalid/anilist/${cacheKey}`);
  const hit = cache && (await cache.match(ck).catch(() => null));
  if (hit) return { m: await hit.json(), why: "" };

  let why = "";
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(3500),
      });
      if (r.ok) {
        const m = (await r.json())?.data?.Media || null;
        if (!m) return { m: null, why: "anilist empty" };
        if (cache) await cache.put(ck, new Response(JSON.stringify(m), { headers: { "Cache-Control": "public, max-age=86400" } })).catch(() => {});
        return { m, why: "" };
      }
      why = `anilist ${r.status}`;
      if (r.status !== 429 && r.status < 500) break;
      await new Promise((ok) => setTimeout(ok, 300));
    } catch (e) {
      why = "anilist " + String(e?.message || e).slice(0, 40);
    }
  }
  return { m: null, why };
}

const ANIME_Q = (by) => `query($id:Int){Media(${by}:$id,type:ANIME){id format description(asHtml:false) bannerImage coverImage{extraLarge large} title{romaji english}}}`;
const MANGA_SEARCH_Q = `query($s:String){Media(search:$s,type:MANGA,sort:SEARCH_MATCH){id description(asHtml:false) bannerImage coverImage{extraLarge large} title{romaji english}}}`;

/** Jikan (MyAnimeList) is the last resort for anime when AniList is unreachable from the edge. */
async function jikanAnime(malId) {
  const d = (await getJson(`https://api.jikan.moe/v4/anime/${malId}`))?.data;
  if (!d?.title) throw new Error("jikan empty");
  return {
    title: d.title_english || d.title,
    desc: clip(plain(d.synopsis || ""), 200),
    image: httpsUrl(d.images?.jpg?.large_image_url) || httpsUrl(d.images?.jpg?.image_url),
  };
}

/* ---------------- anime ---------------- */
async function animeCard(kind, id) {
  const { m, why } = await anilistMedia(`${kind}/${id}`, ANIME_Q(kind === "mal" ? "idMal" : "id"), { id: Number(id) });

  if (m) {
    const title = m.title.english || m.title.romaji;
    let image = null;
    try {
      const { tmdb } = await withTimeout(tmdbFor(m.id, m.title.romaji || title, m.format), 3000);
      const pick = tmdb?.backdrops?.[0] || tmdb?.backdrop;
      if (pick) image = TMDB_IMG + pick;
    } catch {}
    // TMDB has nothing (or is down): AniList's own banner, then its cover
    image = image || httpsUrl(m.bannerImage) || httpsUrl(m.coverImage?.extraLarge) || httpsUrl(m.coverImage?.large);
    return { title, desc: clip(plain(m.description || ""), 200), image };
  }

  // AniList unreachable: map to TMDB / MAL ourselves
  let malId = kind === "mal" ? Number(id) : null;
  if (kind === "anilist") {
    try {
      const { tmdb, map } = await withTimeout(tmdbFor(Number(id), "", null), 3500);
      malId = map?.mal || null;
      if (tmdb?.name) {
        const pick = tmdb.backdrops?.[0] || tmdb.backdrop;
        return { title: tmdb.name, desc: clip(plain(tmdb.overview || ""), 200), image: pick ? TMDB_IMG + pick : null };
      }
    } catch {
      malId = (await withTimeout(mapOf(Number(id)), 2500).catch(() => null))?.mal || null;
    }
  }
  if (malId) return jikanAnime(malId);
  throw new Error(why || "no source");
}

/* ---------------- movies / tv (TMDB id) ---------------- */
async function movieCard(type, id, hint) {
  const kind = type === "tv" ? "tv" : "movie";
  try {
    const d = await getJson(`${TMDB}/${kind}/${id}?language=en-US`);
    const title = d.title || d.name;
    if (!title) throw new Error("tmdb empty");
    const year = (d.release_date || d.first_air_date || "").slice(0, 4);
    const pick = d.backdrop_path || d.poster_path;
    return {
      title: year ? `${title} (${year})` : title,
      plainTitle: title,
      desc: clip(plain(d.overview || ""), 200),
      image: pick ? (d.backdrop_path ? TMDB_IMG : "https://image.tmdb.org/t/p/w780") + pick : null,
    };
  } catch (e) {
    // TMDB proxy down: the share link carries the title, so the card still has a name
    if (hint.title) return { title: hint.title, plainTitle: hint.title, desc: "", image: null };
    throw e;
  }
}

/* ---------------- manga (any source id; the link carries ?title=&cover=) ---------------- */
async function mangaCard(hint) {
  const title = hint.title;
  if (!title) throw new Error("no title");
  // Manga ids belong to the reading source, so AniList is matched by title (banner first, then cover)
  const { m } = await anilistMedia(`manga/${title.toLowerCase().slice(0, 80)}`, MANGA_SEARCH_Q, { s: title });
  const image = (m && (httpsUrl(m.bannerImage) || httpsUrl(m.coverImage?.extraLarge) || httpsUrl(m.coverImage?.large))) || hint.cover;
  return {
    title,
    plainTitle: title,
    desc: m ? clip(plain(m.description || ""), 200) : "",
    image,
  };
}

async function cardFor(kind, id, type, hint) {
  const key = `${kind}:${type || ""}:${id}:${hint.title || ""}`;
  const hit = recall(key);
  if (hit) return hit;
  const v = kind === "movie" ? await movieCard(type, id, hint) : kind === "manga" ? await mangaCard(hint) : await animeCard(kind, id);
  return remember(key, v);
}

const KINDS = {
  anilist: { ogType: "video.tv_show", suffix: "Watch Free on Zenkai", fallback: (t) => `Watch ${t} online free in HD with English Sub & Dub on Zenkai.` },
  mal: { ogType: "video.tv_show", suffix: "Watch Free on Zenkai", fallback: (t) => `Watch ${t} online free in HD with English Sub & Dub on Zenkai.` },
  movie: { ogType: "video.movie", suffix: "Watch Free on Zenkai", fallback: (t) => `Watch ${t} online free in HD on Zenkai.` },
  tv: { ogType: "video.tv_show", suffix: "Watch Free on Zenkai", fallback: (t) => `Watch ${t} online free in HD on Zenkai.` },
  manga: { ogType: "book", suffix: "Read Free on Zenkai", fallback: (t) => `Read ${t} online free on Zenkai.` },
};

export async function shareCard({ request, env, kind, id, type }) {
  const ua = request.headers.get("user-agent") || "";
  const reqUrl = new URL(request.url);
  const asset = await env.ASSETS.fetch(new URL("/", request.url));
  const tag = (res, why) => { const r = new Response(res.body, res); r.headers.set("X-Share", why); return r; };

  const isManga = kind === "manga";
  const isMovie = kind === "movie";
  if (isMovie ? !(/^\d+$/.test(id) && (type === "movie" || type === "tv")) : isManga ? !/^[\w.\-~%:]{1,160}$/.test(id) || id === "browse" || id === "find" : !/^\d+$/.test(id)) return tag(asset, "bad-id");

  // Real browsers get the plain SPA; anything else (any crawler/unknown agent) gets the tags. ?og=1 forces it for testing.
  const browser = /Mozilla\/5\.0.*(Chrome|Safari|Firefox|Edg)\//.test(ua) && !BOT.test(ua);
  if (browser && reqUrl.searchParams.get("og") !== "1") return tag(asset, "browser");

  const hint = { title: clip(plain(reqUrl.searchParams.get("title") || reqUrl.searchParams.get("t") || ""), 140), cover: httpsUrl(reqUrl.searchParams.get("cover")) };
  let c = null, err = "";
  try { c = await cardFor(kind, id, type, hint); } catch (e) { err = String(e?.message || e).slice(0, 80); }
  if (!c) return tag(asset, "no-data " + err);

  const cfg = KINDS[isMovie ? type : kind];
  const url = request.url;
  const name = c.plainTitle || c.title;
  const title = `${c.title} — ${cfg.suffix}`;
  const desc = c.desc || cfg.fallback(name);
  const set = (value) => ({ element: (e) => e.setAttribute("content", value) });
  const rw = new HTMLRewriter()
    .on("title", { element: (e) => e.setInnerContent(title) })
    .on('meta[property="og:type"]', set(cfg.ogType))
    .on('meta[property="og:url"]', set(url))
    .on('link[rel="canonical"]', { element: (e) => e.setAttribute("href", url) })
    .on('meta[property="og:title"], meta[name="twitter:title"]', set(title))
    .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', set(desc))
    .on('meta[property="og:image:alt"], meta[name="twitter:image:alt"]', set(name));
  if (c.image) {
    rw.on('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]', set(c.image))
      .on('meta[property="og:image:type"]', { element: (e) => e.remove() })
      .on('meta[property="og:image:width"], meta[property="og:image:height"]', { element: (e) => e.remove() });
  }
  return new Response(rw.transform(asset).body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Share": c.image ? "ok" : "ok-noimage" } });
}
