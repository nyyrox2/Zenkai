// Manga servers. WeebCentral, ComicK, Manhua, Asura Scans and Demonic Scans go through the Zenkai manga worker that the
// Android app uses (the server is chosen with its `source` parameter); MangaDex is queried directly (mangadex.js).
// Every payload is normalised here, so the UI only ever sees { id, title, poster, source, ... },
// { chapterId, number, title } and string[] of page urls, whichever server it came from.
import * as dex from "./mangadex.js";
import * as demonic from "./demonicscans.js";

const WORKER = "https://brhgxkmnoken-mud-a7f7nyroxx.ammhfoo.workers.dev";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const SOURCES = ["weebcentral", "demonicscans", "comick", "manhua", "asura", "mangadex"];
export const DEFAULT_SOURCE = "weebcentral";

/** Unknown or missing ids mean the default server. "mh" is the Manhua alias, as in the app. */
export function parseSource(id) {
  const s = String(id || "").trim().toLowerCase();
  if (s === "mh") return "manhua";
  if (s === "ds" || s === "demonic" || s === "demonicscans") return "demonicscans";
  if (s === "wc" || s === "weeb" || s === "webtoon") return "weebcentral";
  return SOURCES.includes(s) ? s : DEFAULT_SOURCE;
}

async function call(params, source) {
  const q = new URLSearchParams(params);
  if (source !== DEFAULT_SOURCE) q.set("source", source); // the default server is what the worker answers with when asked nothing
  const r = await fetch(`${WORKER}/?${q}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`manga worker ${r.status} (${source})`);
  return r.json();
}

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const listOf = (d, ...keys) => {
  if (Array.isArray(d)) return d;
  for (const k of keys) if (Array.isArray(d?.[k])) return d[k];
  return [];
};

export function normalizeManga(m, source = DEFAULT_SOURCE) {
  const title = typeof m.title === "string" ? m.title : m.title?.english || m.title?.romaji || m.name || "Untitled";
  const id = str(m.id ?? m.mangaId ?? m.slug);
  if (!id) return null;
  return {
    id,
    title,
    poster: m.poster || m.cover || m.image || m.thumbnail || m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium || "",
    type: m.type || m.format || null,
    status: m.status || null,
    latest: m.latestChapter || m.latest || m.chapter || null,
    updated: m.updated || null,
    score: m.averageScore ? Math.round(m.averageScore) / 10 : m.rating ? Number(m.rating) || null : null,
    chapters: m.chapters ?? null,
    source,
  };
}

const dedupe = (arr) => {
  const seen = new Set();
  return arr.filter((m) => m && !seen.has(m.id) && seen.add(m.id));
};

export async function getHome(source = DEFAULT_SOURCE) {
  if (source === "mangadex") return dex.getHome();
  if (source === "demonicscans") return demonic.getHome();
  const d = await call({ action: "home" }, source);
  const pick = (...k) => dedupe(listOf(d, ...k).map((m) => normalizeManga(m, source)));
  return { trending: pick("trending"), latest: pick("latest"), newRelease: pick("newRelease", "new", "newReleases") };
}

export async function search(q, source = DEFAULT_SOURCE) {
  if (source === "mangadex") return dex.search(q);
  if (source === "demonicscans") return demonic.search(q);
  const d = await call({ action: "search", q }, source);
  return { results: dedupe(listOf(d, "results", "data").map((m) => normalizeManga(m, source))) };
}

export async function getChapters(id, source = DEFAULT_SOURCE) {
  if (source === "mangadex") return dex.getChapters(id);
  if (source === "demonicscans") return demonic.getChapters(id);
  const d = await call({ action: "chapters", id }, source);
  const chapters = listOf(d, "chapters", "results", "data")
    .map((c, i) => {
      const number = str(c.number ?? c.chapter ?? i + 1);
      const chapterId = str(c.chapterId ?? c.id);
      if (!chapterId) return null;
      return {
        chapterId,
        number,
        title: c.title && !/^chapter\s/i.test(c.title) ? c.title : null,
        date: c.releaseDate || c.date || null,
        group: c.group || null,
        volume: c.volume != null ? str(c.volume) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
  return { id, chapters };
}

export async function getPages(chapterId, source = DEFAULT_SOURCE) {
  if (source === "mangadex") return dex.getPages(chapterId);
  if (source === "demonicscans") return demonic.getPages(chapterId);
  const d = await call({ action: "pages", chapterId }, source);
  const pages = listOf(d, "pages", "images", "data")
    .map((p) => (typeof p === "string" ? p : p?.url || p?.src || ""))
    .filter((u) => /^https?:\/\//.test(u));
  return { chapterId, pages };
}
