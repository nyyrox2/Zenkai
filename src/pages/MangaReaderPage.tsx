import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useBackToDetails } from '../lib/backToDetails'
import { ArrowDownUp, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, List, Maximize, Minimize, Minus, Pause, Play, Plus, RefreshCw, RotateCcw, Settings, X } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { mangaSourceInfo, readingKey, resolveMangaSource, sourceParams, type MangaSourceId } from '../lib/mangaModels'
import { DEFAULT_MANGA, getReading, loadPrefs, savePrefs, saveReading, type MangaPrefs } from '../lib/reading'
import { cn } from '../lib/utils'
import { fetchMangaChapters, fetchMangaPages, proxiedImage, type MangaChapterRef } from '../services/manga'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import NotFoundPage from './NotFoundPage'

const PREFS_KEY = 'zk:manga-prefs:v1'
const BG: Record<MangaPrefs['bg'], { bg: string; fg: string; bar: string }> = {
  black: { bg: '#000', fg: '#e8e8ec', bar: 'rgba(0,0,0,.88)' },
  dark: { bg: '#121216', fg: '#e8e8ec', bar: 'rgba(18,18,22,.9)' },
  light: { bg: '#f1f1f4', fg: '#16161a', bar: 'rgba(241,241,244,.92)' },
  sepia: { bg: '#f4ecd8', fg: '#3b3226', bar: 'rgba(244,236,216,.94)' },
}
const WEBTOON_W: Record<MangaPrefs['width'], string | undefined> = { narrow: '32rem', medium: '44rem', wide: '60rem', full: undefined }
const GAP: Record<MangaPrefs['gap'], string> = { none: '0px', small: '8px', large: '24px' }
const MODE_LABEL: Record<MangaPrefs['mode'], string> = { webtoon: 'Webtoon', ltr: 'Left → Right', rtl: 'Right → Left' }
const HEADER_H = 56

export default function MangaReaderPage() {
  const { id = '', chapterId = '' } = useParams()
  if (!id || !chapterId) return <NotFoundPage />
  return <Reader id={id} chapterId={chapterId} />
}

/** One page image: CDN first, Referer-spoofing proxy second, manual retry last. */
function PageImg({ src, alt, source, eager, className, onReady }: { src: string; alt: string; source: MangaSourceId; eager?: boolean; className?: string; onReady?: () => void }) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const url = attempt === 1 ? proxiedImage(src, source) : attempt >= 2 ? `${src}${src.includes('?') ? '&' : '?'}r=${attempt}` : src
  const failed = attempt >= 3

  if (failed)
    return (
      <div className="grid aspect-[2/3] w-full place-items-center bg-white/5 text-center text-sm">
        <div className="space-y-3 p-6">
          <p className="opacity-70">This page didn&rsquo;t load.</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setAttempt(0)
            }}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-fg active:scale-95"
          >
            <RefreshCw className="size-3.5" /> Retry
          </button>
        </div>
      </div>
    )

  return (
    <div className={cn('relative w-full', !loaded && 'aspect-[2/3]')}>
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        src={url}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onLoad={() => {
          setLoaded(true)
          onReady?.()
        }}
        onError={() => setAttempt((a) => Math.min(a + 1, 3))}
        className={cn('block w-full select-none transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', className)}
      />
    </div>
  )
}

function Clock() {
  const fmt = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const [t, setT] = useState(fmt)
  useEffect(() => {
    const i = window.setInterval(() => setT(fmt()), 20000)
    return () => window.clearInterval(i)
  }, [])
  return <>{t}</>
}

