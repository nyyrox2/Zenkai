/**
 * Opening screen controller. The screen itself is plain HTML in index.html (so it paints before any JS), and this
 * module decides when the app is truly ready to be explored without hitching:
 *
 *   1. fonts are in           → headlines don't reflow while they animate in
 *   2. this page's code is in → no spinner the moment the screen lifts
 *   3. artwork lists are in   → the landing cards aren't empty when revealed (landing only)
 *   4. the main thread is calm → entrance animations start on a free thread
 *
 * <BootGate> mounts the app only after that, so every entrance animation plays as the screen lifts, not hidden
 * underneath it. A hard cap keeps a slow network from ever trapping anyone behind it.
 */
import { fetchShowcase } from '../services/showcase'

const CAP_MS = 5000
const SEEN_KEY = 'zk:booted'

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
/** Never rejects, never waits longer than `ms`. */
const within = (p: Promise<unknown>, ms: number) => Promise.race([p.catch(() => undefined), wait(ms)])
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const idle = (timeout = 400) =>
  new Promise<void>((r) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(() => r(), { timeout })
    else window.setTimeout(r, 60)
  })

/* ---------- which code does this URL need? (same modules App.tsx lazy-loads, so the chunk is shared) ---------- */
const ROUTES: [RegExp, () => Promise<unknown>][] = [
  [/^\/$/, () => Promise.resolve()], // the opening page ships in the main bundle
  [/^\/home\/?$/, () => import('../pages/HomePage')],
  [/^\/(trending|popular|top|browse)\/?$/, () => import('../pages/CatalogPage')],
  [/^\/list\/?$/, () => import('../pages/ListPage')],
  [/^\/schedule\/?$/, () => import('../pages/SchedulePage')],
  [/^\/app\/?$/, () => import('../pages/AppPage')],
  [/^\/profile\/?$/, () => import('../pages/ProfilePage')],
  [/^\/auth\/anilist/, () => import('../pages/AniListCallbackPage')],
  [/^\/(novel|manga)\/find\/?$/, () => import('../pages/FindPage')],
  [/^\/novel\/?$/, () => import('../pages/NovelHomePage')],
  [/^\/novel\/[^/]+\/[^/]+\/read\//, () => import('../pages/NovelReaderPage')],
  [/^\/novel\/[^/]+\/[^/]+\/?$/, () => import('../pages/NovelDetailsPage')],
  [/^\/manga\/?$/, () => import('../pages/MangaHomePage')],
  [/^\/manga\/browse\/?$/, () => import('../pages/MangaBrowsePage')],
  [/^\/manga\/[^/]+\/read\//, () => import('../pages/MangaReaderPage')],
  [/^\/manga\/[^/]+\/?$/, () => import('../pages/MangaDetailsPage')],
  [/^\/movies\/?$/, () => import('../pages/MoviesHomePage')],
  [/^\/movies\/browse\/?$/, () => import('../pages/MoviesBrowsePage')],
  [/^\/movies\/watch\//, () => import('../pages/MovieWatchPage')],
  [/^\/movies\/[^/]+\/[^/]+\/?$/, () => import('../pages/MovieDetailsPage')],
  [/^\/watch\/[^/]+/, () => import('../pages/WatchPage')],
  [/^\/(anime|mal)\/[^/]+\/?$/, () => import('../pages/DetailsPage')],
  [/^\/busted\/?$/, () => import('../pages/BustedPage')],
]

function routeChunk(pathname: string): Promise<unknown> {
  const hit = ROUTES.find(([re]) => re.test(pathname))
  return hit ? hit[1]() : import('../pages/NotFoundPage')
}

/* ---------- the opening screen's DOM ---------- */
const screen = () => document.getElementById('zk-boot')

function paint(p: number, label?: string) {
  const el = screen()
  if (!el) return
  el.style.setProperty('--zk-p', String(Math.max(0.06, Math.min(1, p))))
  if (label) {
    const t = document.getElementById('zk-boot-status')
    if (t && t.textContent !== label) t.textContent = label
  }
}

let booting: Promise<void> | null = null

/** Starts the checks right away (call before React renders). Safe to call more than once. */
export function startBoot(): Promise<void> {
  booting ??= run()
  return booting
}

async function run(): Promise<void> {
  const t0 = performance.now()
  const seen = (() => {
    try {
      return sessionStorage.getItem(SEEN_KEY) === '1'
    } catch {
      return false
    }
  })()
  // First visit of the session gets the full moment; coming back within it is quicker.
  const minMs = seen ? 450 : 800

  const { pathname } = window.location
  const landing = pathname === '/'
  const fonts = () =>
    Promise.all([
      document.fonts?.load('800 1em Outfit'),
      document.fonts?.load('900 1em Outfit'),
      document.fonts?.load('400 1em Inter'),
      document.fonts?.load('600 1em Inter'),
    ]).then(() => document.fonts?.ready)

  const steps: { label: string; weight: number; done: boolean; go: () => Promise<unknown> }[] = [
    { label: 'Loading fonts', weight: 2, done: false, go: () => within(fonts(), 2500) },
    { label: 'Loading the page', weight: 3, done: false, go: () => within(routeChunk(pathname), 4000) },
  ]
  if (landing) steps.push({ label: 'Fetching artwork', weight: 3, done: false, go: () => within(fetchShowcase(), 1800) })
  const warmWeight = 1
  const total = steps.reduce((n, s) => n + s.weight, warmWeight)

  const update = () => {
    const doneW = steps.reduce((n, s) => n + (s.done ? s.weight : 0), 0)
    const next = steps.find((s) => !s.done)
    paint((doneW / total) * 0.95, next ? next.label : 'Warming up animations')
  }
  update()

  const work = (async () => {
    await Promise.all(
      steps.map((s) =>
        s.go().finally(() => {
          s.done = true
          update()
        }),
      ),
    )
    // Let layout settle and the thread go quiet, so the entrance animations start on a free frame.
    await frame()
    await frame()
    await idle()
  })()

  await Promise.race([work, wait(CAP_MS)])

  paint(1, 'Ready')
  // let the bar land (it eases over ~.45s), and never flash the screen for less than minMs
  await wait(Math.max(350, minMs - (performance.now() - t0)))
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* storage blocked: first-visit timing just repeats */
  }
}

/** Lifts the opening screen (it slides away, revealing the already-mounted app), then removes it. */
export function liftScreen(): Promise<void> {
  const el = screen()
  document.documentElement.removeAttribute('data-booting')
  if (!el) return Promise.resolve()
  return new Promise((done) => {
    const finish = () => {
      el.remove()
      done()
    }
    el.addEventListener('transitionend', (e) => e.target === el && finish(), { once: false })
    window.setTimeout(finish, 1500) // transitionend can be skipped (hidden tab, reduced motion)
    requestAnimationFrame(() => el.classList.add('zk-out'))
  })
}

/** Once the screen is gone and the browser is idle, fetch the other sections' code so the first tap is instant. */
export function prefetchSections() {
  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return
  const jobs = [
    () => import('../pages/HomePage'),
    () => import('../pages/MoviesHomePage'),
    () => import('../pages/MangaHomePage'),
    () => import('../pages/NovelHomePage'),
    () => import('../pages/DetailsPage'),
    () => import('../pages/MovieDetailsPage'),
  ]
  const next = () => {
    const job = jobs.shift()
    if (!job) return
    job()
      .catch(() => undefined)
      .then(() => idle(2000))
      .then(next)
  }
  idle(3000).then(next)
}
