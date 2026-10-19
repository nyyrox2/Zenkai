export interface ChangelogItem {
  badge: string
  badgeVariant: 'emerald' | 'indigo' | 'amber' | 'cyan' | 'crimson'
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

export const CURRENT_RELEASE: ReleaseData = {
  version: '1.0.1',
  releaseDate: 'October 19, 2026',
  title: 'FlixCloud & ReAnime Update',
  tagline: 'High-speed native HLS streams, dedicated ReAnime embed player, and enhanced subtitle & CDN playback.',
  githubUrl: 'https://github.com/nyyrox2/Zenkai/releases/tag/v1.0.1',
  highlights: [
    {
      badge: 'NEW PROVIDER',
      badgeVariant: 'emerald',
      title: 'FlixCloud Direct HLS (Sub & Dub)',
      description:
        'Native client-side HLS playback ported from the Zenkai Android APK. Pure Web Crypto decryption with styled ASS/SSA subtitles, intro/outro skip intervals, and verified fallbacks.',
    },
    {
      badge: 'NEW EMBED',
      badgeVariant: 'indigo',
      title: 'ReAnime Embed Player',
      description:
        'Added dedicated ReAnime (HD-2) embed player to the server selector with seamless SUB and DUB audio switching and picture-in-picture support.',
    },
    {
      badge: 'PERFORMANCE',
      badgeVariant: 'amber',
      title: 'Fast Homepages & Episode Groups',
      description:
        'Kept homepage and hero banner queries blazing fast while resolving TMDB absolute episode numbering for long-running anime like One Piece.',
    },
    {
      badge: 'STABILITY',
      badgeVariant: 'cyan',
      title: 'Edge Proxy & CDN Whitelisting',
      description:
        'Expanded CDN security allowlist for vividcdn, rundowncdn, and fallencdn with strict audio/video MIME corrections and Range seeking.',
    },
  ],
}

const STORAGE_KEY = 'zenkai_release_seen_version'
const EVENT_NAME = 'zenkai:changelog-toggle'

export function hasSeenLatestRelease(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(STORAGE_KEY) === CURRENT_RELEASE.version
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
