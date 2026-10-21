// Share-card (OG) tags for /anime/:id and /mal/:id. Bots don't run JS, so the tags are injected at the edge.
import { tmdbFor } from "./handler.js";

const BOT = /meta-external|instagram|facebook|bot|crawl|spider|facebookexternalhit|facebot|whatsapp|telegram|discord|slack|twitter|linkedin|pinterest|skype|vkshare|embedly|preview|iMessage|applebot|redditbot|mastodon|signal|viber|line\//i;
const TMDB_IMG = "https://image.tmdb.org/t/p/w1280";
const plain = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const memo = new Map();

/** Own AniList GraphQL call (direct, no third party). One retry on 429/5xx; successful results go in the Cloudflare edge cache. */
async function anilist(kind, id) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const ck = new Request(`https://share-cache.invalid/anilist/${kind}/${id}`);
  const hit = cache && (await cache.match(ck).catch(() => null));
  if (hit) return { m: await hit.json(), why: "" };

  const query = `query($id:Int){Media(${kind === "mal" ? "idMal" : "id"}:$id,type:ANIME){id format description(asHtml:false) bannerImage coverImage{extraLarge large} title{romaji english}}}`;
  let why = "";
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; ZenkaiShare/1.0)" },
        body: JSON.stringify({ query, variables: { id: Number(id) } }),
      });
      if (r.ok) {
        const m = (await r.json())?.data?.Media || null;
        if (!m) return { m: null, why: "anilist empty" };
        if (cache) await cache.put(ck, new Response(JSON.stringify(m), { headers: { "Cache-Control": "public, max-age=86400" } })).catch(() => {});
        return { m, why: "" };
      }
      why = `anilist ${r.status}`;
      if (r.status !== 429 && r.status < 500) break;
      await new Promise((ok) => setTimeout(ok, 400));
    } catch (e) {
      why = "anilist " + String(e?.message || e).slice(0, 40);
    }
  }
  return { m: null, why };
}
async function cardFor(kind, id) {
  const key = `${kind}:${id}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.v;

  const { m, why } = await anilist(kind, id);

  let title, desc = "", image = null;
  if (m) {
    title = m.title.english || m.title.romaji;
    desc = clip(plain(m.description || ""), 200);
    try {
      const { tmdb } = await tmdbFor(m.id, m.title.romaji || title, m.format);
      const pick = tmdb?.backdrops?.[0] || tmdb?.backdrop;
      if (pick) image = TMDB_IMG + pick;
    } catch {}
    image = image || m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large || null;
  } else if (kind === "anilist") {
    // AniList unreachable from the edge: AniBridge/ARM mapping -> TMDB gives title, overview and backdrop on its own
    try {
      const { tmdb } = await tmdbFor(Number(id), "", null);
      if (!tmdb?.name) throw new Error("tmdb none");
      title = tmdb.name;
      desc = clip(plain(tmdb.overview || ""), 200);
      const pick = tmdb.backdrops?.[0] || tmdb.backdrop;
      if (pick) image = TMDB_IMG + pick;
    } catch (e) { throw new Error(why + "; tmdb " + String(e?.message || e).slice(0, 40)); }
  } else throw new Error(why);

  const v = { title, desc, image };
  memo.set(key, { at: Date.now(), v });
  return v;
}

export async function shareCard({ request, env, kind, id }) {
  const ua = request.headers.get("user-agent") || "";
  const asset = await env.ASSETS.fetch(new URL("/", request.url));
  const tag = (res, why) => { const r = new Response(res.body, res); r.headers.set("X-Share", why); return r; };
  if (!/^\d+$/.test(id)) return tag(asset, "bad-id");
  // Real browsers get the plain SPA; anything else (any crawler/unknown agent) gets the tags. ?og=1 forces it for testing.
  const browser = /Mozilla\/5\.0.*(Chrome|Safari|Firefox|Edg)\//.test(ua) && !BOT.test(ua);
  if (browser && new URL(request.url).searchParams.get("og") !== "1") return tag(asset, "browser");

  let c = null, err = "";
  try { c = await cardFor(kind, id); } catch (e) { err = String(e?.message || e).slice(0, 80); }
  if (!c) return tag(asset, "no-data " + err);

  const url = request.url;
  const title = `${c.title} — Watch Free on Zenkai`;
  const desc = c.desc || `Watch ${c.title} online free in HD with English Sub & Dub on Zenkai.`;
  const set = (attr, value) => ({ element: (e) => e.setAttribute("content", value) });
  const rw = new HTMLRewriter()
    .on("title", { element: (e) => e.setInnerContent(title) })
    .on('meta[property="og:type"]', { element: (e) => e.setAttribute("content", "video.tv_show") })
    .on('meta[property="og:url"]', set("content", url))
    .on('link[rel="canonical"]', { element: (e) => e.setAttribute("href", url) })
    .on('meta[property="og:title"], meta[name="twitter:title"]', set("content", title))
    .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', set("content", desc))
    .on('meta[property="og:image:alt"], meta[name="twitter:image:alt"]', set("content", c.title));
  if (c.image) {
    rw.on('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]', set("content", c.image))
      .on('meta[property="og:image:type"]', { element: (e) => e.remove() })
      .on('meta[property="og:image:width"], meta[property="og:image:height"]', { element: (e) => e.remove() });
  }
  const out = new Response(rw.transform(asset).body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Share": c.image ? "ok" : "ok-noimage" } });
  return out;
}
