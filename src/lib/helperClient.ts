import { useSyncExternalStore } from 'react'

export const HELPER_DEFAULT_PORT = 48912
export const HELPER_BASE_URL = `http://127.0.0.1:${HELPER_DEFAULT_PORT}`
export const HELPER_APK_DOWNLOAD_URL = '/ZenkaiHelper.apk'
export const HELPER_DEEP_LINK = 'zenkaihelper://start'

export interface HelperHealthState {
  connected: boolean
  checking: boolean
  version?: string
  port: number
  capabilities: string[]
  tokenCached?: boolean
  requests?: number
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
let activeProbe: Promise<boolean> | null = null
let loopStarted = false

export function isHelperApkActive(): boolean {
  return state.connected
}

export function getHelperBaseUrl(): string {
  return `http://127.0.0.1:${state.port || HELPER_DEFAULT_PORT}`
}

export function getHelperState(): HelperHealthState {
  return state
}

export function helperHas(cap: string): boolean {
  return state.connected && state.capabilities.includes(cap)
}

export async function probeHelperApk(force = false): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const now = Date.now()
  if (!force && now - lastProbeAt < (state.connected ? 6000 : 1200)) {
    return state.connected
  }
  if (activeProbe) return activeProbe

  activeProbe = (async () => {
    lastProbeAt = Date.now()
    if (!state.connected) {
      state = { ...state, checking: true }
      emit()
    }
    const ctl = new AbortController()
    const timer = window.setTimeout(() => ctl.abort(), 900)
    try {
      const res = await fetch(`${getHelperBaseUrl()}/health`, {
        method: 'GET',
        signal: ctl.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        service?: string
        version?: string
        port?: number
        capabilities?: string[]
        stats?: { tokenCached?: boolean; requests?: number }
      } | null
      if (data?.ok && data.service === 'zenkai-helper') {
        state = {
          connected: true,
          checking: false,
          version: data.version || '1.0.0',
          port: data.port || HELPER_DEFAULT_PORT,
          capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
          tokenCached: data.stats?.tokenCached,
          requests: data.stats?.requests,
        }
        emit()
        return true
      }
    } catch {
      /* helper not running */
    } finally {
      window.clearTimeout(timer)
      activeProbe = null
    }
    if (state.connected || state.checking) {
      state = {
        connected: false,
        checking: false,
        port: HELPER_DEFAULT_PORT,
        capabilities: [],
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
  if (targetUrl.startsWith('http://127.0.0.1:')) return targetUrl
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
