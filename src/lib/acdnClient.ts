/**
 * Browser-side ACDN / AbyssPlayer resolver (needs the Zenkai Companion extension >= 1.2.0).
 *
 * Why this exists: ravok.buzz / as-cdn hand out IP-bound `secure_link` tokens. When the Cloudflare Worker
 * resolves the stream and the browser (or another Worker) plays it, the IPs differ and the CDN answers 403.
 * It works on localhost and in the Android app because the same device resolves AND plays.
 *
 * Here the browser does the resolving itself (same flow as server/acdn.js and MultiAudioExtractor.kt), so the
 * token is minted for the viewer's own IP and the stream plays directly, with no proxy in the middle.
 * The extension (extension/rules.json) supplies what a page cannot: Referer / Origin / Cookie / X-Requested-With
 * for the provider hosts and CORS headers on their responses.
 *
 * Only the AbyssPlayer decrypt call (pure compute, enc-dec.app) goes through the Zenkai API.
 * Everything here returns null on failure, the caller then falls back to the server-side resolver.
 */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const apiUrl = (path: string) => (path.startsWith('/') ? BASE + path : path)

const DEKHO = 'https://animedekho.app'
const SALT_MIRRORS = ['https://animesalt.cx', 'https://animesalt.ac', 'https://animesalt.ro']
const MAX_DEPTH = 3

/** hosts the extension has dedicated header + CORS rules for; every other host gets the `__zk=1` marker rule */
const KNOWN_HOST = /(^|\.)(animesalt\.(cx|ac|ro)|animedekho\.app|ravok\.buzz|as-cdn\d*\.top|acdn\.top|abyssplayer\.com|playhydrax\.com)$/i
const mark = (url: string) => (url.includes('__zk=') ? url : url + (url.includes('?') ? '&' : '?') + '__zk=1')
const forFetch = (url: string) => {
  try {
    return KNOWN_HOST.test(new URL(url).hostname) ? url : mark(url)
  } catch {
    return url
  }
}

export interface ClientSub {
  file: string
  label: string
  default?: boolean
}
export interface ClientStream {
  streamUrl: string
  referer: string
  kind: 'hls' | 'file'
  subtitles: ClientSub[]
  slug?: string
}
export interface ClientQuery {
  anilistId: number
  episode: number
  title: string
  isMovie: boolean
  /** "English" | "Japanese" | "" (preferred audio language for the multi-language players) */
  lang: string
}

/* ---------------- anime-mapping.json (same file the server bundles) ---------------- */
interface MapEntry {
  saltId?: string
  season?: number | null
  startEpisode?: number
  episodeOffset?: number
}
interface Cand {
  saltId: string
  season: number
  episode: number
  isMovie: boolean
  slug: string
}
let mappingP: Promise<Record<string, MapEntry | MapEntry[]>> | undefined
const loadMapping = () =>
  (mappingP ??= fetch('/anime-mapping.json')
    .then((r) => r.json())
    .catch((e) => {
      mappingP = undefined
      throw e
    }))

/** Port of server/mapping.js pickMapping */
export function pickMapping(mapping: Record<string, MapEntry | MapEntry[]>, anilistId: number, episode = 1, isMovie = false): Cand | null {
  const raw = mapping?.[String(anilistId).trim()]
  if (!raw) return null
  const entries = Array.isArray(raw) ? raw : [raw]
  const sorted = [...entries].sort((a, b) => (b.startEpisode || 1) - (a.startEpisode || 1))
  const picked = sorted.find((e) => episode >= (e.startEpisode || 1)) || entries[0]
  if (!picked?.saltId) return null
  const ep = picked.episodeOffset !== undefined ? Math.max(1, episode + picked.episodeOffset) : episode
  const isMov = !!isMovie || picked.season === null || picked.season === 0
  const slug = isMov ? picked.saltId : `${picked.saltId}-${picked.season ?? 1}x${ep}`
  return { saltId: picked.saltId, season: picked.season ?? 1, episode: ep, isMovie: isMov, slug }
}

const candidateSlugs = (c: Cand) => [c.slug, `private-${c.slug}`]

