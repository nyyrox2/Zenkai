import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBackToDetails } from '../lib/backToDetails'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, List, Minus, Plus, Type, X, RefreshCw } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { DEFAULT_NOVEL, getReading, loadPrefs, savePrefs, saveReading, type NovelPrefs } from '../lib/reading'
import { cn } from '../lib/utils'
import {
  fetchNovelChapter,
  fetchNovelChapters,
  fetchNovelDetail,
  chapterUnit,
  isNovelSource,
  NOVEL_SOURCES,
  type NovelChapterRef,
  type NovelSource, proxiedNovelImage } from '../services/novel'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import NotFoundPage from './NotFoundPage'

const PREFS_KEY = 'zk:novel-prefs:v1'

const THEMES: Record<NovelPrefs['theme'], { label: string; bg: string; fg: string; muted: string; bar: string; swatch: string }> = {
  dark: { label: 'Dark', bg: '#0c0c10', fg: '#dcdce2', muted: 'rgba(220,220,226,.55)', bar: 'rgba(12,12,16,.86)', swatch: '#0c0c10' },
  black: { label: 'Black', bg: '#000000', fg: '#bcbcc4', muted: 'rgba(188,188,196,.5)', bar: 'rgba(0,0,0,.88)', swatch: '#000000' },
  sepia: { label: 'Sepia', bg: '#f3ead6', fg: '#43362a', muted: 'rgba(67,54,42,.6)', bar: 'rgba(243,234,214,.9)', swatch: '#f3ead6' },
  light: { label: 'Light', bg: '#fafafb', fg: '#1b1b20', muted: 'rgba(27,27,32,.6)', bar: 'rgba(250,250,251,.9)', swatch: '#fafafb' },
}
const WIDTHS: Record<NovelPrefs['width'], string> = { narrow: '34rem', normal: '42rem', wide: '54rem' }

export default function NovelReaderPage() {
  const { source: src, slug = '', chapter = '' } = useParams()
  if (!isNovelSource(src) || !slug || !chapter) return <NotFoundPage />
  return <Reader source={src} slug={slug} chapterSlug={chapter} />
}

