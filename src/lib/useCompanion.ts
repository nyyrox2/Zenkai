import { useEffect, useState } from 'react'

export const LATEST_EXTENSION_VERSION = '1.0.1'

export interface CompanionInfo {
  installed: boolean
  version?: string
  isOutdated: boolean
  capabilities?: string[]
}

export function isVersionOlder(current?: string, latest: string = LATEST_EXTENSION_VERSION): boolean {
  if (!current) return false
  const cParts = current.split('.').map((n) => parseInt(n, 10) || 0)
  const lParts = latest.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const c = cParts[i] || 0
    const l = lParts[i] || 0
    if (c < l) return true
    if (c > l) return false
  }
  return false
}

export function isCompanionActive(): boolean {
  if (typeof window === 'undefined') return false
  return (
    document.documentElement.dataset.zenkaiCompanion === 'true' ||
    Boolean((window as any).__ZENKAI_COMPANION__?.active)
  )
}

export function useCompanion(): CompanionInfo {
  const [info, setInfo] = useState<CompanionInfo>(() => {
    const active = isCompanionActive()
    const meta = typeof window !== 'undefined' ? (window as any).__ZENKAI_COMPANION__ : undefined
    const ver = meta?.version || (typeof document !== 'undefined' ? document.documentElement.dataset.zenkaiCompanionVersion : undefined)
    return {
      installed: active,
      version: ver,
      isOutdated: active ? isVersionOlder(ver) : false,
      capabilities: meta?.capabilities,
    }
  })

  useEffect(() => {
    const onReady = (e: Event) => {
      const detail = (e as CustomEvent)?.detail
      const ver = detail?.version || (typeof document !== 'undefined' ? document.documentElement.dataset.zenkaiCompanionVersion : undefined) || '1.0.0'
      setInfo({
        installed: true,
        version: ver,
        isOutdated: isVersionOlder(ver),
        capabilities: detail?.capabilities,
      })
    }

    window.addEventListener('zenkai:companion-ready', onReady)
    window.addEventListener('zenkai:companion-pong', onReady)

    // Probe extension
    window.dispatchEvent(new CustomEvent('zenkai:ping-companion'))

    // Fast interval check for late injection
    const t = window.setInterval(() => {
      if (isCompanionActive() && !info.installed) {
        const ver = (window as any).__ZENKAI_COMPANION__?.version || (typeof document !== 'undefined' ? document.documentElement.dataset.zenkaiCompanionVersion : undefined) || '1.0.0'
        setInfo({
          installed: true,
          version: ver,
          isOutdated: isVersionOlder(ver),
          capabilities: (window as any).__ZENKAI_COMPANION__?.capabilities,
        })
      }
    }, 1000)

    return () => {
      window.removeEventListener('zenkai:companion-ready', onReady)
      window.removeEventListener('zenkai:companion-pong', onReady)
      window.clearInterval(t)
    }
  }, [info.installed])

  return info
}