/* ---------------- small helpers ---------------- */
const abs = (u: string, base: string) => {
  try {
    return new URL(u, base).href
  } catch {
    return u
  }
}
const usable = (u?: string | null): u is string => !!u && u.trim() !== '' && u.trim().toLowerCase() !== 'about:blank'
const decodeB64 = (raw: string) => {
  const clean = raw.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')
  const bin = atob(clean + '='.repeat((4 - (clean.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}
const direct = (url: string, referer: string, kind?: 'hls' | 'file', subtitles: ClientSub[] = []): ClientStream => ({
  streamUrl: url,
  referer,
  kind: kind ?? (/\.m3u8(\?|$)/i.test(url) ? 'hls' : 'file'),
  subtitles,
})

function extractSubtitles(html: string | null, domain = 'ravok.buzz'): ClientSub[] {
  if (!html) return []
  const subs: ClientSub[] = []

  const pjs = html.match(/playerjsSubtitle\s*=\s*["']([^"']+)["']/i) || html.match(/Subtitle\s*=\s*["'](\[[^"']+\]https?[^"']+)["']/i)
  if (pjs?.[1]) {
    for (const part of pjs[1].trim().split(/,(?=\[|https?:\/\/)/)) {
      const p = part.trim()
      if (!p) continue
      const m = p.match(/^\[([^\]]+)\](.*)$/)
      if (m) {
        let file = m[2].trim()
        if (file.startsWith('//')) file = `https:${file}`
        if (file.startsWith('http')) subs.push({ label: m[1].trim(), file })
      } else if (p.startsWith('http') || p.startsWith('//')) {
        subs.push({ label: 'English', file: p.startsWith('//') ? `https:${p}` : p })
      }
    }
  }

  for (const tm of html.matchAll(/<track[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)) {
    let file = tm[1].trim()
    if (file.startsWith('//')) file = `https:${file}`
    else if (file.startsWith('/')) file = `https://${domain}${file}`
    const label = tm[0].match(/label=["']([^"']+)["']/i)?.[1] || tm[0].match(/srclang=["']([^"']+)["']/i)?.[1] || 'English'
    if (file.startsWith('http') && !subs.some((s) => s.file === file)) subs.push({ label, file })
  }
  return subs
}

/* ---------------- resolver (one instance per resolve, shares a time budget) ---------------- */
function createResolver(budgetMs: number) {
  const deadline = Date.now() + budgetMs
  const left = () => deadline - Date.now()
  const expired = () => left() <= 400

  /** GET / POST text with a timeout; null on any failure. Never sends cookies (the extension sets what is needed). */
  async function fetchText(url: string, init: RequestInit = {}, ms = 14000): Promise<string | null> {
    if (expired()) return null
    const ctl = new AbortController()
    const t = window.setTimeout(() => ctl.abort(), Math.max(1, Math.min(ms, left())))
    try {
      const r = await fetch(url, { redirect: 'follow', ...init, credentials: 'omit', signal: ctl.signal })
      if (!r.ok) return null
      return await r.text()
    } catch {
      return null
    } finally {
      window.clearTimeout(t)
    }
  }
  const httpGet = async (url: string) => {
    const t = await fetchText(forFetch(url))
    return t && t.length > 50 ? t : null
  }

  /* ----- AbyssPlayer ----- */
  async function decryptAbyss(encrypted: string): Promise<ClientStream | null> {
    if (expired()) return null
    const ctl = new AbortController()
    const t = window.setTimeout(() => ctl.abort(), Math.max(1, Math.min(15000, left())))
    try {
      const r = await fetch(apiUrl('/api/stream/decrypt'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Zenkai-Embed': '1' },
        body: JSON.stringify({ text: encrypted }),
        signal: ctl.signal,
      })
      if (!r.ok) return null
      const j = (await r.json().catch(() => null)) as { url?: string } | null
      // sssrr.org 302s to a trycloudflare.com tunnel: the <video> element follows that itself in the browser
      return j?.url ? direct(j.url, 'https://abyssplayer.com/', 'file') : null
    } catch {
      return null
    } finally {
      window.clearTimeout(t)
    }
  }
  async function resolveAbyss(url: string) {
    const html = await fetchText(url)
    const enc = html?.match(/const\s+datas\s*=\s*"([^"]*)"/)?.[1]
    return enc ? decryptAbyss(enc) : null
  }

  /* ----- as-cdn / ravok / AWSStream ----- */
  async function resolveAsCdn(domain: string, hash: string): Promise<ClientStream | null> {
    const body = new URLSearchParams({ hash, r: 'https://animesalt.cx/' }).toString()
    const [page, vid] = await Promise.all([
      fetchText(forFetch(`https://${domain}/video/${hash}`), {}, 10000),
      // X-Requested-With / Origin / Referer are added by the extension (rules.json, `do=getVideo`)
      fetchText(
        `https://${domain}/player/index.php?data=${hash}&do=getVideo`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body },
        14000,
      ),
    ])
    const text = vid?.trim()
    if (!text || !text.startsWith('{')) return null
    let j: { videoSource?: string; securedLink?: string; hls?: string }
    try {
      j = JSON.parse(text)
    } catch {
      return null
    }
    const m3u8 = j.videoSource || j.securedLink || j.hls
    if (!m3u8) return null
    return direct(m3u8, `https://${domain}/`, 'hls', extractSubtitles(page, domain))
  }

  /* ----- player.php / multi-lang-plyr.php: data= is base64 JSON [{ language, link }] ----- */
  async function resolveMultiLang(url: string, lang: string, depth: number): Promise<ClientStream | null> {
    try {
      const raw = url.match(/data=([a-zA-Z0-9%+/=_-]+)/)?.[1]
      if (!raw) return null
      let b64 = raw
      try {
        b64 = decodeURIComponent(raw)
      } catch {
        /* keep raw */
      }
      const list = JSON.parse(decodeB64(b64))
      if (!Array.isArray(list)) return null

      let want: string | null = null
      let en: string | null = null
      let hi: string | null = null
      let first: string | null = null
      for (const item of list) {
        const language = String(item?.language || '')
        const link = String(item?.link || '').replace(/\\\//g, '/')
        if (!link) continue
        first ??= link
        if (lang && language.toLowerCase().includes(lang.toLowerCase())) {
          want = link
          break
        }
        if (/english|dub/i.test(language)) en = link
        if (/hindi/i.test(language)) hi = link
      }
      const link = want ?? hi ?? en ?? first
      return link ? resolvePlayer(link, url, lang, depth + 1) : null
    } catch {
      return null
    }
  }

  /* ----- generic player page: nested iframe, as-cdn hash, Abyss blob, or a file:/source: config ----- */
  async function resolveFromPage(pageUrl: string, lang: string, depth: number): Promise<ClientStream | null> {
    const html = await httpGet(pageUrl)
    if (!html) return null
    const domain = (() => {
      try {
        return new URL(pageUrl).hostname
      } catch {
        return 'ravok.buzz'
      }
    })()

    const nested = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1]
    if (usable(nested)) {
      const r = await resolvePlayer(abs(nested.trim(), pageUrl), pageUrl, lang, depth + 1)
      if (r) {
        if (!r.subtitles.length) {
          const pageSubs = extractSubtitles(html, domain)
          if (pageSubs.length) r.subtitles = pageSubs
        }
        return r
      }
    }

    const cdn = html.match(/https?:\/\/([a-zA-Z0-9_.-]+)\/video\/([a-zA-Z0-9_-]+)/i)
    if (cdn) {
      const r = await resolveAsCdn(cdn[1], cdn[2])
      if (r) return r
    }

    const datas = html.match(/const\s+datas\s*=\s*"([^"]*)"/)
    if (datas) {
      const r = await decryptAbyss(datas[1])
      if (r) return r
    }

    const file = html.match(/(?:file|source|src)\s*:\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i)?.[1]
    if (file) return direct(file, pageUrl, undefined, extractSubtitles(html, domain))
    return null
  }

  /** Any player url -> direct stream (or null). Mirrors resolvePlayer in server/acdn.js. */
  async function resolvePlayer(iframeUrl: string, referer: string, lang = '', depth = 0): Promise<ClientStream | null> {
    if (!usable(iframeUrl) || depth > MAX_DEPTH || expired()) return null
    const url = iframeUrl.trim()

    if (/abyssplayer\.com/i.test(url)) {
      const r = await resolveAbyss(url)
      if (r) return r
    }

    if (/player\.php|multi-lang-plyr\.php/i.test(url)) {
      const r = await resolveMultiLang(url, lang, depth)
      if (r) return r
    }

    const cdn = url.match(/https?:\/\/([a-zA-Z0-9_.-]+)\/video\/([a-zA-Z0-9_-]+)/i)
    if (cdn) {
      const r = await resolveAsCdn(cdn[1], cdn[2])
      if (r) return r
    }

    if (/pixel/i.test(url)) {
      const html = await httpGet(url)
      const f = html?.match(/file\s*:\s*"([^"]+)"/i)?.[1]
      if (f) return direct(f.replace(/\\\//g, '/'), url)
    }

    if (/\.(m3u8|mp4)(\?|$)/i.test(url)) return direct(url, referer)

    return resolveFromPage(url, lang, depth)
  }

  /* ----- AnimeDekho ----- */
  async function findDekhoEpisodePage(title: string, season: number, episode: number, isMovie: boolean): Promise<string | null> {
    try {
      const searchUrl = `${DEKHO}/?s=${encodeURIComponent(title)}`
      const html = await httpGet(searchUrl)
      if (!html) return null

      let links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*lnk-blk/gi)].map((m) => m[1])
      if (!links.length) links = [...html.matchAll(/href="([^"]+)"[^>]*class="lnk-blk"/gi)].map((m) => m[1])
      if (!links.length) return null

      const seriesUrl = abs(links[0], DEKHO)
      const seriesHtml = await httpGet(seriesUrl)
      if (!seriesHtml) return null
      if (isMovie) return seriesUrl

      const items: { href: string; ep: number; se: number | null }[] = []
      for (const ul of seriesHtml.matchAll(/<ul[^>]+class="[^"]*seasons-lst[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi)) {
        for (const li of ul[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
          const href = li[1].match(/href="([^"]+)"/i)?.[1]
          const m = li[1].match(/<span>S(\d+)-E(\d+)<\/span>|E(\d+)|Episode\s*(\d+)/i)
          if (!href || !m) continue
          const ep = Number(m[2] || m[3] || m[4] || m[1])
          const se = m[2] ? Number(m[1]) : null
          items.push({ href: abs(href, seriesUrl), ep, se })
        }
      }
      const exact = items.find((i) => i.ep === episode && i.se === season)
      if (exact) return exact.href
      const loose = items.find((i) => i.ep === episode)
      if (loose) return loose.href

      const epi = [...seriesHtml.matchAll(/href="([^"]*\/epi\/[^"]+)"/gi)].map((m) => m[1])
      const hit = epi.find((l) => l.includes(`-${season}x${episode}/`)) || epi.find((l) => l.includes(`x${episode}/`) || l.includes(`-${episode}/`))
      return hit ? abs(hit, seriesUrl) : null
    } catch {
      return null
    }
  }

  async function fromAnimeDekho(q: ClientQuery, c: Cand, slugs: string[]): Promise<ClientStream | null> {
    try {
      let epUrl = await findDekhoEpisodePage(q.title, c.season, c.episode, c.isMovie)
      if (!epUrl) {
        for (const s of slugs) {
          const cand = `${DEKHO}/epi/${s}/`
          const html = await httpGet(cand)
          if (html && html.length > 500) {
            epUrl = cand
            break
          }
        }
      }
      if (!epUrl) return null

      const epHtml = await httpGet(epUrl)
      if (!epHtml) return null
      const slug = epUrl.match(/\/epi\/([^/]+)/)?.[1] || slugs[0]

      const iframes = [...epHtml.matchAll(/<iframe[^>]+src="([^"]+)"/gi)].map((m) => m[1].trim()).filter(usable)
      for (const src of iframes) {
        const r = await resolvePlayer(abs(src, epUrl), epUrl, q.lang)
        if (r) return { ...r, slug }
      }

      const bodyClass = epHtml.match(/<body[^>]+class="([^"]+)"/i)?.[1] || ''
      const postId = bodyClass.match(/(?:term|postid)-(\d+)/)?.[1]
      if (postId) {
        const type = c.isMovie ? 1 : 2
        for (let n = 0; n <= 4; n++) {
          const trUrl = `${DEKHO}/?trdekho=${n}&trid=${postId}&trtype=${type}`
          const html = await httpGet(trUrl)
          const src = html?.match(/<iframe[^>]+src="([^"]+)"/i)?.[1]?.trim()
          if (!usable(src)) continue
          const r = await resolvePlayer(abs(src, trUrl), trUrl, q.lang)
          if (r) return { ...r, slug }
        }
      }
    } catch {
      /* null below */
    }
    return null
  }

  /* ----- AnimeSalt ----- */
  const optionIframe = (html: string, id: string, base: string) => {
    const m = html.match(new RegExp(`<div[^>]+id=["']${id}["'][^>]*>[\\s\\S]*?<iframe[^>]+(?:data-src|src)=["']([^"']+)["']`, 'i'))
    const u = m?.[1]?.trim()
    return usable(u) ? abs(u, base) : null
  }

  async function fromAnimeSalt(q: ClientQuery, c: Cand, slugs: string[]): Promise<ClientStream | null> {
    for (const s of slugs) {
      const path = c.isMovie ? `/movies/${s}/` : `/episode/${s}/`
      for (const mirror of SALT_MIRRORS) {
        if (expired()) return null
        try {
          const html = await httpGet(`${mirror}${path}`)
          if (!html) continue

          for (const opt of q.lang ? ['options-1', 'options-0'] : ['options-0', 'options-1']) {
            const u = optionIframe(html, opt, mirror)
            if (!u) continue
            const r = await resolvePlayer(u, `${mirror}/`, q.lang)
            if (r) return { ...r, slug: s }
          }

          for (const m of html.matchAll(/loadMi\(\{\s*value:\s*'([^']+)'/gi)) {
            try {
              const src = decodeB64(m[1]).match(/<iframe[^>]*(?:data-src|src)=["']([^"']+)["']/i)?.[1]?.trim()
              if (!usable(src)) continue
              const r = await resolvePlayer(abs(src, mirror), `${mirror}/`, q.lang)
              if (r) return { ...r, slug: s }
            } catch {
              /* next button */
            }
          }
        } catch {
          /* next mirror */
        }
      }
    }
    return null
  }

  /* ----- public flows ----- */
  async function candidate(q: ClientQuery) {
    const mapping = await loadMapping().catch(() => null)
    if (!mapping) return null
    return pickMapping(mapping, q.anilistId, q.episode, q.isMovie)
  }

  /** ACDN: AnimeSalt first, AnimeDekho second (same order as the server, which is what works on localhost). */
  async function acdn(q: ClientQuery): Promise<ClientStream | null> {
    const c = await candidate(q)
    if (!c) return null
    const slugs = candidateSlugs(c)
    const hit = (await fromAnimeSalt(q, c, slugs)) || (await fromAnimeDekho(q, c, slugs))
    return hit ? { ...hit, slug: hit.slug || c.slug } : null
  }

  /** AbyssPlayer only: never returns a ravok / as-cdn HLS stream. */
  async function abyssOnly(q: ClientQuery): Promise<ClientStream | null> {
    const c = await candidate(q)
    if (!c) return null
    const slugs = candidateSlugs(c)

    const abyssFromPage = async (pageUrl: string) => {
      const html = await httpGet(pageUrl)
      if (!html) return null
      const frames = [...html.matchAll(/<iframe[^>]+(?:data-src|src)=["']([^"']+)["']/gi)].map((m) => m[1].trim()).filter(usable)
      for (const src of frames) {
        const u = abs(src, pageUrl)
        if (/abyssplayer\.com/i.test(u)) {
          const r = await resolveAbyss(u)
          if (r) return r
        }
      }
      return null
    }

    for (const mirror of SALT_MIRRORS) {
      for (const s of slugs) {
        if (expired()) return null
        const pageUrl = `${mirror}/${c.isMovie ? 'movies' : 'episode'}/${s}/`
        const html = await httpGet(pageUrl)
        if (!html || html.length < 500) continue
        const opt0 = optionIframe(html, 'option-0', pageUrl) || optionIframe(html, 'options-0', pageUrl)
        if (opt0 && /abyssplayer\.com/i.test(opt0)) {
          const r = await resolveAbyss(opt0)
          if (r) return { ...r, slug: s }
        }
        const r = await abyssFromPage(pageUrl)
        if (r) return { ...r, slug: s }
      }
    }

    const epUrl = await findDekhoEpisodePage(q.title, c.season, c.episode, c.isMovie)
    if (epUrl) {
      const r = await abyssFromPage(epUrl)
      if (r) return { ...r, slug: c.slug }
    }
    return null
  }

  return { acdn, abyssOnly }
}

/* ---------------- public API (with a short result cache) ---------------- */
const TTL = 5 * 60e3
const cache = new Map<string, { at: number; v: ClientStream }>()

async function cached(key: string, budgetMs: number, run: (r: ReturnType<typeof createResolver>) => Promise<ClientStream | null>) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.v
  const v = await run(createResolver(budgetMs))
  if (v) {
    if (cache.size > 100) cache.delete(cache.keys().next().value as string)
    cache.set(key, { at: Date.now(), v })
  }
  return v
}

export const resolveAcdnClient = (q: ClientQuery) =>
  cached(`acdn:${q.anilistId}:${q.episode}:${q.isMovie}:${q.lang}`, 25000, (r) => r.acdn(q)).catch(() => null)

export const resolveAbyssClient = (q: ClientQuery) =>
  cached(`abyss:${q.anilistId}:${q.episode}:${q.isMovie}`, 22000, (r) => r.abyssOnly(q)).catch(() => null)
