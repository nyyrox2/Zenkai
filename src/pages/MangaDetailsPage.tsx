import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMarkDetails, useSmartBack } from '../lib/backToDetails'
import { ArrowLeft, ArrowUpDown, BookOpen, RefreshCw, Search, Share2, Star } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { useReading } from '../lib/reading'
import { cn } from '../lib/utils'
import { mangaShareUrl, shareLink } from '../lib/share'
import { MANGA_SOURCES, mangaHref, mangaSourceInfo, readingKey, resolveMangaSource, sourceParams, type MangaSourceId } from '../lib/mangaModels'
import { bestMatch, fetchMangaChapters, fetchMangaMeta, resolveWorkerId, searchManga, type MangaChapterRef } from '../services/manga'
import { BorderBeam } from '../components/BorderBeam'
import { ErrorState } from '../components/ErrorState'
import { Reveal } from '../components/Reveal'
import { ShimmerButton } from '../components/ShimmerButton'
import { Skeleton } from '../components/Skeleton'
import { StarBorder } from '../components/StarBorder'
import NotFoundPage from './NotFoundPage'

const PAGE = 100

export default function MangaDetailsPage() {
  const { id = '' } = useParams()
  if (!id) return <NotFoundPage />
  return <Details id={id} />
}

function Details({ id }: { id: string }) {
  const navigate = useNavigate()
  useMarkDetails()
  const [params] = useSearchParams()
  const titleParam = params.get('title') ?? ''
  const coverParam = params.get('cover') ?? ''
  const source = resolveMangaSource(params.get('source'))
  const info = mangaSourceInfo(source)

  const meta = useAsync(() => (titleParam ? fetchMangaMeta(titleParam) : Promise.resolve(null)), [titleParam])
  const data = useAsync(async () => {
    const wid = await resolveWorkerId(id, titleParam, source)
    if (!wid) throw new Error(`Couldn’t find this title on ${info.displayName}. Try another server below, or search for it from the manga page.`)
    return { wid, chapters: await fetchMangaChapters(wid, source) }
  }, [id, titleParam, source])

  const wid = data.data?.wid ?? id
  const saved = useReading('manga').find((r) => r.id === readingKey(source, wid))
  const m = meta.data
  const title = m?.title || titleParam || 'Manga'
  const cover = m?.cover || coverParam
  const chapters = data.data?.chapters ?? []

  const [asc, setAsc] = useState(false)
  const [range, setRange] = useState(0)
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [coverOk, setCoverOk] = useState(true)
  const [switching, setSwitching] = useState<MangaSourceId | null>(null)
  const [missing, setMissing] = useState<MangaSourceId | null>(null)

  useEffect(() => {
    document.title = `${title} — Zenkai`
    window.scrollTo({ top: 0 })
  }, [title])

  const shown = useMemo<MangaChapterRef[]>(() => {
    const f = filter.trim().toLowerCase()
    const base = f ? chapters.filter((c) => c.number === f || (c.title ?? '').toLowerCase().includes(f)) : chapters
    return asc ? base : [...base].reverse()
  }, [chapters, asc, filter])
  const pages = Math.ceil(shown.length / PAGE)
  const slice = shown.slice(range * PAGE, range * PAGE + PAGE)
  useEffect(() => setRange(0), [asc, filter])

  const readUrl = (c: MangaChapterRef) => `/manga/${encodeURIComponent(wid)}/read/${encodeURIComponent(c.chapterId)}?${new URLSearchParams({ title, cover, ...sourceParams(source) })}`
  const first = chapters[0]
  const latest = chapters[chapters.length - 1]
  const resume = saved?.resume ?? (first ? readUrl(first) : null)

  /** Same title on another server: search it there and jump to the best match. */
  async function switchTo(target: MangaSourceId) {
    if (target === source || switching) return
    setSwitching(target)
    setMissing(null)
    try {
      const hit = bestMatch(await searchManga(titleParam || title, target), titleParam || title)
      if (hit) navigate(mangaHref({ ...hit, poster: hit.poster || cover }))
      else setMissing(target)
    } catch {
      setMissing(target)
    } finally {
      setSwitching(null)
    }
  }

  const back = useSmartBack('/manga')

  const desc = m?.description ?? ''
  const long = desc.length > 420
  const banner = m?.banner

  return (
    <main className="pb-20">
      <section className="relative overflow-hidden px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        {(banner || (cover && coverOk)) && (
          <img src={banner || cover} alt="" referrerPolicy="no-referrer" className={cn('absolute inset-0 h-full w-full object-cover opacity-30', !banner && 'scale-125 blur-3xl')} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

        <div className="relative mx-auto max-w-6xl">
          <button type="button" onClick={back} className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-card active:scale-95">
            <ArrowLeft className="size-4" /> Back
          </button>

          <div className="flex flex-col gap-8 md:flex-row md:gap-10">
            <div className="relative mx-auto aspect-[2/3] w-52 shrink-0 overflow-hidden rounded-3xl border border-border bg-card-2 shadow-2xl shadow-black/30 md:mx-0 md:w-64" style={{ backgroundColor: m?.color ?? undefined }}>
              {cover && coverOk ? (
                <img src={cover} alt={title} referrerPolicy="no-referrer" onError={() => setCoverOk(false)} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center p-4 text-center font-display text-lg font-bold text-muted">{title}</div>
              )}
              <BorderBeam size={200} duration={9} />
            </div>

            <div className="min-w-0 flex-1 text-center md:text-left">
              <p className="mb-2 eyebrow text-accent">{[m?.format ?? 'Manga', m?.status, m?.year].filter(Boolean).join(' · ')}</p>
              <h1 className="font-display text-3xl font-black leading-tight tracking-tight [text-wrap:balance]">{title}</h1>
              {m?.nativeTitle && <p className="mt-1 text-sm text-muted">{m.nativeTitle}</p>}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted md:justify-start">
                {m?.score && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                    <Star className="size-4 fill-current text-accent" /> {m.score.toFixed(1)}
                  </span>
                )}
                {chapters.length > 0 && <span>{chapters.length.toLocaleString()} chapters</span>}
                {m?.volumes && <span>{m.volumes} volumes</span>}
                {m && m.authors.length > 0 && <span>by {m.authors.slice(0, 2).join(', ')}</span>}
              </div>

              {m && m.genres.length > 0 && (
                <ul className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                  {m.genres.slice(0, 8).map((g) => (
                    <li key={g} className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted">
                      {g}
                    </li>
                  ))}
                </ul>
              )}

              {meta.loading && !m ? (
                <Skeleton className="mt-5 h-24 w-full" />
              ) : (
                desc && (
                  <>
                    <p className={cn('mt-5 whitespace-pre-line text-sm leading-relaxed text-muted', !open && long && 'line-clamp-5')}>{desc}</p>
                    {long && (
                      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 text-sm font-semibold text-accent hover:underline">
                        {open ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </>
                )
              )}

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                {resume ? (
                  <StarBorder to={resume}>
                    <BookOpen className="size-4" /> {saved ? `Continue · ${saved.label}` : 'Start reading'}
                  </StarBorder>
                ) : (
                  <span className="text-sm text-muted">{data.loading ? 'Loading chapters…' : 'No chapters found'}</span>
                )}
                {latest && !saved && chapters.length > 1 && (
                  <ShimmerButton variant="ghost" to={readUrl(latest)}>
                    Latest · Ch. {latest.number}
                  </ShimmerButton>
                )}
                <ShimmerButton variant="ghost" onClick={() => shareLink(mangaShareUrl(wid, title, cover, sourceParams(source)), `${title} — Zenkai`)} icon={<Share2 className="size-4" />}>
                  Share
                </ShimmerButton>
                <ShimmerButton variant="ghost" to="/manga">
                  More manga
                </ShimmerButton>
              </div>

              <div className="mt-6">
                <p className="mb-2 eyebrow text-muted">Server</p>
                <div role="group" aria-label="Choose a server" className="flex flex-wrap justify-center gap-2 md:justify-start">
                  {MANGA_SOURCES.map((x) => {
                    const on = x.id === source
                    return (
                      <button
                        key={x.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!!switching}
                        onClick={() => void switchTo(x.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95 disabled:opacity-60',
                          on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card/60 text-muted hover:text-foreground',
                        )}
                      >
                        {switching === x.id && <RefreshCw className="size-3 animate-spin" />}
                        {x.displayName}
                      </button>
                    )
                  })}
                </div>
                {missing && (
                  <p role="status" className="mt-2 text-xs text-muted">
                    Couldn&rsquo;t find &ldquo;{titleParam || title}&rdquo; on {mangaSourceInfo(missing).displayName}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Reveal>
        <section className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 eyebrow text-accent">Read online</p>
              <h2 className="font-display text-2xl font-bold tracking-tight">Chapters</h2>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative block flex-1 sm:w-64 sm:flex-none">
                <span className="sr-only">Find a chapter</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Chapter number"
                  inputMode="search"
                  className="h-10 w-full rounded-full border border-border bg-card/60 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <button type="button" onClick={() => setAsc((a) => !a)} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card/60 px-4 text-sm font-medium transition hover:bg-card active:scale-95">
                <ArrowUpDown className="size-4" /> {asc ? 'Oldest first' : 'Newest first'}
              </button>
            </div>
          </div>

          {data.error ? (
            <ErrorState message={data.error.message} onRetry={data.reload} />
          ) : data.loading ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : chapters.length === 0 ? (
            <ErrorState message="The source returned no chapters for this title." onRetry={data.reload} />
          ) : (
            <>
              {pages > 1 && (
                <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
                  {Array.from({ length: pages }, (_, i) => {
                    const a = shown[i * PAGE]
                    const b = shown[Math.min(i * PAGE + PAGE, shown.length) - 1]
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRange(i)}
                        className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition active:scale-95', range === i ? 'border-foreground bg-foreground text-background' : 'border-border bg-card/60 text-muted hover:text-foreground')}
                      >
                        {a.number}–{b.number}
                      </button>
                    )
                  })}
                </div>
              )}
              {slice.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">No chapter matches “{filter}”.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {slice.map((c) => {
                    const isLast = saved?.resume.includes(`/read/${encodeURIComponent(c.chapterId)}`)
                    return (
                      <li key={c.chapterId}>
                        <Link
                          to={readUrl(c)}
                          className={cn('group flex items-center gap-3 rounded-2xl border bg-card/60 px-4 py-3 transition hover:border-accent hover:bg-card', isLast ? 'border-accent' : 'border-border')}
                        >
                          <span className="w-14 shrink-0 font-display text-sm font-bold text-accent">Ch. {c.number}</span>
                          <span className="min-w-0 flex-1 truncate text-sm transition-colors group-hover:text-accent">{c.title ?? `Chapter ${c.number}`}</span>
                          {isLast && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-fg">LAST READ</span>}
                        </Link>
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
