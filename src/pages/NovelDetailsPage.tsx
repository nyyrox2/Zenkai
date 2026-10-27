import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMarkDetails, useSmartBack } from '../lib/backToDetails'
import { ArrowLeft, ArrowUpDown, BookOpen, Search } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { useReading } from '../lib/reading'
import { cn } from '../lib/utils'
import { chapterUnit, fetchNovelChapters, fetchNovelDetail, isNovelSource, NOVEL_SOURCES, type NovelChapterRef, type NovelSource } from '../services/novel'
import { BorderBeam } from '../components/BorderBeam'
import { ErrorState } from '../components/ErrorState'
import { Reveal } from '../components/Reveal'
import { ShimmerButton } from '../components/ShimmerButton'
import { Skeleton } from '../components/Skeleton'
import { StarBorder } from '../components/StarBorder'
import NotFoundPage from './NotFoundPage'

const PAGE = 100

export default function NovelDetailsPage() {
  const { source: src, slug = '' } = useParams()
  if (!isNovelSource(src) || !slug) return <NotFoundPage />
  return <Details source={src} slug={slug} />
}

function Details({ source, slug }: { source: NovelSource; slug: string }) {
  const unit = chapterUnit(source)
  useMarkDetails()
  const detail = useAsync(() => fetchNovelDetail(source, slug), [source, slug])
  const chapters = useAsync(() => fetchNovelChapters(source, slug), [source, slug])
  const saved = useReading('novel').find((r) => r.id === `${source}:${slug}`)

  const [asc, setAsc] = useState(true)
  const [range, setRange] = useState(0)
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [coverOk, setCoverOk] = useState(true)

  const d = detail.data
  useEffect(() => {
    document.title = `${d?.title ?? 'Novel'} — Zenkai`
    window.scrollTo({ top: 0 })
  }, [d?.title])

  const list = chapters.data ?? []
  const shown = useMemo<NovelChapterRef[]>(() => {
    const f = filter.trim().toLowerCase()
    const base = f ? list.filter((c) => c.number === f || c.title.toLowerCase().includes(f) || `chapter ${c.number}`.includes(f)) : list
    return asc ? base : [...base].reverse()
  }, [list, asc, filter])
  const pages = Math.ceil(shown.length / PAGE)
  const slice = shown.slice(range * PAGE, range * PAGE + PAGE)
  useEffect(() => setRange(0), [asc, filter])

  const first = list[0]
  const resume = saved?.resume ?? (first ? `/novel/${source}/${encodeURIComponent(slug)}/read/${encodeURIComponent(first.slug)}` : null)

  const back = useSmartBack('/novel')

  if (detail.error && !d)
    return (
      <main className="grid min-h-[70svh] place-items-center px-4 pt-24">
        <ErrorState message={detail.error.message} onRetry={detail.reload} />
      </main>
    )

  const synopsis = d?.synopsis ?? ''
  const long = synopsis.length > 420

  return (
    <main className="pb-20">
      <section className="relative overflow-hidden px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        {d?.cover && coverOk && <img src={d.cover} alt="" referrerPolicy="no-referrer" onError={() => setCoverOk(false)} className="absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-3xl" />}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

        <div className="relative mx-auto max-w-6xl">
          <button type="button" onClick={back} className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-card active:scale-95">
            <ArrowLeft className="size-4" /> Back
          </button>

          <div className="flex flex-col gap-8 md:flex-row md:gap-10">
            <div className="relative mx-auto aspect-[2/3] w-52 shrink-0 overflow-hidden rounded-3xl border border-border bg-card-2 shadow-2xl shadow-black/30 md:mx-0 md:w-64">
              {!d ? (
                <Skeleton className="size-full rounded-none" />
              ) : coverOk && d.cover ? (
                <img src={d.cover} alt={d.title} referrerPolicy="no-referrer" onError={() => setCoverOk(false)} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center p-4 text-center font-display text-lg font-bold text-muted">{d.title}</div>
              )}
              <BorderBeam size={200} duration={9} />
            </div>

            <div className="min-w-0 flex-1 text-center md:text-left">
              {!d ? (
                <div className="space-y-4">
                  <Skeleton className="mx-auto h-10 w-3/4 md:mx-0" />
                  <Skeleton className="mx-auto h-4 w-1/3 md:mx-0" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <>
                  <p className="mb-2 eyebrow text-accent">
                    {NOVEL_SOURCES.find((s) => s.id === source)?.label} · {source === 'lnori' ? 'Light novel' : 'Web novel'}
                  </p>
                  <h1 className="font-display text-3xl font-black leading-tight tracking-tight [text-wrap:balance]">{d.title}</h1>
                  <p className="mt-2 text-sm text-muted">
                    by <span className="font-medium text-foreground">{d.author}</span>
                    {list.length > 0 && <> · {list.length.toLocaleString()} {unit}s</>}
                  </p>

                  <ul className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                    {d.genres.slice(0, 8).map((g) => (
                      <li key={g} className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted">
                        {g}
                      </li>
                    ))}
                  </ul>

                  <p className={cn('mt-5 whitespace-pre-line text-sm leading-relaxed text-muted', !open && long && 'line-clamp-5')}>{synopsis}</p>
                  {long && (
                    <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 text-sm font-semibold text-accent hover:underline">
                      {open ? 'Show less' : 'Read more'}
                    </button>
                  )}

                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                    {resume ? (
                      <StarBorder to={resume}>
                        <BookOpen className="size-4" /> {saved ? `Continue · ${saved.label}` : source === 'lnori' ? 'Read volume 1' : 'Start reading'}
                      </StarBorder>
                    ) : (
                      <span className="text-sm text-muted">{chapters.loading ? `Loading ${unit}s…` : `No ${unit}s found`}</span>
                    )}
                    <ShimmerButton variant="ghost" to="/novel">
                      More novels
                    </ShimmerButton>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <Reveal>
        <section className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 eyebrow text-accent">Table of contents</p>
              <h2 className="font-display text-2xl font-bold tracking-tight">{unit === 'volume' ? 'Volumes' : 'Chapters'}</h2>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative block flex-1 sm:w-64 sm:flex-none">
                <span className="sr-only">Find a chapter</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={`${unit === 'volume' ? 'Volume' : 'Chapter'} number or title`}
                  inputMode="search"
                  className="h-10 w-full rounded-full border border-border bg-card/60 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <button
                type="button"
                onClick={() => setAsc((a) => !a)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card/60 px-4 text-sm font-medium transition hover:bg-card active:scale-95"
              >
                <ArrowUpDown className="size-4" /> {asc ? 'Oldest first' : 'Newest first'}
              </button>
            </div>
          </div>

          {chapters.error ? (
            <ErrorState message={chapters.error.message} onRetry={chapters.reload} />
          ) : chapters.loading ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              {pages > 1 && (
                <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
                  {Array.from({ length: pages }, (_, i) => {
                    const from = i * PAGE
                    const a = shown[from]
                    const b = shown[Math.min(from + PAGE, shown.length) - 1]
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRange(i)}
                        className={cn(
                          'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95',
                          range === i ? 'border-foreground bg-foreground text-background' : 'border-border bg-card/60 text-muted hover:text-foreground',
                        )}
                      >
                        {a.number}–{b.number}
                      </button>
                    )
                  })}
                </div>
              )}
              {slice.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">No {unit} matches “{filter}”.</p>
              ) : (
                <ul className={cn('grid gap-2 sm:grid-cols-2', unit === 'volume' && 'grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5')}>
                  {slice.map((c) => {
                    const isLast = saved?.resume.endsWith(`/read/${encodeURIComponent(c.slug)}`)
                    return (
                      <li key={c.slug}>
                        {unit === 'volume' ? (
                          <Link
                            to={`/novel/${source}/${encodeURIComponent(slug)}/read/${encodeURIComponent(c.slug)}`}
                            className={cn('group relative block overflow-hidden rounded-2xl border bg-card/60 transition hover:border-accent', isLast ? 'border-accent' : 'border-border')}
                          >
                            <div className="aspect-[2/3] w-full bg-card">
                              {c.cover ? (
                                <img src={c.cover} alt={c.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                              ) : (
                                <span className="grid size-full place-items-center font-display text-4xl font-black text-accent/60">{c.number}</span>
                              )}
                            </div>
                            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-2.5 pt-8 text-white">
                              <span className="block text-[10px] font-bold uppercase tracking-widest text-accent">Volume {c.number}</span>
                              <span className="line-clamp-2 text-xs font-medium leading-snug">{c.title}</span>
                            </span>
                            {isLast && <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg">LAST READ</span>}
                          </Link>
                        ) : (
                        <Link
                          to={`/novel/${source}/${encodeURIComponent(slug)}/read/${encodeURIComponent(c.slug)}`}
                          className={cn(
                            'group flex items-center gap-3 rounded-2xl border bg-card/60 px-4 py-3 transition hover:border-accent hover:bg-card',
                            isLast ? 'border-accent' : 'border-border',
                          )}
                        >
                          <span className="w-12 shrink-0 font-display text-sm font-bold text-accent">{c.number}</span>
                          <span className="min-w-0 flex-1 truncate text-sm transition-colors group-hover:text-accent">{c.title}</span>
                          {isLast && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg">LAST READ</span>}
                        </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </Reveal>
    </main>
  )
}
