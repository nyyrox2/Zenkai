import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert, LoaderCircle, Search } from 'lucide-react'
import { MANGA_SOURCES, mangaHref } from '../lib/mangaModels'
import { bestSimilarity, MATCH_AT, searchVariants } from '../lib/match'
import { searchManga } from '../services/manga'
import { NOVEL_SOURCES, searchNovels } from '../services/novel'
import { BookCard, type BookCardItem } from '../components/BookCard'
import { Reveal } from '../components/Reveal'
import NotFoundPage from './NotFoundPage'

type Kind = 'manga' | 'novel'
interface Hit extends BookCardItem {
  score: number
}
interface Lane {
  id: string
  label: string
  status: 'loading' | 'done'
  hits: Hit[]
}

const KINDS: Record<Kind, { noun: string; plural: string; lanes: { id: string; label: string }[]; search: (id: string, q: string) => Promise<BookCardItem[]> }> = {
  manga: {
    noun: 'manga',
    plural: 'manga',
    lanes: MANGA_SOURCES.map((s) => ({ id: s.id, label: s.displayName })),
    search: async (id, q) =>
      (await searchManga(q, id as (typeof MANGA_SOURCES)[number]['id'])).map((m) => ({
        key: `${m.source}:${m.id}`,
        href: mangaHref(m),
        title: m.title,
        image: m.poster,
        badge: m.kind,
        score: m.score ? m.score.toFixed(1) : null,
        caption: m.latest ?? (m.chapters ? `${m.chapters} chapters` : m.status),
      })),
  },
  novel: {
    noun: 'light novel',
    plural: 'novels',
    lanes: NOVEL_SOURCES.map((s) => ({ id: s.id, label: s.label })),
    search: async (id, q) =>
      (await searchNovels(id as (typeof NOVEL_SOURCES)[number]['id'], q)).map((n) => ({
        key: `${n.source}:${n.slug}`,
        href: `/novel/${n.source}/${encodeURIComponent(n.slug)}`,
        title: n.title,
        image: n.cover,
        score: n.rating,
        caption: n.stats,
        genres: n.genres,
      })),
  },
}

/**
 * "Where can I read this?" — the landing spot for a manga or light novel linked from an anime. Looks the title up on every
 * server at once, matches the results by name, and lists what each server has. Opening a card goes straight to that
 * server's details page.
 */
export default function FindPage() {
  const kind: Kind = useLocation().pathname.startsWith('/novel') ? 'novel' : 'manga'
  const [p] = useSearchParams()
  const title = p.get('title') ?? ''
  const alt = p.get('alt') ?? ''
  const cover = p.get('cover') ?? ''
  if (!title) return <NotFoundPage />
  return <Finder key={`${kind}:${title}`} kind={kind} title={title} alt={alt} cover={cover} />
}

function Finder({ kind, title, alt, cover }: { kind: Kind; title: string; alt: string; cover: string }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [again, setAgain] = useState('')
  const cfg = KINDS[kind]
  const names = useMemo(() => [title, ...alt.split('|').filter(Boolean)], [title, alt])
  const [lanes, setLanes] = useState<Lane[]>(() => cfg.lanes.map((l) => ({ ...l, status: 'loading', hits: [] })))
  const [more, setMore] = useState(false)

  useEffect(() => {
    document.title = `Read ${title} — Zenkai`
  }, [title])

  useEffect(() => {
    let live = true
    const variants = searchVariants(names)
    for (const lane of cfg.lanes) {
      void (async () => {
        const seen = new Map<string, Hit>()
        for (const v of variants) {
          const found = await cfg.search(lane.id, v).catch(() => [] as BookCardItem[])
          for (const f of found) if (!seen.has(f.key)) seen.set(f.key, { ...f, score: bestSimilarity(f.title, names) })
          if ([...seen.values()].some((h) => h.score >= MATCH_AT)) break // good enough, skip the looser searches
        }
        const hits = [...seen.values()].sort((a, b) => b.score - a.score)
        if (live) setLanes((old) => old.map((l) => (l.id === lane.id ? { ...l, status: 'done', hits } : l)))
      })()
    }
    return () => {
      live = false
    }
  }, [cfg, names])

  const searching = lanes.filter((l) => l.status === 'loading').length
  const matches = lanes.flatMap((l) => l.hits.filter((h) => h.score >= MATCH_AT).slice(0, 2).map((h) => ({ ...h, lane: l.label }))).sort((a, b) => b.score - a.score)
  const similar = lanes.flatMap((l) => l.hits.filter((h) => h.score < MATCH_AT).slice(0, 4).map((h) => ({ ...h, lane: l.label })))
  const missing = lanes.filter((l) => l.status === 'done' && !l.hits.some((h) => h.score >= MATCH_AT))

  const card = (h: Hit & { lane: string }, i: number) => (
    <BookCard key={h.key} index={i} fluid item={{ ...h, caption: [h.lane, h.caption].filter(Boolean).join(' · ') }} />
  )

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/home'))}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-card active:scale-95"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <header className="flex items-center gap-4 sm:gap-6">
        {cover && <img src={cover} alt="" referrerPolicy="no-referrer" className="aspect-[2/3] w-20 shrink-0 rounded-2xl border border-border object-cover shadow-xl sm:w-28" />}
        <div className="min-w-0">
          <p className="mb-1 eyebrow text-accent">Read the {cfg.noun}</p>
          <h1 className="font-display text-3xl font-black leading-tight tracking-tight [text-wrap:balance]">{title}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted" role="status">
            {searching > 0 ? (
              <>
                <LoaderCircle className="size-4 animate-spin" /> Checking {searching} of {lanes.length} servers…
              </>
            ) : matches.length > 0 ? (
              <>Found on {lanes.length - missing.length} of {lanes.length} servers. Pick one to open it.</>
            ) : (
              <>
                <CircleAlert className="size-4" /> No server has it under this name.
              </>
            )}
          </p>
        </div>
      </header>

      <Reveal>
        <section className="mt-10">
          {matches.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">{matches.map(card)}</div>
          ) : searching === 0 ? (
            <p className="rounded-3xl border border-border bg-card/60 p-8 text-center text-sm text-muted">
              Nothing matched “{title}” closely.{' '}
              <Link to={kind === 'manga' ? `/manga?search=1` : `/novel?search=1`} className="font-semibold text-accent hover:underline">
                Search {cfg.plural} yourself
              </Link>
              {similar.length > 0 && ' or look through the similar titles below.'}
            </p>
          ) : null}
        </section>

        {searching === 0 && (
          <form
            className="mt-8 flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const t = again.trim()
              if (t) navigate(`${pathname}?${new URLSearchParams({ title: t })}`)
            }}
          >
            <label className="relative block flex-1">
              <span className="sr-only">Search under another name</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Try another name…" className="h-10 w-full rounded-full border border-border bg-card/60 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30" />
            </label>
            <button type="submit" className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-accent-fg transition active:scale-95">
              Search
            </button>
          </form>
        )}

        {missing.length > 0 && matches.length > 0 && (
          <p className="mt-8 text-xs text-muted">Not found on {missing.map((m) => m.label).join(', ')}.</p>
        )}

        {similar.length > 0 && (
          <section className="mt-10">
            <button type="button" onClick={() => setMore((m) => !m)} className="text-sm font-semibold text-accent hover:underline">
              {more ? 'Hide' : 'Show'} {similar.length} similar titles
            </button>
            {more && <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">{similar.map(card)}</div>}
          </section>
        )}
      </Reveal>
    </main>
  )
}
