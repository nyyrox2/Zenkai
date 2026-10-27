import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Star } from 'lucide-react'
import { fetchAiring } from '../services/anilist'
import { useAsync } from '../hooks/useAsync'
import { cn, formatLabel, pickTitle, toScore10 } from '../lib/utils'
import type { AniAiringEntry } from '../types/anime'
import { ErrorState } from '../components/ErrorState'
import { GradientText } from '../components/GradientText'
import { Skeleton } from '../components/Skeleton'

const DAY = 86400
const BEFORE = 3
const AFTER = 10

const midnight = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const time = (ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function until(sec: number) {
  if (sec <= 0) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h >= 24 ? `in ${Math.floor(h / 24)}d ${h % 24}h` : h ? `in ${h}h ${m}m` : `in ${Math.max(m, 1)}m`
}

function Entry({ e, now }: { e: AniAiringEntry; now: number }) {
  const m = e.media
  const title = pickTitle(m.title)
  const aired = e.airingAt <= now
  const label = until(e.airingAt - now)
  const fmt = formatLabel(m.format)
  return (
    <li className="group relative flex gap-4 rounded-2xl border border-border bg-card/60 p-3 transition hover:border-accent/50 hover:bg-card sm:p-4">
      <Link to={`/anime/${m.id}`} className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-xl bg-card-2 sm:w-20" style={{ backgroundColor: m.coverImage.color ?? undefined }}>
        <img src={m.coverImage.large ?? ''} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <Link to={`/anime/${m.id}`} className="line-clamp-2 font-semibold leading-snug transition-colors hover:text-accent">
            {title}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            <span className="font-semibold text-foreground">Episode {e.episode}</span>
            {fmt !== '—' && <span>{fmt}</span>}
            {m.averageScore ? (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3 fill-current" />
                {toScore10(m.averageScore)}
              </span>
            ) : null}
            <span className="hidden sm:inline">{m.genres.slice(0, 2).join(' · ')}</span>
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', aired ? 'bg-card-2 text-muted' : 'bg-accent/15 text-accent')}>
            {aired ? 'Aired' : label}
          </span>
          {aired ? (
            <Link to={`/watch/${m.id}?ep=${e.episode}`} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition active:scale-95">
              <Play className="size-3 fill-current" /> Watch
            </Link>
          ) : (
            <Link to={`/anime/${m.id}`} className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold transition hover:bg-foreground hover:text-background active:scale-95">
              Details
            </Link>
          )}
        </div>
      </div>
    </li>
  )
}

export default function SchedulePage() {
  const today = useMemo(() => midnight(new Date()), [])
  const days = useMemo(() => Array.from({ length: BEFORE + AFTER + 1 }, (_, i) => new Date(today.getTime() + (i - BEFORE) * DAY * 1000)), [today])
  const [sel, setSel] = useState(BEFORE)
  const [japanOnly, setJapanOnly] = useState(false)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const strip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'Schedule — Zenkai'
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000)
    return () => window.clearInterval(t)
  }, [])

  const from = Math.floor(days[sel].getTime() / 1000)
  const data = useAsync(() => fetchAiring(from - 1, from + DAY), [from])

  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [sel])

  const groups = useMemo(() => {
    const list = (data.data ?? []).filter((e) => !japanOnly || e.media.countryOfOrigin === 'JP')
    const map = new Map<string, AniAiringEntry[]>()
    for (const e of list.sort((a, b) => a.airingAt - b.airingAt || (b.media.popularity ?? 0) - (a.media.popularity ?? 0))) {
      const k = time(e.airingAt)
      map.set(k, [...(map.get(k) ?? []), e])
    }
    return [...map.entries()]
  }, [data.data, japanOnly])

  const total = groups.reduce((n, [, l]) => n + l.length, 0)
  const nextKey = groups.find(([, l]) => l[0].airingAt > now)?.[0]
  const tz = new Intl.DateTimeFormat([], { timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
      <header>
        <p className="mb-2 eyebrow text-accent">Release calendar</p>
        <h1 className="font-display text-4xl font-black tracking-tight">
          <GradientText>Schedule</GradientText>
        </h1>
        <p className="mt-3 text-muted">Episodes airing each day, in your local time{tz ? ` (${tz})` : ''}.</p>
      </header>

      <div className="sticky top-[4.5rem] z-30 -mx-4 mt-8 border-y border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div ref={strip} role="tablist" aria-label="Day" className="no-scrollbar flex gap-2 overflow-x-auto">
          {days.map((d, i) => {
            const on = i === sel
            const isToday = i === BEFORE
            return (
              <button
                key={d.toISOString()}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setSel(i)}
                className={cn(
                  'relative flex w-[4.2rem] shrink-0 flex-col items-center rounded-2xl border py-2 transition active:scale-95',
                  on ? 'border-transparent bg-foreground text-background shadow-lg' : 'border-border bg-card/60 text-muted hover:text-foreground',
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">{isToday ? 'Today' : d.toLocaleDateString([], { weekday: 'short' })}</span>
                <span className="font-display text-xl font-bold leading-tight">{d.getDate()}</span>
                <span className="text-[10px]">{d.toLocaleDateString([], { month: 'short' })}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">
          {days[sel].toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          {!data.loading && <span className="ml-2 text-sm font-medium text-muted">{total} episodes</span>}
        </h2>
        <button
          type="button"
          onClick={() => setJapanOnly((v) => !v)}
          aria-pressed={japanOnly}
          className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95', japanOnly ? 'border-transparent bg-accent text-accent-fg' : 'border-border text-muted')}
        >
          Japan only
        </button>
      </div>

      {data.error ? (
        <div className="mt-10">
          <ErrorState message={data.error.message} onRetry={data.reload} />
        </div>
      ) : data.loading ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : total === 0 ? (
        <p className="mt-16 text-center text-muted">No episodes scheduled for this day.</p>
      ) : (
        <ol className="relative mt-6 space-y-7 border-l border-border pl-5 sm:pl-8">
          {groups.map(([t, list]) => (
            <li key={t} className="relative">
              <span className={cn('absolute -left-[1.62rem] top-1.5 size-3 rounded-full border-2 border-background sm:-left-[2.37rem]', t === nextKey ? 'bg-accent ring-4 ring-accent/25' : list[0].airingAt <= now ? 'bg-muted' : 'bg-foreground')} />
              <p className="mb-3 flex items-center gap-2 font-display text-lg font-bold tabular-nums">
                {t}
                {t === nextKey && <span className="rounded-full bg-accent px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-accent-fg">Up next</span>}
              </p>
              <ul className="space-y-3">
                {list.map((e) => (
                  <Entry key={e.id} e={e} now={now} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