function Reader({ id, chapterId }: { id: string; chapterId: string }) {
  const navigate = useNavigate()
  const backTo = useBackToDetails()
  const [params] = useSearchParams()
  const title = params.get('title') || 'Manga'
  const cover = params.get('cover') || ''
  const source = resolveMangaSource(params.get('source'))
  const sourceName = mangaSourceInfo(source).displayName

  const [prefs, setPrefs] = useState<MangaPrefs>(() => loadPrefs(PREFS_KEY, DEFAULT_MANGA))
  const [panel, setPanel] = useState<'none' | 'chapters' | 'settings'>('none')
  const [bar, setBar] = useState(true)
  const [pageIdx, setPageIdx] = useState(0)
  const [full, setFull] = useState(false)
  const [auto, setAuto] = useState(false)

  const list = useAsync(() => fetchMangaChapters(id, source).catch(() => [] as MangaChapterRef[]), [id, source])
  const pagesQ = useAsync(() => fetchMangaPages(chapterId, source), [chapterId, source])
  const pages = useMemo(() => pagesQ.data ?? [], [pagesQ.data])

  const chapters = useMemo(() => list.data ?? [], [list.data])
  const idx = chapters.findIndex((c) => c.chapterId === chapterId)
  const current = idx >= 0 ? chapters[idx] : undefined
  const older = idx > 0 ? chapters[idx - 1] : undefined
  const newer = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : undefined
  const q = new URLSearchParams({ title, cover, ...sourceParams(source) }).toString()
  const urlOf = (c: { chapterId: string }) => `/manga/${encodeURIComponent(id)}/read/${encodeURIComponent(c.chapterId)}?${q}`
  const details = `/manga/${encodeURIComponent(id)}?${q}`
  const chapterLabel = current ? `Chapter ${current.number}` : 'Chapter'

  const theme = BG[prefs.bg]
  const rtl = prefs.mode === 'rtl'
  const paged = prefs.mode !== 'webtoon'
  const last = pages.length - 1
  /** paged modes get one extra "end of chapter" card unless auto-next is on */
  const count = pages.length + (paged && !prefs.autoNext ? 1 : 0)
  const atEnd = paged && !prefs.autoNext && pageIdx >= pages.length

  const update = useCallback((p: Partial<MangaPrefs>) => {
    setPrefs((old) => {
      const n = { ...old, ...p }
      savePrefs(PREFS_KEY, n)
      return n
    })
  }, [])

  const toChapter = useCallback((c?: MangaChapterRef) => c && navigate(urlOf(c)), [navigate, id, q]) // eslint-disable-line react-hooks/exhaustive-deps

  /* chapter change: reset (and make sure the page is never left shifted sideways) */
  useLayoutEffect(() => {
    setPageIdx(0)
    setPanel('none')
    setBar(true)
    setAuto(false)
    window.scrollTo({ top: 0, left: 0 })
  }, [chapterId])

  useEffect(() => {
    document.title = `${chapterLabel} · ${title} — Zenkai`
  }, [chapterLabel, title])

  /* while a panel is open: lock page scroll. On close, always put the page back where it belongs. */
  useEffect(() => {
    if (panel === 'none') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY })
    }
  }, [panel])

  /* fullscreen + wake lock */
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])
  useEffect(() => {
    if (!prefs.keepAwake || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let dead = false
    const grab = () => navigator.wakeLock.request('screen').then((l) => (dead ? void l.release() : (lock = l))).catch(() => {})
    void grab()
    const vis = () => document.visibilityState === 'visible' && void grab()
    document.addEventListener('visibilitychange', vis)
    return () => {
      dead = true
      document.removeEventListener('visibilitychange', vis)
      void lock?.release().catch(() => {})
    }
  }, [prefs.keepAwake])

  /* bookmark */
  const progress = last > 0 ? Math.min(1, pageIdx / last) : pages.length ? 1 : 0
  const latest = useRef(progress)
  latest.current = progress
  useEffect(() => {
    if (!pages.length) return
    const save = () =>
      saveReading({ kind: 'manga', id: readingKey(source, id), title, cover, href: details, resume: urlOf({ chapterId }), label: chapterLabel, progress: latest.current })
    save()
    const t = window.setInterval(save, 4000)
    window.addEventListener('pagehide', save)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [pages.length, id, chapterId, current?.number]) // eslint-disable-line react-hooks/exhaustive-deps

  /* webtoon: scroll to a page by hand (scrollIntoView can shift the whole page sideways) */
  const wrap = useRef<HTMLDivElement>(null)
  const jumpTo = useCallback((i: number) => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-page="${i}"]`)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 2, left: 0 })
  }, [])

  /* resume where you left this chapter, once per chapter */
  const resumed = useRef('')
  useEffect(() => {
    if (!pages.length || resumed.current === chapterId) return
    resumed.current = chapterId
    const saved = getReading('manga', readingKey(source, id))
    if (!saved || saved.resume !== urlOf({ chapterId }) || saved.progress < 0.03 || saved.progress > 0.97) return
    const i = Math.round(saved.progress * (pages.length - 1))
    setPageIdx(i)
    if (prefs.mode === 'webtoon') window.setTimeout(() => jumpTo(i), 450)
  }, [pages.length, chapterId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* warm the next images in paged modes */
  useEffect(() => {
    if (!paged) return
    for (const u of pages.slice(pageIdx + 1, pageIdx + 4)) new Image().src = u
  }, [paged, pageIdx, pages])

  /* webtoon: which page is in view */
  useEffect(() => {
    if (paged || !wrap.current || !pages.length) return
    const els = [...wrap.current.querySelectorAll<HTMLElement>('[data-page]')]
    const ratios = new Map<number, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(Number((e.target as HTMLElement).dataset.page), e.isIntersecting ? e.intersectionRatio : 0)
        let best = 0
        let bestR = -1
        ratios.forEach((r, i) => {
          if (r > bestR) {
            bestR = r
            best = i
          }
        })
        if (bestR > 0) setPageIdx(best)
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [paged, pages, prefs.width, prefs.gap])

  /* webtoon: hide the bars while scrolling down */
  useEffect(() => {
    if (paged) return
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y < 80) setBar(true)
      else if (Math.abs(y - lastY) > 16) setBar(y < lastY)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [paged])

  const step = useCallback(
    (dir: 1 | -1) => {
      // dir: +1 = forward in reading order
      if (dir === 1) {
        if (pageIdx < count - 1) setPageIdx(pageIdx + 1)
        else toChapter(newer)
      } else if (pageIdx > 0) setPageIdx(pageIdx - 1)
      else toChapter(older)
      if (paged) window.scrollTo({ top: 0, left: 0 })
    },
    [pageIdx, count, newer, older, toChapter, paged],
  )

  const goPage = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(pages.length - 1, i))
      setPageIdx(n)
      if (paged) window.scrollTo({ top: 0, left: 0 })
      else jumpTo(n)
    },
    [pages.length, paged, jumpTo],
  )

  const toggleAuto = useCallback(() => {
    if (!auto) setBar(false)
    setAuto(!auto)
  }, [auto])

  /* auto scroll: webtoon = smooth px/s, paged = turn the page every N seconds.
     Stops by itself at the end of the chapter, when the tab is hidden, or when you take over (wheel / touch / scroll keys).
     Paused while a side panel is open. ponytail: no auto-jump to the next chapter; add when asked. */
  const running = auto && panel === 'none' && pages.length > 0
  useEffect(() => {
    if (!auto) return
    const stop = () => setAuto(false)
    const hidden = () => document.hidden && stop()
    const key = (e: KeyboardEvent) => ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End'].includes(e.key) && stop()
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', key)
    }
  }, [auto])

  useEffect(() => {
    if (!running || paged) return
    let raf = 0
    let prev = 0
    let pos = window.scrollY // own float position: scrollY may be rounded, which would swallow slow speeds
    const tick = (t: number) => {
      const dt = prev ? Math.min(t - prev, 100) : 0
      prev = t
      if (Math.abs(window.scrollY - pos) > 50) pos = window.scrollY // layout shift or scrollbar drag: follow it
      pos += (prefs.autoSpeed * 40 * dt) / 1000
      window.scrollTo({ top: pos, left: 0 })
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) return setAuto(false)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, paged, prefs.autoSpeed])

  useEffect(() => {
    if (!running || !paged) return
    if (pageIdx >= last) return setAuto(false)
    const t = window.setTimeout(() => step(1), prefs.autoSecs * 1000)
    return () => window.clearTimeout(t) // a manual turn changes pageIdx and restarts the countdown
  }, [running, paged, pageIdx, last, step, prefs.autoSecs])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') return setPanel('none')
      if (e.key === 'f' || e.key === 'F') return toggleFull()
      if (e.key === 'a' || e.key === 'A') return toggleAuto()
      if (e.key === 'c' || e.key === 'C') return setPanel((p) => (p === 'chapters' ? 'none' : 'chapters'))
      if (e.key === 's' || e.key === 'S') return setPanel((p) => (p === 'settings' ? 'none' : 'settings'))
      if (e.key === '[') return toChapter(older)
      if (e.key === ']') return toChapter(newer)
      if (!paged || panel !== 'none') return // a side panel is open: the D-pad / arrows belong to it
      if (e.key === 'ArrowRight') step(rtl ? -1 : 1)
      else if (e.key === 'ArrowLeft') step(rtl ? 1 : -1)
      else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault()
        step(-1)
      } else if (e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        step(1)
      } else if (e.key === 'Home') goPage(0)
      else if (e.key === 'End') goPage(pages.length - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paged, panel, rtl, step, goPage, pages.length, toChapter, older, newer, toggleFull, toggleAuto])

  /* paged: tap zones + swipe */
  const down = useRef<{ x: number; y: number } | null>(null)
  function onPointerDown(e: React.PointerEvent) {
    down.current = { x: e.clientX, y: e.clientY }
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = down.current
    down.current = null
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) return step(((dx < 0) !== rtl ? 1 : -1) as 1 | -1)
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const r = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const flip = prefs.invertTap ? -1 : 1
      if (prefs.tapZones && x < 0.3) step(((rtl ? 1 : -1) * flip) as 1 | -1)
      else if (prefs.tapZones && x > 0.7) step(((rtl ? -1 : 1) * flip) as 1 | -1)
      else setBar((b) => !b)
    }
  }

  const sorted = useMemo(() => [...chapters].reverse(), [chapters])
  const barShown = bar || panel !== 'none'
  const pct = Math.round(progress * 100)
  const pageNo = Math.min(pageIdx + 1, pages.length)
  const chapterPos = idx >= 0 ? `${idx + 1}/${chapters.length}` : null
  const subtitle = current?.title && current.title.trim() && current.title.trim() !== `Chapter ${current.number}` ? current.title : null
  const topPad = HEADER_H + (prefs.infoBar ? 30 : 0)

  return (
    <div style={{ background: theme.bg, color: theme.fg }} className="min-h-svh overflow-x-clip transition-colors duration-300">
      {/* brightness dimmer: cheaper than filtering every image */}
      {prefs.brightness < 100 && <div aria-hidden className="pointer-events-none fixed inset-0 z-[45] bg-black" style={{ opacity: (100 - prefs.brightness) / 100 }} />}

      <header
        className={cn('fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl transition-transform duration-300', barShown ? 'translate-y-0' : '-translate-y-full')}
        style={{ background: theme.bar, borderColor: 'color-mix(in srgb, currentColor 14%, transparent)' }}
      >
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-1 px-2 sm:px-5">
          <Link to={details} onClick={backTo(details)} aria-label="Back to manga" className="grid size-10 shrink-0 place-items-center rounded-full transition hover:bg-black/10 active:scale-90">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-semibold leading-tight">{title}</p>
            <p className="truncate text-xs opacity-65">
              {current?.volume ? `Vol. ${current.volume} · ` : ''}
              {chapterLabel}
              {subtitle ? ` · ${subtitle}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Fullscreen" onClick={toggleFull} className="hidden size-10 place-items-center rounded-full transition hover:bg-black/10 active:scale-90 sm:grid">
            {full ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
          </button>
          <button type="button" aria-label={auto ? 'Stop auto scroll' : 'Start auto scroll'} aria-pressed={auto} onClick={toggleAuto} className={cn('grid size-10 place-items-center rounded-full transition hover:bg-black/10 active:scale-90', auto && 'bg-accent/20 text-accent')}>
            {auto ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button type="button" aria-label="Chapters" onClick={() => setPanel((p) => (p === 'chapters' ? 'none' : 'chapters'))} className={cn('grid size-10 place-items-center rounded-full transition hover:bg-black/10 active:scale-90', panel === 'chapters' && 'bg-accent/20 text-accent')}>
            <List className="size-5" />
          </button>
          <button type="button" aria-label="Reader settings" onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))} className={cn('grid size-10 place-items-center rounded-full transition hover:bg-black/10 active:scale-90', panel === 'settings' && 'bg-accent/20 text-accent')}>
            <Settings className="size-5" />
          </button>
        </div>
        {prefs.infoBar && (
          <div className="mx-auto flex h-[30px] max-w-4xl items-center gap-x-3 overflow-hidden whitespace-nowrap px-4 text-[11px] tabular-nums opacity-75 sm:px-6">
            <span className="font-semibold text-accent">{pages.length ? `Page ${pageNo}/${pages.length}` : 'Loading…'}</span>
            <span>{pct}%</span>
            {chapterPos && <span>Ch. {chapterPos}</span>}
            <span className="truncate">{sourceName}</span>
            <span>{MODE_LABEL[prefs.mode]}</span>
            <span className="ml-auto shrink-0">
              <Clock />
            </span>
          </div>
        )}
        {/* progress hairline */}
        <div className="h-[3px] w-full bg-current/10">
          <div className="h-full origin-left bg-accent transition-transform duration-200" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      {/* tiny counter that stays when the bars are hidden */}
      {prefs.pageBadge && !barShown && pages.length > 0 && (
        <div aria-hidden className="pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold tabular-nums text-white backdrop-blur-md">
          {pageNo} / {pages.length}
        </div>
      )}

      {pagesQ.loading ? (
        <div className="mx-auto max-w-3xl space-y-1" style={{ paddingTop: topPad }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-none" />
          ))}
        </div>
      ) : pagesQ.error ? (
        <div className="grid min-h-svh place-items-center px-4">
          <div>
            <ErrorState message={pagesQ.error.message} onRetry={pagesQ.reload} />
            <p className="mt-5 text-center text-sm">
              <Link to={details} onClick={backTo(details)} className="font-semibold text-accent hover:underline">
                Back to chapters
              </Link>
            </p>
          </div>
        </div>
      ) : pages.length === 0 ? (
        <div className="grid min-h-svh place-items-center px-6 text-center text-sm opacity-70">This chapter has no pages on this server.</div>
      ) : paged ? (
        <div
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className={cn('mx-auto flex min-h-svh select-none items-start justify-center', prefs.fit === 'original' ? 'touch-auto overflow-auto' : 'touch-pan-y', prefs.fit === 'height' && 'items-center')}
          style={{ maxWidth: prefs.fit === 'width' ? '56rem' : undefined }}
        >
          {atEnd ? (
            <EndCard label={chapterLabel} hasNext={!!newer} hasPrev={!!older} onPrev={() => toChapter(older)} onNext={() => toChapter(newer)} details={details} />
          ) : (
            <PageImg
              key={`${chapterId}:${pageIdx}`}
              source={source}
              src={pages[pageIdx]}
              alt={`Page ${pageIdx + 1}`}
              eager
              className={cn(
                prefs.grayscale && 'grayscale',
                prefs.fit === 'height' && 'mx-auto max-h-svh w-auto object-contain',
                prefs.fit === 'original' && 'mx-auto w-auto max-w-none',
              )}
            />
          )}
        </div>
      ) : (
        <div ref={wrap} className={cn('mx-auto flex flex-col', prefs.grayscale && 'grayscale')} style={{ maxWidth: WEBTOON_W[prefs.width], gap: GAP[prefs.gap], paddingTop: 0 }} onClick={() => setBar((b) => !b)}>
          {pages.map((src, i) => (
            <div key={src + i} data-page={i}>
              <PageImg src={src} source={source} alt={`Page ${i + 1}`} eager={i < 2} />
            </div>
          ))}
          <div onClick={(e) => e.stopPropagation()}>
            <EndCard label={chapterLabel} hasNext={!!newer} hasPrev={!!older} onPrev={() => toChapter(older)} onNext={() => toChapter(newer)} details={details} />
          </div>
        </div>
      )}

      {/* auto scroll controls: stay reachable while the bars are hidden */}
      {auto && pages.length > 0 && (
        <div className={cn('fixed right-3 z-[41] flex items-center gap-1 rounded-full bg-black/70 p-1 text-white shadow-lg backdrop-blur-md transition-[bottom] duration-300', barShown ? 'bottom-20' : 'bottom-4')}>
          <button type="button" aria-label="Pause auto scroll" onClick={() => setAuto(false)} className="grid size-9 place-items-center rounded-full bg-accent text-accent-fg active:scale-90">
            <Pause className="size-4" />
          </button>
          <button
            type="button"
            aria-label={paged ? 'Slower' : 'Slower scroll'}
            disabled={paged ? prefs.autoSecs >= 30 : prefs.autoSpeed <= 1}
            onClick={() => update(paged ? { autoSecs: Math.min(30, prefs.autoSecs + 1) } : { autoSpeed: Math.max(1, prefs.autoSpeed - 1) })}
            className="grid size-9 place-items-center rounded-full active:scale-90 disabled:opacity-30"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-9 text-center text-xs font-semibold tabular-nums">{paged ? `${prefs.autoSecs}s` : `${prefs.autoSpeed}×`}</span>
          <button
            type="button"
            aria-label={paged ? 'Faster' : 'Faster scroll'}
            disabled={paged ? prefs.autoSecs <= 2 : prefs.autoSpeed >= 10}
            onClick={() => update(paged ? { autoSecs: Math.max(2, prefs.autoSecs - 1) } : { autoSpeed: Math.min(10, prefs.autoSpeed + 1) })}
            className="grid size-9 place-items-center rounded-full active:scale-90 disabled:opacity-30"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}

      {/* bottom bar: chapter prev/next + page scrubber (both modes) */}
      {pages.length > 0 && (
        <div className={cn('fixed inset-x-0 bottom-0 z-40 border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl transition-transform duration-300', barShown ? 'translate-y-0' : 'translate-y-full')} style={{ background: theme.bar, borderColor: 'color-mix(in srgb, currentColor 14%, transparent)' }}>
          <div className="mx-auto flex max-w-xl items-center gap-2 text-xs tabular-nums">
            <button type="button" aria-label="Previous chapter" title="Previous chapter" disabled={!older} onClick={() => toChapter(older)} className="grid size-9 shrink-0 place-items-center rounded-full transition enabled:hover:bg-black/10 enabled:active:scale-90 disabled:opacity-30">
              <ChevronLeft className="size-5" />
            </button>
            <span className="w-7 text-right">{pageNo}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, last)}
              value={Math.min(pageIdx, Math.max(0, last))}
              onChange={(e) => goPage(Number(e.target.value))}
              aria-label="Page"
              dir={rtl ? 'rtl' : 'ltr'}
              className="h-1 min-w-0 flex-1 accent-[var(--accent)]"
            />
            <span className="w-7">{pages.length}</span>
            <button type="button" aria-label="Next chapter" title="Next chapter" disabled={!newer} onClick={() => toChapter(newer)} className="grid size-9 shrink-0 place-items-center rounded-full transition enabled:hover:bg-black/10 enabled:active:scale-90 disabled:opacity-30">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      )}

      {/* side panels: always mounted, hidden with visibility once closed, so nothing can stay half-open or catch taps */}
      <button
        type="button"
        aria-label="Close panel"
        tabIndex={panel === 'none' ? -1 : 0}
        onClick={() => setPanel('none')}
        className={cn('fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm transition-[opacity,visibility] duration-300', panel === 'none' ? 'pointer-events-none invisible opacity-0' : 'visible opacity-100')}
      />
      <aside
        data-nav-scope
        aria-hidden={panel === 'none'}
        className={cn('fixed inset-y-0 right-0 z-[56] flex w-full max-w-sm flex-col border-l shadow-2xl transition-[transform,visibility] duration-300 ease-out', panel === 'none' ? 'pointer-events-none invisible translate-x-full' : 'visible translate-x-0')}
        style={{ background: theme.bg, color: theme.fg, borderColor: 'color-mix(in srgb, currentColor 14%, transparent)' }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <h2 className="font-display text-lg font-bold">{panel === 'chapters' ? 'Chapters' : 'Reading settings'}</h2>
          <button type="button" aria-label="Close" onClick={() => setPanel('none')} className="grid size-9 place-items-center rounded-full transition hover:bg-black/10 active:scale-90">
            <X className="size-5" />
          </button>
        </div>
        {panel === 'settings' && <ReaderSettings prefs={prefs} update={update} onReset={() => update(DEFAULT_MANGA)} />}
        {panel === 'chapters' && <Chapters chapters={sorted} currentId={chapterId} href={urlOf} loading={list.loading} onPick={() => setPanel('none')} />}
      </aside>
    </div>
  )
}

