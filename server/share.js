// Share-card (OG) tags for /anime/:id and /mal/:id. Bots don't run JS, so the tags are injected at the edge.
import { tmdbFor } from "./handler.js";

const BOT = /meta-external|instagram|facebook|bot|crawl|spider|facebookexternalhit|facebot|whatsapp|telegram|discord|slack|twitter|linkedin|pinterest|skype|vkshare|embedly|preview|iMessage|applebot|redditbot|mastodon|signal|viber|line\//i;
const TMDB_IMG = "https://image.tmdb.org/t/p/w1280";
const plain = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const memo = new Map();
async function cardFor(kind, id) {
  const key = `${kind}:${id}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.v;

  const query = `query($id:Int){Media(${kind === "mal" ? "idMal" : "id"}:$id,type:ANIME){id format description(asHtml:false) bannerImage coverImage{extraLarge large} title{romaji english}}}`;
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { id: Number(id) } }),
  });
  if (!r.ok) return null;
  const m = (await r.json())?.data?.Media;
  if (!m) return null;

  const title = m.title.english || m.title.romaji;
  let image = null;
  try {
    const { tmdb } = await tmdbFor(m.id, m.title.romaji || title, m.format);
    const pick = tmdb?.backdrops?.[0] || tmdb?.backdrop;
    if (pick) image = TMDB_IMG + pick;
  } catch {}
  image = image || m.bannerImage || m.coverImage?.extraLarge || m.coverImage?.large || null;

  const v = { title, desc: clip(plain(m.description || ""), 200), image };
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
