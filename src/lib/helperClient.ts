import { useSyncExternalStore } from 'react'

export const HELPER_DEFAULT_PORT = 48912
export const HELPER_BASE_URL = `http://127.0.0.1:${HELPER_DEFAULT_PORT}`
export const HELPER_APK_DOWNLOAD_URL = '/ZenkaiHelper.apk'
export const HELPER_DEEP_LINK = 'zenkaihelper://start'
const CUSTOM_HELPER_KEY = 'zenkai_helper_lan_url'

export interface HelperHealthState {
  connected: boolean
  checking: boolean
  version?: string
  port: number
  capabilities: string[]
  tokenCached?: boolean
  requests?: number
  lanUrl?: string | null
  baseUrl?: string
}

let state: HelperHealthState = {
  connected: false,
  checking: false,
  port: HELPER_DEFAULT_PORT,
  capabilities: [],
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

let lastProbeAt = 0
let missCount = 0
let activeBaseUrl = HELPER_BASE_URL
let activeProbe: Promise<boolean> | null = null
let loopStarted = false

function normalizeHelperOrigin(raw: string): string | null {
  const s = raw.trim().replace(/\/+$/, '')
  if (!s) return null
  const withScheme = /^https?:\/\//i.test(s) ? s : `http://${s}`
  try {
    const u = new URL(withScheme)
    if (!u.port && u.protocol === 'http:') u.port = String(HELPER_DEFAULT_PORT)
    return u.origin
  } catch {
    return null
  }
}

export function getCustomHelperUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const param = new URLSearchParams(window.location.search).get('helper')
    if (param) {
      const norm = normalizeHelperOrigin(param)
      if (norm) {
        window.localStorage.setItem(CUSTOM_HELPER_KEY, norm)
        return norm
      }
    }
    const saved = window.localStorage.getItem(CUSTOM_HELPER_KEY)
    return saved ? normalizeHelperOrigin(saved) : null
  } catch {
    return null
  }
}

export function setCustomHelperUrl(raw: string | null): string | null {
  if (typeof window === 'undefined') return null
  try {
    if (!raw || !raw.trim()) {
      window.localStorage.removeItem(CUSTOM_HELPER_KEY)
      activeBaseUrl = HELPER_BASE_URL
      void probeHelperApk(true)
      return null
    }
    const norm = normalizeHelperOrigin(raw)
    if (norm) {
      window.localStorage.setItem(CUSTOM_HELPER_KEY, norm)
      activeBaseUrl = norm
      void probeHelperApk(true)
      return norm
    }
  } catch {
    /* ignore storage failures */
  }
  return null
}

export function isHelperApkActive(): boolean {
  return state.connected
}

export function getHelperBaseUrl(): string {
  if (activeBaseUrl) return activeBaseUrl
  if (typeof window !== 'undefined' && window.location.port === String(HELPER_DEFAULT_PORT)) {
    return window.location.origin
  }
  return `http://127.0.0.1:${state.port || HELPER_DEFAULT_PORT}`
}