function EndCard({ label, hasNext, hasPrev, onPrev, onNext, details }: { label: string; hasNext: boolean; hasPrev: boolean; onPrev: () => void; onNext: () => void; details: string }) {
  const backTo = useBackToDetails()
  return (
    <div className="mx-auto flex min-h-[60svh] w-full max-w-sm flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <p className="font-display text-xl font-bold">{hasNext ? `End of ${label}` : 'You’re all caught up'}</p>
      <div className="flex w-full gap-3">
        <button type="button" disabled={!hasPrev} onClick={onPrev} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition enabled:active:scale-95 disabled:opacity-40" style={{ borderColor: 'color-mix(in srgb, currentColor 25%, transparent)' }}>
          <ArrowLeft className="size-4" /> Prev
        </button>
        <button type="button" disabled={!hasNext} onClick={onNext} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-accent-fg transition enabled:active:scale-95 disabled:opacity-40">
          Next <ArrowRight className="size-4" />
        </button>
      </div>
      <Link to={details} onClick={backTo(details)} className="text-xs font-semibold text-accent hover:underline">
        Back to chapter list
      </Link>
    </div>
  )
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 rounded-2xl border border-current/15 px-4 py-3 text-left transition active:scale-[0.99]">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs opacity-60">{hint}</span>}
      </span>
      <span className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', on ? 'bg-accent' : 'bg-current/25')}>
        <span className={cn('absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform', on && 'translate-x-4')} />
      </span>
    </button>
  )
}