function Reader({ source, slug, chapterSlug }: { source: NovelSource; slug: string; chapterSlug: string }) {
  const navigate = useNavigate()
  const backTo = useBackToDetails()
  const [prefs, setPrefs] = useState<NovelPrefs>(() => loadPrefs(PREFS_KEY, DEFAULT_NOVEL))
  const [panel, setPanel] = useState<'none' | 'chapters' | 'settings'>('none')
  const [barVisible, setBarVisible] = useState(true)
  const [progress, setProgress] = useState(0)

  const detail = useAsync(() => fetchNovelDetail(source, slug).catch(() => null), [source, slug])
  const list = useAsync(() => fetchNovelChapters(source, slug).catch(() => [] as NovelChapterRef[]), [source, slug])
  const content = useAsync(() => fetchNovelChapter(source, slug, chapterSlug), [source, slug, chapterSlug])

  const chapters = list.data ?? []
  const idx = chapters.findIndex((c) => c.slug === chapterSlug)
  const current = idx >= 0 ? chapters[idx] : undefined
  const prev = idx > 0 ? chapters[idx - 1] : undefined
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : undefined
  const number = current?.number ?? (source === 'lnori' ? '' : chapterSlug.match(/\d+/)?.[0] ?? '')
  const Unit = chapterUnit(source) === 'volume' ? 'Volume' : 'Chapter'
  const base = `/novel/${source}/${encodeURIComponent(slug)}`
  const readUrl = (c: string) => `${base}/read/${encodeURIComponent(c)}`

  const theme = THEMES[prefs.theme]
  const update = useCallback((p: Partial<NovelPrefs>) => {
    setPrefs((old) => {
      const n = { ...old, ...p }
      savePrefs(PREFS_KEY, n)
      return n
    })
  }, [])

  const goPrev = useCallback(() => prev && navigate(readUrl(prev.slug)), [prev, navigate]) // eslint-disable-line react-hooks/exhaustive-deps
  const goNext = useCallback(() => next && navigate(readUrl(next.slug)), [next, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = `${current?.title ?? `${Unit} ${number}`.trim()} · ${detail.data?.title ?? 'Novel'} — Zenkai`
  }, [current?.title, number, detail.data?.title])

  /* new chapter: restore position if this is where the reader left off, otherwise start at the top */
  const restored = useRef('')
  useEffect(() => {
    if (!content.data || restored.current === chapterSlug) return
    restored.current = chapterSlug
    const saved = getReading('novel', `${source}:${slug}`)
    const y = saved?.resume.endsWith(`/read/${encodeURIComponent(chapterSlug)}`) && saved.progress > 0.02 && saved.progress < 0.98 ? saved.progress : 0
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo({ top: y * max })
    })
  }, [content.data, chapterSlug, source, slug])
  useEffect(() => {
    setPanel('none')
    setBarVisible(true)
    setProgress(0)
  }, [chapterSlug])

  /* scroll: progress bar, auto-hiding top bar, throttled bookmark */
  const lastY = useRef(0)
  const timer = useRef(0)
  const latest = useRef({ progress: 0 })
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const p = Math.min(1, Math.max(0, y / max))
      setProgress(p)
      latest.current.progress = p
      if (y < 80) setBarVisible(true)
      else if (Math.abs(y - lastY.current) > 14) setBarVisible(y < lastY.current)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!content.data) return
    const save = () =>
      saveReading({
        kind: 'novel',
        id: `${source}:${slug}`,
        title: detail.data?.title ?? slug.replace(/-/g, ' '),
        cover: detail.data?.cover ?? '',
        href: base,
        resume: readUrl(chapterSlug),
        label: `${Unit} ${number}`.trim(),
        progress: latest.current.progress,
      })
    save()
    timer.current = window.setInterval(save, 4000)
    window.addEventListener('pagehide', save)
    return () => {
      window.clearInterval(timer.current)
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [content.data, detail.data, source, slug, chapterSlug, number]) // eslint-disable-line react-hooks/exhaustive-deps

  /* warm the next chapter so "Next" is instant */
  useEffect(() => {
    if (content.data && next) fetchNovelChapter(source, slug, next.slug).catch(() => {})
  }, [content.data, next, source, slug])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') setPanel('none')
      else if (panel !== 'none') return // a side panel is open: the D-pad / arrows belong to it
      else if (e.key === 'ArrowLeft' || e.key === '[') goPrev()
      else if (e.key === 'ArrowRight' || e.key === ']') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, panel])

  // panel open: freeze page scroll; on close make sure the page is never left shifted sideways (the black-screen bug)
  useEffect(() => {
    if (panel === 'none') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY })
    }
  }, [panel])

  const vars = { '--rd-bg': theme.bg, '--rd-fg': theme.fg, '--rd-muted': theme.muted, '--rd-bar': theme.bar } as CSSProperties
  const alt = NOVEL_SOURCES.filter((s) => s.id !== source)

  return (
    <div style={{ ...vars, background: theme.bg, color: theme.fg }} className="min-h-svh overflow-x-clip transition-colors duration-300">
      {/* progress */}
      <div className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent">
        <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* top bar */}
      <header
        className={cn('fixed inset-x-0 top-0 z-50 border-b px-3 pt-[3px] backdrop-blur-xl transition-transform duration-300 sm:px-5', barVisible || panel !== 'none' ? 'translate-y-0' : '-translate-y-full')}
        style={{ background: theme.bar, borderColor: 'color-mix(in srgb, var(--rd-fg) 12%, transparent)' }}
      >
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2">
          <Link to={base} onClick={backTo(base)} aria-label="Back to novel" className="grid size-10 shrink-0 place-items-center rounded-full transition hover:bg-black/10 active:scale-90">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{detail.data?.title ?? slug.replace(/-/g, ' ')}</p>
            <p className="truncate text-xs" style={{ color: theme.muted }}>
              {current?.title ?? `${Unit} ${number}`.trim()}
            </p>
          </div>
          <button type="button" aria-label="Chapters" onClick={() => setPanel((p) => (p === 'chapters' ? 'none' : 'chapters'))} className="grid size-10 place-items-center rounded-full transition hover:bg-black/10 active:scale-90">
            <List className="size-5" />
          </button>
          <button type="button" aria-label="Reader settings" onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))} className="grid size-10 place-items-center rounded-full transition hover:bg-black/10 active:scale-90">
            <Type className="size-5" />
          </button>
        </div>
      </header>

      {/* text */}
      <article
        onClick={() => setBarVisible((v) => !v)}
        className="mx-auto px-5 pb-32 pt-24 sm:px-8"
        style={{ maxWidth: `calc(${WIDTHS[prefs.width]} + 4rem)` }}
      >
        {content.loading ? (
          <div className="space-y-4" aria-busy>
            <Skeleton className="h-9 w-2/3" />
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className={cn('h-4', i % 4 === 3 ? 'w-1/2' : 'w-full')} />
            ))}
          </div>
        ) : content.error ? (
          <div onClick={(e) => e.stopPropagation()} className="pt-10">
            <ErrorState message={content.error.message} onRetry={content.reload} />
            {alt.length > 0 && (
              <p className="mt-6 text-center text-sm" style={{ color: theme.muted }}>
                Try another source:{' '}
                {alt.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ' · '}
                    <Link to={`/novel/${s.id}/${encodeURIComponent(slug)}/read/${encodeURIComponent(chapterSlug)}`} className="font-semibold text-accent hover:underline">
                      {s.label}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        ) : content.data ? (
          <motion.div key={chapterSlug} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <h1 className="mx-auto font-display text-2xl font-extrabold leading-tight tracking-tight" style={{ maxWidth: WIDTHS[prefs.width] }}>
              {content.data.title}
            </h1>
            <div
              className="mx-auto mt-8"
              style={{
                maxWidth: WIDTHS[prefs.width],
                fontSize: prefs.size,
                lineHeight: prefs.line,
                fontFamily: prefs.font === 'serif' ? 'Georgia, "Iowan Old Style", "Times New Roman", serif' : 'var(--font-sans)',
              }}
            >
              {content.data.paragraphs.map((p, i) => (
                <Block key={i} text={p} />
              ))}
            </div>

            <nav aria-label="Chapter navigation" className="mx-auto mt-14 flex items-center justify-between gap-3" style={{ maxWidth: WIDTHS[prefs.width] }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled={!prev}
                onClick={goPrev}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition enabled:hover:bg-black/10 enabled:active:scale-95 disabled:opacity-40"
                style={{ borderColor: 'color-mix(in srgb, var(--rd-fg) 20%, transparent)' }}
              >
                <ArrowLeft className="size-4" /> Previous
              </button>
              <button type="button" disabled={!next} onClick={goNext} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-accent-fg transition enabled:active:scale-95 disabled:opacity-40">
                Next <ArrowRight className="size-4" />
              </button>
            </nav>
            {!next && idx >= 0 && (
              <p className="mt-6 text-center text-sm" style={{ color: theme.muted }}>
                You&rsquo;re all caught up.
              </p>
            )}
          </motion.div>
        ) : null}
      </article>

      {/* side panels */}
      {/* side panels: always mounted, toggled with CSS so they can never get stuck half-closed */}
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
          <h2 className="font-display text-lg font-bold">{panel === 'chapters' ? `${Unit}s` : 'Reading settings'}</h2>
          <button type="button" aria-label="Close" onClick={() => setPanel('none')} className="grid size-9 place-items-center rounded-full transition hover:bg-black/10 active:scale-90">
            <X className="size-5" />
          </button>
        </div>
        {panel === 'settings' && <Settings prefs={prefs} update={update} muted={theme.muted} />}
        {panel === 'chapters' && <ChapterList chapters={chapters} idx={idx} loading={list.loading} muted={theme.muted} href={readUrl} />}
      </aside>
    </div>
  )
}

