import { useEffect, useState } from 'react'
import {
  useHelperApk,
  isHelperApkActive,
  helperHas,
  ensureHelperProbeLoop,
  getHelperBaseUrl,
} from './helperClient'

export const LATEST_EXTENSION_VERSION = '1.3.0'

export type CompanionMode = 'apk' | 'extension' | null

export interface CompanionInfo {
  installed: boolean
  mode: CompanionMode
  apkConnected: boolean
  apkVersion?: string
  extensionInstalled: boolean
  helperUrl?: string
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

export function isExtensionActive(): boolean {
  if (typeof window === 'undefined') return false
  return (
    document.documentElement.dataset.zenkaiCompanion === 'true' ||
    Boolean((window as any).__ZENKAI_COMPANION__?.active)
  )
}

export function extensionHas(cap: string): boolean {
  if (typeof window === 'undefined') return false
  const fromWindow = (window as any).__ZENKAI_COMPANION__?.capabilities
  if (Array.isArray(fromWindow) && fromWindow.includes(cap)) return true
  const attr = document.documentElement.dataset.zenkaiCompanionCaps
  return !!attr && attr.split(',').includes(cap)
}

/** Capability announced by either the Zenkai Helper APK or the Zenkai Chrome extension. */
export function companionHas(cap: string): boolean {
  return helperHas(cap) || extensionHas(cap)
}

export function isCompanionActive(): boolean {
  return isHelperApkActive() || isExtensionActive()
}

export function useCompanion(): CompanionInfo {
  const helper = useHelperApk()

  const [extState, setExtState] = useState<{ installed: boolean; version?: string; capabilities?: string[] }>(() => {
    const active = isExtensionActive()
    const meta = typeof window !== 'undefined' ? (window as any).__ZENKAI_COMPANION__ : undefined
    const ver = meta?.version || (typeof document !== 'undefined' ? document.documentElement.dataset.zenkaiCompanionVersion : undefined)
    return {
      installed: active,
      version: ver,
      capabilities: meta?.capabilities,
    }
  })

  useEffect(() => {
    ensureHelperProbeLoop()

    const onReady = (e: Event) => {
      const detail = (e as CustomEvent)?.detail
      const ver = detail?.version || (typeof document !== 'undefined' ? document.documentElement.dataset.zenkaiCompanionVersion : undefined) || '1.0.0'
      setExtState({
        installed: true,
        version: ver,
        capabilities: detail?.capabilities,
      })
    }

    window.addEventListener('zenkai:companion-ready', onReady)
    window.addEventListener('zenkai:companion-pong', onReady)
    window.dispatchEvent(new CustomEvent('zenkai:ping-companion'))

    const t = window.setInterval(() => {
      if (isExtensionActive() && !extState.installed) {
        const ver = (window as any).__ZENKAI_COMPANION__?.version || (typeof document !== 'undefined' ? document.documentElement.dataset.zenkaiCompanionVersion : undefined) || '1.0.0'
        setExtState({
          installed: true,
          version: ver,
          capabilities: (window as any).__ZENKAI_COMPANION__?.capabilities,
        })
      }
    }, 1000)

    return () => {
      window.removeEventListener('zenkai:companion-ready', onReady)
      window.removeEventListener('zenkai:companion-pong', onReady)
      window.clearInterval(t)
    }
  }, [extState.installed])

  const apkConnected = helper.connected
  const extensionInstalled = extState.installed
  const mode: CompanionMode = apkConnected ? 'apk' : extensionInstalled ? 'extension' : null
  const mergedCaps = Array.from(new Set([...(helper.capabilities || []), ...(extState.capabilities || [])]))

  return {
    installed: apkConnected || extensionInstalled,
    mode,
    apkConnected,
    apkVersion: helper.version,
    extensionInstalled,
    helperUrl: apkConnected ? getHelperBaseUrl() : undefined,
    version: apkConnected ? helper.version : extState.version,
    isOutdated: !apkConnected && extensionInstalled ? isVersionOlder(extState.version) : false,
    capabilities: mergedCaps,
  }
}