function ReaderSettings({ prefs, update, onReset }: { prefs: MangaPrefs; update: (p: Partial<MangaPrefs>) => void; onReset: () => void }) {
  const lab = 'text-xs font-semibold uppercase tracking-widest opacity-60'
  const seg = (on: boolean) => cn('flex-1 rounded-full border px-3 py-2 text-sm font-medium capitalize transition active:scale-95', on ? 'border-accent bg-accent text-accent-fg' : 'border-current/20')
  const paged = prefs.mode !== 'webtoon'
  return (
    <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 pb-12 pt-2">
      <div className="space-y-2.5">
        <p className={lab}>Reading mode</p>
        <div className="grid gap-2">
          {([
            ['webtoon', 'Webtoon', 'Continuous vertical scroll'],
            ['ltr', 'Left to right', 'Western comics, one page at a time'],
            ['rtl', 'Right to left', 'Traditional manga, one page at a time'],
          ] as const).map(([m, name, hint]) => (
            <button key={m} type="button" aria-pressed={prefs.mode === m} onClick={() => update({ mode: m })} className={cn('rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]', prefs.mode === m ? 'border-accent bg-accent/15' : 'border-current/20')}>
              <span className="block text-sm font-semibold">{name}</span>
              <span className="block text-xs opacity-60">{hint}</span>
            </button>
          ))}
        </div>
      </div>

      {paged ? (
        <div className="space-y-2.5">
          <p className={lab}>Page fit</p>
          <div className="flex gap-2">
            {(['width', 'height', 'original'] as const).map((f) => (
              <button key={f} type="button" className={seg(prefs.fit === f)} onClick={() => update({ fit: f })}>
                {f === 'width' ? 'Width' : f === 'height' ? 'Height' : 'Original'}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            <p className={lab}>Column width</p>
            <div className="flex gap-2">
              {(['narrow', 'medium', 'wide', 'full'] as const).map((w) => (
                <button key={w} type="button" className={seg(prefs.width === w)} onClick={() => update({ width: w })}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2.5">
            <p className={lab}>Space between pages</p>
            <div className="flex gap-2">
              {(['none', 'small', 'large'] as const).map((g) => (
                <button key={g} type="button" className={seg(prefs.gap === g)} onClick={() => update({ gap: g })}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="space-y-2.5">
        <p className={lab}>Background</p>
        <div className="flex flex-wrap gap-2">
          {(['black', 'dark', 'light', 'sepia'] as const).map((b) => (
            <button key={b} type="button" className={seg(prefs.bg === b)} onClick={() => update({ bg: b })}>
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className={lab}>Brightness</p>
          <span className="text-xs tabular-nums opacity-70">{prefs.brightness}%</span>
        </div>
        <input type="range" min={40} max={100} step={5} value={prefs.brightness} onChange={(e) => update({ brightness: Number(e.target.value) })} aria-label="Brightness" className="h-1 w-full accent-[var(--accent)]" />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className={lab}>{paged ? 'Auto page turn' : 'Auto scroll speed'}</p>
          <span className="text-xs tabular-nums opacity-70">{paged ? `${prefs.autoSecs}s per page` : `${prefs.autoSpeed} / 10`}</span>
        </div>
        {paged ? (
          <input type="range" min={2} max={30} step={1} dir="rtl" value={prefs.autoSecs} onChange={(e) => update({ autoSecs: Number(e.target.value) })} aria-label="Seconds per page" className="h-1 w-full accent-[var(--accent)]" />
        ) : (
          <input type="range" min={1} max={10} step={1} value={prefs.autoSpeed} onChange={(e) => update({ autoSpeed: Number(e.target.value) })} aria-label="Auto scroll speed" className="h-1 w-full accent-[var(--accent)]" />
        )}
        <p className="text-xs opacity-60">Start it with the play button at the top or the A key. Touching, scrolling or reaching the end stops it.</p>
      </div>

      <div className="space-y-2">
        <p className={lab}>Display</p>
        <Toggle label="Info bar" hint="Page, progress, chapter, server and time" on={prefs.infoBar} onChange={(v) => update({ infoBar: v })} />
        <Toggle label="Page counter" hint="Small counter while the bars are hidden" on={prefs.pageBadge} onChange={(v) => update({ pageBadge: v })} />
        <Toggle label="Greyscale" on={prefs.grayscale} onChange={(v) => update({ grayscale: v })} />
        <Toggle label="Keep screen on" on={prefs.keepAwake} onChange={(v) => update({ keepAwake: v })} />
      </div>

      {paged && (
        <div className="space-y-2">
          <p className={lab}>Page turning</p>
          <Toggle label="Tap edges to turn" hint="Left and right edge of the screen" on={prefs.tapZones} onChange={(v) => update({ tapZones: v })} />
          <Toggle label="Swap tap sides" on={prefs.invertTap} onChange={(v) => update({ invertTap: v })} />
          <Toggle label="Skip end-of-chapter card" hint="Jump straight to the next chapter" on={prefs.autoNext} onChange={(v) => update({ autoNext: v })} />
        </div>
      )}

      <button type="button" onClick={onReset} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-current/20 py-3 text-sm font-semibold transition active:scale-95">
        <RotateCcw className="size-4" /> Reset to defaults
      </button>
      <p className="hidden text-center text-[11px] opacity-50 sm:block">Keys: ← → turn · C chapters · S settings · F fullscreen · A auto scroll · [ ] chapter</p>
    </div>
  )
}

function Chapters({ chapters, currentId, href, loading, onPick }: { chapters: MangaChapterRef[]; currentId: string; href: (c: MangaChapterRef) => string; loading: boolean; onPick: () => void }) {
  const [f, setF] = useState('')
  const [asc, setAsc] = useState(false) // false = newest first
  const box = useRef<HTMLUListElement>(null)
  const q = f.trim().toLowerCase()
  const base = asc ? [...chapters].reverse() : chapters
  const rows = q ? base.filter((c) => c.number === q || (c.title ?? '').toLowerCase().includes(q)) : base

  /* centre the current chapter by moving only the list itself: scrollIntoView would also scroll the page */
  useEffect(() => {
    const ul = box.current
    const el = ul?.querySelector<HTMLElement>('[data-current="true"]')
    if (ul && el) ul.scrollTop = el.offsetTop - ul.clientHeight / 2 + el.clientHeight / 2
  }, [loading, asc])

  if (loading) return <p className="px-5 text-sm opacity-60">Loading chapters…</p>
  if (!chapters.length) return <p className="px-5 text-sm opacity-60">The chapter list is unavailable.</p>
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 px-5 pb-3">
        <input value={f} onChange={(e) => setF(e.target.value)} inputMode="search" placeholder="Jump to chapter number" className="h-10 min-w-0 flex-1 rounded-full border border-current/20 bg-transparent px-4 text-sm outline-none transition focus:border-accent" />
        <button type="button" aria-label="Reverse order" title={asc ? 'Oldest first' : 'Newest first'} onClick={() => setAsc((a) => !a)} className="grid size-10 shrink-0 place-items-center rounded-full border border-current/20 transition active:scale-90">
          <ArrowDownUp className="size-4" />
        </button>
      </div>
      <ul ref={box} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8">
        {rows.map((c) => {
          const on = c.chapterId === currentId
          return (
            <li key={c.chapterId} data-current={on} className="[content-visibility:auto] [contain-intrinsic-size:auto_44px]">
              <Link to={href(c)} onClick={onPick} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-black/10', on && 'bg-accent/15 font-semibold')}>
                <span className="w-14 shrink-0 font-display font-bold text-accent">Ch. {c.number}</span>
                <span className="min-w-0 flex-1 truncate">{c.title ?? `Chapter ${c.number}`}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