/** An illustration: direct first, through the proxy second, then a visible retry (it used to just vanish). */
function Illustration({ src }: { src: string }) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const url = attempt === 1 ? proxiedNovelImage(src) : attempt >= 2 ? `${src}${src.includes('?') ? '&' : '?'}r=${attempt}` : src
  if (attempt >= 3)
    return (
      <button type="button" onClick={() => setAttempt(0)} className="mx-auto my-[1.4em] flex items-center gap-2 rounded-full border border-current/25 px-4 py-2 text-xs font-semibold opacity-80 active:scale-95">
        <RefreshCw className="size-3.5" /> Illustration didn&rsquo;t load. Tap to retry
      </button>
    )
  return (
    <div className={cn('mx-auto my-[1.4em] w-full max-w-full', !loaded && 'aspect-[2/3] max-h-[70svh] animate-pulse rounded-lg bg-current/10')}>
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setAttempt((n) => Math.min(n + 1, 3))}
        className={cn('mx-auto block h-auto max-h-[85svh] w-auto max-w-full rounded-lg transition-opacity duration-300', loaded ? 'opacity-100' : 'h-0 opacity-0')}
      />
    </div>
  )
}

/** One paragraph of a chapter. Light-novel sources mark illustrations "[img]url[/img]", headings "== x ==" and scene breaks "* * *". */
function Block({ text }: { text: string }) {
  const img = text.match(/^\[img\](.+)\[\/img\]$/)
  if (img) return <Illustration src={img[1]} />
  const head = text.match(/^== (.+) ==$/)
  if (head) return <h2 className="mb-[0.7em] mt-[1.6em] text-center font-display text-[1.25em] font-bold leading-snug">{head[1]}</h2>
  if (text === '* * *') return <p aria-hidden className="my-[1.6em] text-center tracking-[0.6em] opacity-60">* * *</p>
  return <p className="mb-[0.9em]">{text}</p>
}

