import { useSyncExternalStore } from 'react'
import { toast } from './toast'

/**
 * Zenkai Shield (client): solves the server's proof-of-work once, then adds the token to every
 * same-origin /api and /proxy fetch. It is invisible unless DevTools / a bot is detected, or the server asks for a captcha.
 * The server half is server/shield.js; with no SHIELD_SECRET set there it hands out no token and this stays idle.
 */
const API = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const KEY = { tok: 'zenkai_shield_token', exp: 'zenkai_shield_exp' }

/* ---------- tiny store for the overlay ---------- */
interface State {
  devtools: boolean
  bot: boolean
  /** Set while the server wants a captcha solved (svg is the image). */
  captcha: { svg: string; error: boolean } | null
  verified: boolean
}

let token: string | null = null
let exp = 0
try {
  token = sessionStorage.getItem(KEY.tok)
  exp = Number(sessionStorage.getItem(KEY.exp) || 0)
} catch {}

let off = false
let pending: Promise<string | null> | null = null

const isTokenValid = () => !off && !!token && Date.now() < exp - 30_000

let state: State = {
  devtools: false,
  bot: false,
  captcha: null,
  verified: import.meta.env.DEV || isTokenValid(),
}
const subs = new Set<() => void>()
const set = (p: Partial<State>) => {
  state = { ...state, ...p }
  subs.forEach((f) => f())
}
export const useShield = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => state,
  )

export function isShieldVerified(): boolean {
  return import.meta.env.DEV || off || isTokenValid()
}

export function useShieldVerified(): boolean {
  const s = useShield()
  return s.verified
}

/* ---------- token ---------- */
const nativeFetch = window.fetch.bind(window)

async function solve(cid: string, salt: string, difficulty: number) {
  const prefix = '0'.repeat(difficulty)
  const enc = new TextEncoder()
  for (let n = 0; n < 500_000; n++) {
    const b = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${cid}:${salt}:${n}`)))
    const h = [...b.slice(0, 4)].map((x) => x.toString(16).padStart(2, '0')).join('')
    if (h.startsWith(prefix)) return n
  }
  return -1
}

let answer: ((a: string) => void) | null = null
const askCaptcha = (svg: string, error: boolean) =>
  new Promise<string>((res) => {
    answer = res
    set({ captcha: { svg, error } })
  })
export function submitCaptcha(a: string) {
  answer?.(a)
  answer = null
  set({ captcha: null })
}

// Set once DevTools have been seen: the next token then has to come with a captcha.
let flagged = false

async function fetchToken(): Promise<string | null> {
  try {
    let wrong = false
    for (let tries = 0; tries < 6; tries++) {
      const { svg, ...c } = await (await nativeFetch(`${API}/api/shield/challenge${flagged || state.bot ? '?cap=1' : ''}`)).json()
      if (c.off) {
        off = true
        set({ verified: true })
        return null
      }
      const nonce = await solve(c.cid, c.salt, c.difficulty)
      // Every API call waits here until the captcha is solved.
      const answer = c.cap ? await askCaptcha(svg, wrong) : undefined
      const r = await nativeFetch(`${API}/api/shield/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, nonce, answer }),
      })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.token) {
        token = d.token
        exp = Date.now() + d.expiresIn * 1000
        try {
          sessionStorage.setItem(KEY.tok, token!)
          sessionStorage.setItem(KEY.exp, String(exp))
        } catch {}
        set({ verified: true, captcha: null })
        return token
      }
      if (d?.code !== 'SHIELD_CAPTCHA_WRONG') return null
      wrong = true
    }
    return null
  } catch {
    return null
  }
}

export function getToken(): Promise<string | null> {
  if (off || import.meta.env.DEV) return Promise.resolve(null)
  if (token && Date.now() < exp - 30_000) return Promise.resolve(token)
  return (pending ??= fetchToken().finally(() => (pending = null)))
}

const forget = () => {
  token = null
  exp = 0
  try {
    sessionStorage.removeItem(KEY.tok)
    sessionStorage.removeItem(KEY.exp)
  } catch {}
  set({ verified: import.meta.env.DEV || off })
}

/* ---------- fetch interceptor ---------- */
const origins = new Set([location.origin, API ? new URL(API, location.href).origin : ''])

const isProtected = (input: RequestInfo | URL) => {
  try {
    const u = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href)
    return origins.has(u.origin) && (u.pathname.startsWith('/api/') || u.pathname === '/proxy') && !u.pathname.startsWith('/api/shield/')
  } catch {
    return false
  }
}

export function haltAllMedia() {
  try {
    document.querySelectorAll('video, audio').forEach((media) => {
      try {
        const el = media as HTMLMediaElement
        el.pause()
        el.removeAttribute('src')
        el.load()
      } catch {}
    })
    window.dispatchEvent(new CustomEvent('zenkai:devtools-halt'))
  } catch {}
}

function install() {
  window.fetch = async (input, init) => {
    if (state.devtools || state.bot) {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!urlStr.includes('/api/shield/')) {
        haltAllMedia()
        return new Response(JSON.stringify({ error: 'Inspection restricted by Zenkai Shield' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    if (!isProtected(input)) return nativeFetch(input, init)
    const send = (tok: string | null) => {
      const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      if (tok && !h.has('X-Zenkai-Shield')) h.set('X-Zenkai-Shield', tok)
      return nativeFetch(input, { ...init, headers: h })
    }
    let res = await send(await getToken())
    if (res.status === 401 || res.status === 403) {
      const body = await res.clone().json().catch(() => null)
      if (String(body?.code ?? '').startsWith('SHIELD_')) {
        forget()
        const t = await getToken()
        if (t) res = await send(t)
      }
    }
    return res
  }
}

/* ---------- bot + DevTools checks ---------- */
const AUTOMATION = ['__webdriver_script_fn', '__selenium_evaluate', 'callPhantom', '_phantom', '__nightmare', 'domAutomation', 'domAutomationController']

const looksAutomated = () =>
  !!navigator.webdriver ||
  AUTOMATION.some((k) => k in window) ||
  /HeadlessChrome|PhantomJS/i.test(navigator.userAgent) ||
  (!!(window as unknown as { chrome?: unknown }).chrome && !navigator.languages?.length)

function checkDevTools() {
  if (state.bot || import.meta.env.DEV) return // DEV: never stall or lock the dev's own DevTools
  const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  let open = !mobile && (window.outerWidth - window.innerWidth > 175 || window.outerHeight - window.innerHeight > 175)
  // Function() so the minifier cannot drop the debugger statement; it only stalls while DevTools is open.
  try {
    const t = performance.now()
    Function('debugger')()
    if (performance.now() - t > 100) open = true
  } catch {
    /* CSP without unsafe-eval: the size check above still runs */
  }
  if (open !== state.devtools) {
    set({ devtools: open })
    if (open) {
      flagged = true
      forget()
      haltAllMedia()
    }
  }
}

function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()
  const msg =
    e.key === 'F12' ? 'Developer tools (F12) are restricted.'
    : mod && e.shiftKey && 'ijc'.includes(k) && k.length === 1 ? 'Inspection shortcuts are restricted.'
    : mod && k === 'u' ? 'View source is restricted.'
    : ''
  if (!msg) return
  e.preventDefault()
  e.stopPropagation()
  toast(msg, 'error')
  checkDevTools()
}

let started = false
export function startShield() {
  if (started) return
  started = true
  install()
  if (import.meta.env.DEV) return
  if (looksAutomated()) return set({ bot: true })
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', checkDevTools)
  window.setInterval(checkDevTools, 900)
}