export function isLocalHelperUrl(url: string | undefined | null): boolean {
  if (!url) return false
  if (url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:')) return true
  const base = getHelperBaseUrl()
  if (base && url.startsWith(base)) return true
  const custom = getCustomHelperUrl()
  return Boolean(custom && url.startsWith(custom))
}

export function getHelperState(): HelperHealthState {
  return state
}

export function helperHas(cap: string): boolean {
  return state.connected && state.capabilities.includes(cap)
}

async function tryProbeOrigin(base: string, timeoutMs = 2000): Promise<any | null> {
  const ctl = new AbortController()
  const timer = window.setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      signal: ctl.signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    if (data?.ok && data.service === 'zenkai-helper') return data
    return null
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

export async function probeHelperApk(force = false): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const now = Date.now()
  if (!force && now - lastProbeAt < (state.connected ? 5500 : 1000)) {
    return state.connected
  }
  if (activeProbe) return activeProbe

  activeProbe = (async () => {
    lastProbeAt = Date.now()
    if (!state.connected) {
      state = { ...state, checking: true }
      emit()
    }
    try {
      const custom = getCustomHelperUrl()
      const sameHostBridge =
        typeof window !== 'undefined' && window.location.port === String(HELPER_DEFAULT_PORT)
          ? window.location.origin
          : null
      const port = state.port || HELPER_DEFAULT_PORT
      const candidates = Array.from(
        new Set(
          [
            sameHostBridge,
            activeBaseUrl,
            `http://127.0.0.1:${port}`,
            `http://localhost:${port}`,
            custom,
          ].filter((x): x is string => Boolean(x)),
        ),
      )

      let hitBase: string | null = null
      let hitData: any = null
      for (const candidate of candidates) {
        const d = await tryProbeOrigin(candidate, 2000)
        if (d) {
          hitBase = candidate
          hitData = d
          break
        }
      }

      if (hitBase && hitData) {
        missCount = 0
        activeBaseUrl = hitBase
        state = {
          connected: true,
          checking: false,
          version: hitData.version || '1.0.1',
          port: hitData.port || HELPER_DEFAULT_PORT,
          capabilities: Array.isArray(hitData.capabilities) ? hitData.capabilities : [],
          tokenCached: hitData.stats?.tokenCached,
          requests: hitData.stats?.requests,
          lanUrl: hitData.lanUrl || null,
          baseUrl: hitBase,
        }
        emit()
        return true
      }

      missCount += 1
      // Require 2 consecutive probe failures before flipping connected -> false so transient pauses don't flash offline
      if (state.connected && missCount < 2 && !force) {
        return true
      }
    } finally {
      activeProbe = null
    }

    if (state.connected || state.checking) {
      state = {
        connected: false,
        checking: false,
        port: HELPER_DEFAULT_PORT,
        capabilities: [],
        lanUrl: null,
        baseUrl: undefined,
      }
      emit()
    }
    return false
  })()

  return activeProbe
}

export function ensureHelperProbeLoop(): void {
  if (typeof window === 'undefined' || loopStarted) return
  loopStarted = true
  void probeHelperApk(true)

  window.addEventListener('focus', () => {
    void probeHelperApk(true)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void probeHelperApk(true)
    }
  })

  window.setInterval(() => {
    void probeHelperApk(state.connected ? false : true)
  }, 4500)
}

export function useHelperApk(): HelperHealthState {
  ensureHelperProbeLoop()
  return useSyncExternalStore(subscribe, () => state, () => state)
}

export function helperProxyUrl(
  targetUrl: string,
  headersOrReferer?: string | Record<string, string>,
  dl = false,
  filename?: string,
): string {
  if (!targetUrl) return targetUrl
  if (isLocalHelperUrl(targetUrl)) return targetUrl
  const qs = new URLSearchParams({ url: targetUrl })
  if (typeof headersOrReferer === 'string' && headersOrReferer) {
    qs.set('referer', headersOrReferer)
  } else if (headersOrReferer && typeof headersOrReferer === 'object' && Object.keys(headersOrReferer).length > 0) {
    qs.set('headers', JSON.stringify(headersOrReferer))
  }
  if (dl) {
    qs.set('dl', '1')
    if (filename) qs.set('fn', filename)
  }
  return `${getHelperBaseUrl()}/proxy?${qs.toString()}`
}

export function helperFetchUrl(
  targetUrl: string,
  opts?: { referer?: string; origin?: string; headers?: Record<string, string> },
): string {
  const qs = new URLSearchParams({ url: targetUrl })
  if (opts?.referer) qs.set('referer', opts.referer)
  if (opts?.origin) qs.set('origin', opts.origin)
  if (opts?.headers && Object.keys(opts.headers).length > 0) {
    qs.set('headers', JSON.stringify(opts.headers))
  }
  return `${getHelperBaseUrl()}/api/fetch?${qs.toString()}`
}

export function launchHelperApp(): void {
  if (typeof window === 'undefined') return
  const a = document.createElement('a')
  a.href = HELPER_DEEP_LINK
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    try {
      document.body.removeChild(a)
    } catch {}
    void probeHelperApk(true)
  }, 900)
}