function Settings({ prefs, update, muted }: { prefs: NovelPrefs; update: (p: Partial<NovelPrefs>) => void; muted: string }) {
  const row = 'space-y-2.5'
  const lab = 'text-xs font-semibold uppercase tracking-widest'
  const seg = (on: boolean) => cn('flex-1 rounded-full border px-3 py-2 text-sm font-medium transition active:scale-95', on ? 'border-accent bg-accent text-accent-fg' : 'border-current/20')
  return (
    <div className="flex-1 space-y-7 overflow-y-auto px-5 pb-10 pt-2">
      <div className={row}>
        <p className={lab} style={{ color: muted }}>Theme</p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(THEMES) as NovelPrefs['theme'][]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update({ theme: t })}
              aria-pressed={prefs.theme === t}
              className={cn('rounded-2xl border-2 p-2 text-xs font-medium transition active:scale-95', prefs.theme === t ? 'border-accent' : 'border-transparent')}
              style={{ background: THEMES[t].swatch, color: THEMES[t].fg, outline: '1px solid color-mix(in srgb, currentColor 20%, transparent)' }}
            >
              Aa
              <span className="mt-0.5 block text-[10px] opacity-70">{THEMES[t].label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={row}>
        <p className={lab} style={{ color: muted }}>Font</p>
        <div className="flex gap-2">
          <button type="button" className={seg(prefs.font === 'serif')} onClick={() => update({ font: 'serif' })} style={{ fontFamily: 'Georgia, serif' }}>Serif</button>
          <button type="button" className={seg(prefs.font === 'sans')} onClick={() => update({ font: 'sans' })}>Sans</button>
        </div>
      </div>

      <div className={row}>
        <p className={lab} style={{ color: muted }}>Text size · {prefs.size}px</p>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Smaller text" onClick={() => update({ size: Math.max(14, prefs.size - 1) })} className="grid size-10 place-items-center rounded-full border border-current/20 transition active:scale-90"><Minus className="size-4" /></button>
          <input type="range" min={14} max={30} value={prefs.size} onChange={(e) => update({ size: Number(e.target.value) })} aria-label="Text size" className="h-1 flex-1 accent-[var(--accent)]" />
          <button type="button" aria-label="Larger text" onClick={() => update({ size: Math.min(30, prefs.size + 1) })} className="grid size-10 place-items-center rounded-full border border-current/20 transition active:scale-90"><Plus className="size-4" /></button>
        </div>
      </div>

      <div className={row}>
        <p className={lab} style={{ color: muted }}>Line spacing · {prefs.line.toFixed(2)}</p>
        <input type="range" min={1.4} max={2.4} step={0.05} value={prefs.line} onChange={(e) => update({ line: Number(e.target.value) })} aria-label="Line spacing" className="h-1 w-full accent-[var(--accent)]" />
      </div>

      <div className={row}>
        <p className={lab} style={{ color: muted }}>Page width</p>
        <div className="flex gap-2">
          {(['narrow', 'normal', 'wide'] as const).map((w) => (
            <button key={w} type="button" className={cn(seg(prefs.width === w), 'capitalize')} onClick={() => update({ width: w })}>
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChapterList({ chapters, idx, loading, muted, href }: { chapters: NovelChapterRef[]; idx: number; loading: boolean; muted: string; href: (slug: string) => string }) {
  const [jump, setJump] = useState('')
  const [span, setSpan] = useState({ before: 60, after: 140 })
  const box = useRef<HTMLUListElement>(null)
  // centre the current chapter by moving only the list: scrollIntoView would also shift the whole page sideways
  useEffect(() => {
    const ul = box.current
    const el = ul?.querySelector<HTMLElement>('[data-current="true"]')
    if (ul && el) ul.scrollTop = el.offsetTop - ul.clientHeight / 2 + el.clientHeight / 2
  }, [loading])

  const q = jump.trim().toLowerCase()
  const matches = useMemo(() => (q ? chapters.filter((c) => c.number === q || c.title.toLowerCase().includes(q)).slice(0, 80) : null), [chapters, q])
  const from = Math.max(0, (idx < 0 ? 0 : idx) - span.before)
  const to = Math.min(chapters.length, (idx < 0 ? 0 : idx) + span.after)
  const rows = matches ?? chapters.slice(from, to)

  if (loading) return <p className="px-5 text-sm" style={{ color: muted }}>Loading chapters…</p>
  if (chapters.length === 0) return <p className="px-5 text-sm" style={{ color: muted }}>The chapter list is unavailable for this source.</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pb-3">
        <input
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          inputMode="search"
          placeholder="Jump to number or title"
          className="h-10 w-full rounded-full border border-current/20 bg-transparent px-4 text-sm outline-none transition focus:border-accent"
        />
      </div>
      <ul ref={box} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-8">
        {!matches && from > 0 && (
          <li>
            <button type="button" onClick={() => setSpan((s) => ({ ...s, before: s.before + 150 }))} className="w-full rounded-xl py-2 text-xs font-semibold text-accent">
              Show earlier chapters
            </button>
          </li>
        )}
        {rows.map((c) => {
          const on = chapters[idx]?.slug === c.slug
          return (
            <li key={c.slug} data-current={on}>
              <Link
                to={href(c.slug)}
                className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-black/10', on && 'bg-accent/15 font-semibold')}
              >
                {c.cover ? <img src={c.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-14 w-10 shrink-0 rounded-md bg-current/10 object-cover" /> : <span className="w-12 shrink-0 font-display font-bold text-accent">{c.number}</span>}
                <span className="min-w-0 flex-1 truncate">{c.cover ? `Vol. ${c.number} · ${c.title}` : c.title}</span>
              </Link>
            </li>
          )
        })}
        {!matches && to < chapters.length && (
          <li>
            <button type="button" onClick={() => setSpan((s) => ({ ...s, after: s.after + 200 }))} className="w-full rounded-xl py-2 text-xs font-semibold text-accent">
              Show more chapters
            </button>
          </li>
        )}
      </ul>
    </div>
  )
}
