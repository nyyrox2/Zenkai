import { isCompanionActive, companionHas } from './useCompanion'
import { toast } from './toast'

export interface DownloadMediaOptions {
  url?: string             // Proxied or direct download URL
  rawUrl?: string          // Direct raw CDN URL (for companion)
  filename?: string        // Desired filename, e.g. "The Odyssey (2026) [1080p].mp4"
}

export function sanitizeDownloadFilename(name?: string): string {
  if (!name) return 'video.mp4'
  let clean = name.replace(/[^\w\s\-\.\(\)\[\]]/gi, '').trim()
  if (!clean) clean = 'video'
  if (!/\.(mp4|mkv|webm|m4v|ts)$/i.test(clean)) {
    clean += '.mp4'
  }
  return clean
}

/**
 * Triggers a direct download:
 * 1. If Zenkai Companion extension is active and has direct-download capability:
 *    Downloads directly from the raw CDN URL via Chrome Downloads API (wire speed, zero proxy load, exact filename).
 * 2. Fallback (proxy mode or extension without direct-download):
 *    Downloads via the backend proxy with ?dl=1&fn=... and Content-Disposition: attachment header.
 *    Uses a hidden anchor element WITHOUT target="_blank" so it starts downloading immediately
 *    without opening the proxy website or a new tab.
 */
export function downloadMedia({ url, rawUrl, filename }: DownloadMediaOptions): void {
  const cleanName = sanitizeDownloadFilename(filename)

  // 1. Direct CDN download via Zenkai Companion extension
  if (isCompanionActive() && companionHas('direct-download')) {
    const directTarget = rawUrl || (url && !url.includes('/proxy') ? url : undefined)
    if (directTarget && (directTarget.startsWith('http://') || directTarget.startsWith('https://'))) {
      toast(`Downloading via Extension: ${cleanName}`, 'info')
      window.dispatchEvent(
        new CustomEvent('zenkai:extension-download', {
          detail: {
            url: directTarget,
            filename: cleanName,
          },
        })
      )
      return
    }
  }

  // 2. Fallback: Download via backend proxy with dl=1 and custom filename
  let targetUrl = url
  if (!targetUrl && rawUrl) {
    targetUrl = `/proxy?url=${encodeURIComponent(rawUrl)}&dl=1&fn=${encodeURIComponent(cleanName)}`
  }

  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
      parsed.searchParams.set('dl', '1')
      parsed.searchParams.set('fn', cleanName)
      targetUrl = parsed.toString()
    } catch {
      if (!targetUrl.includes('dl=')) {
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + `dl=1&fn=${encodeURIComponent(cleanName)}`
      }
    }
  }

  if (!targetUrl) {
    toast('Download URL is unavailable for this video stream.', 'error')
    return
  }

  toast(`Starting download: ${cleanName}`, 'info')

  // Programmatically trigger download using a hidden link
  // Since the response returns Content-Disposition: attachment, the browser stays on the page and begins downloading
  const a = document.createElement('a')
  a.href = targetUrl
  a.download = cleanName
  a.rel = 'noopener noreferrer'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    try {
      document.body.removeChild(a)
    } catch {}
  }, 2000)
}
