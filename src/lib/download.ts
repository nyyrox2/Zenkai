import { isCompanionActive, companionHas, isExtensionActive } from './useCompanion'
import { isHelperApkActive, helperProxyUrl, isLocalHelperUrl } from './helperClient'
import { toast } from './toast'

export interface DownloadMediaOptions {
  url?: string             // Proxied or direct download URL
  rawUrl?: string          // Direct raw CDN URL
  filename?: string        // Desired filename, e.g. "Fitoor (2016) [1080p].mp4"
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
 * Triggers a direct download with proper movie/series/anime filename:
 * 
 * Protected CDNs (such as hakunaymatata, aoneroom, bcdnxw) strictly reject direct browser
 * downloads with HTTP 428/403 anti-bot protection unless fetched with specialized headers (ExoPlayer UA).
 * Therefore, downloads must route through the dedicated backend proxy (/proxy?url=...&dl=1&fn=...)
 * which pipes the stream with Content-Disposition: attachment; filename="<Title>.mp4".
 * 
 * 1. If Zenkai Companion extension (>= 1.3.0) is active:
 *    Triggers download via Chrome Downloads API using the verified proxy attachment URL.
 * 2. Fallback (no extension or older extension):
 *    Triggers download via a programmatic hidden anchor click without target="_blank",
 *    saving directly to the user's Downloads folder without leaving the page.
 */
export function downloadMedia({ url, rawUrl, filename }: DownloadMediaOptions): void {
  const cleanName = sanitizeDownloadFilename(filename)

  // 1. Resolve effective proxy download URL
  let targetUrl = url
  if (isHelperApkActive()) {
    if (isLocalHelperUrl(url)) {
      targetUrl = url
    } else if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
      targetUrl = helperProxyUrl(rawUrl, undefined, true, cleanName)
    }
  }
  if (!targetUrl && rawUrl) {
    targetUrl = isHelperApkActive()
      ? helperProxyUrl(rawUrl, undefined, true, cleanName)
      : `/proxy?url=${encodeURIComponent(rawUrl)}&dl=1&fn=${encodeURIComponent(cleanName)}`
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

  // 2. Helper to trigger native browser anchor download
  const triggerAnchorDownload = () => {
    const a = document.createElement('a')
    a.href = targetUrl!
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

  // 3. If Chrome Extension is installed with direct-download capability (skip for Helper APK HTTP downloads):
  if (isExtensionActive() && isCompanionActive() && companionHas('direct-download')) {
    toast(`Downloading: ${cleanName}`, 'info')
    
    // Listen for extension response; fall back to anchor if extension encounters an issue
    let completed = false
    const onResult = (e: Event) => {
      completed = true
      window.removeEventListener('zenkai:extension-download-result', onResult)
      const detail = (e as CustomEvent)?.detail
      if (detail && detail.ok === false) {
        console.warn('[zenkai:download] Extension download failed, falling back to browser download:', detail.error)
        triggerAnchorDownload()
      }
    }
    window.addEventListener('zenkai:extension-download-result', onResult)
    setTimeout(() => {
      window.removeEventListener('zenkai:extension-download-result', onResult)
      if (!completed) {
        // If extension didn't respond within 1.5s, trigger anchor download
        triggerAnchorDownload()
      }
    }, 1500)

    window.dispatchEvent(
      new CustomEvent('zenkai:extension-download', {
        detail: {
          url: targetUrl,
          filename: cleanName,
        },
      })
    )
    return
  }

  // 4. Default / Fallback: Native browser anchor download
  toast(`Downloading: ${cleanName}`, 'info')
  triggerAnchorDownload()
}
