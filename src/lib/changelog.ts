import { useEffect, useState } from 'react'
import { WEB_REPO_URL } from './app'
import pkg from '../../package.json'

export interface ChangelogItem {
  badge: string
  title: string
  description: string
}

export interface ReleaseData {
  version: string
  releaseDate: string
  title: string
  tagline: string
  githubUrl: string
  highlights: ChangelogItem[]
}

/** Offline fallback; the real notes come from the latest GitHub release of the web repo. */
export const CURRENT_RELEASE: ReleaseData = {
  version: pkg.version,
  releaseDate: 'November 1, 2026',
  title: 'Zenkai Player API',
  tagline: 'Put any anime episode on your own site with a single iframe. No keys, no setup.',
  githubUrl: `${WEB_REPO_URL}/releases`,
  highlights: [
    { badge: 'API', title: 'Embeddable player', description: 'Use /embed?id=<AniList ID>&ep=1 in an iframe. Pick the server and sub or dub with query parameters.' },
    { badge: 'DOCS', title: 'Live embed generator', description: 'Build, preview and copy your snippet on the API page, with every option listed.' },
  ],
}

/* ---------- latest GitHub release -> ReleaseData ---------- */
interface GhRelease {
  tag_name: string
  name: string | null
  body: string | null
  html_url: string
  published_at: string | null
}
const REPO = WEB_REPO_URL.replace('https://github.com/', '')
const CACHE = 'zenkai_release_cache'
const TTL = 10 * 60 * 1000
const clean = (t: string) => t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim()

/** Release body format: first plain line = tagline, "## Heading" = badge, "- **Title** — text" = one highlight. */
function parseRelease(r: GhRelease): ReleaseData {
  let tagline = ''
  let badge = 'NEW'
  const highlights: ChangelogItem[] = []
  for (const raw of (r.body ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    const h = line.match(/^#{1,6}\s+(.*)/)
    const li = line.match(/^[-*+]\s+(.*)/)
    if (h) badge = clean(h[1]).toUpperCase()
    else if (li) {
      const b = li[1].match(/^\*\*(.+?)\*\*\s*[—–:-]*\s*(.*)$/)
      const [t, ...d] = b ? [b[1], b[2]] : clean(li[1]).split(/\s[—–-]\s|:\s/)
      highlights.push({ badge, title: clean(t), description: clean(d.join(' ')) })
    } else if (line && !tagline) tagline = clean(line)
  }
  return {
    version: r.tag_name.replace(/^v/i, ''),
    releaseDate: r.published_at ? new Date(r.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
    title: r.name || r.tag_name,
    tagline,
    githubUrl: r.html_url,
    highlights: highlights.slice(0, 8),
  }
}

let latest: Promise<ReleaseData> | undefined
/** Latest published release of the web repo (cached 10 min in localStorage); the static fallback when GitHub is unreachable. */
export function fetchLatestRelease(): Promise<ReleaseData> {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { at: number; v: ReleaseData } | null
    if (c && Date.now() - c.at < TTL) return (latest = Promise.resolve(c.v))
  } catch {}
  return (latest ??= fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? (r.json() as Promise<GhRelease>) : Promise.reject(r.status)))
    .then((g) => {
      const v = parseRelease(g)
      if (!v.highlights.length && !v.tagline) throw 0
      try {
        localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), v }))
      } catch {}
      return v
    })
    .catch(() => CURRENT_RELEASE))
}

export function useRelease(): { release: ReleaseData; ready: boolean } {
  const [s, set] = useState({ release: CURRENT_RELEASE, ready: false })
  useEffect(() => {
    let off = false
    void fetchLatestRelease().then((release) => !off && set({ release, ready: true }))
    return () => {
      off = true
    }
  }, [])
  return s
}

const STORAGE_KEY = 'zenkai_release_seen_version'
const EVENT_NAME = 'zenkai:changelog-toggle'

export function hasSeenLatestRelease(version = CURRENT_RELEASE.version): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(STORAGE_KEY) === version
  } catch {
    return true
  }
}

export function markReleaseSeen(version = CURRENT_RELEASE.version): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, version)
  } catch {}
}

export function openChangelog(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { open: true } }))
}

export function closeChangelog(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { open: false } }))
}

export function onChangelogToggle(callback: (open: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const custom = e as CustomEvent<{ open?: boolean }>
    callback(Boolean(custom.detail?.open))
  }
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
