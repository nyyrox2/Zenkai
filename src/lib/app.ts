/** Where the Zenkai Android app lives. Everything release-related is read live from this repo. */
export const APP_REPO = 'Nyyrox/Zenkai'
export const REPO_URL = `https://github.com/${APP_REPO}`
export const LATEST_URL = `${REPO_URL}/releases/latest`
export const RELEASES_URL = `${REPO_URL}/releases`
export const ISSUES_URL = `${REPO_URL}/issues`

/** The "Know more" button on the home page opens this page in a new tab. */
export const APP_INFO_URL = 'https://zenkai-auth-worker.ammhfoo.workers.dev/'
/** The open-source web app (this site). Self-hosting instructions point here. */
export const WEB_REPO_URL = 'https://github.com/nyyrox2/Zenkai'
export const WEB_REPO_CLONE = `${WEB_REPO_URL}.git`
/** Page with the self-hosting guide. */
export const SELF_HOST_PATH = '/self-host'
/** Invite links as published in the app's GitHub README. */
export const DISCORD_URL = 'https://discord.gg/kHxHzZtH7'
export const TELEGRAM_URL = 'https://t.me/StreamverseOfc'

export function formatBytes(n: number): string {
  if (!n) return ''
  const mb = n / 1048576
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const hours = (Date.now() - new Date(iso).getTime()) / 3600e3
  if (hours < 1) return 'just now'
  if (hours < 24) return `${Math.floor(hours)}h ago`
  const days = hours / 24
  if (days < 2) return 'yesterday'
  if (days < 14) return `${Math.floor(days)} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  if (days < 730) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}
