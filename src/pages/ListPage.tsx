import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { useAniList } from '../lib/anilist'
import { setStatus, STATUS_LABEL, useList, type ListStatus } from '../lib/library'
import { AnimeCard } from '../components/AnimeCard'
import { ContinueRow } from '../components/ContinueRow'
import { GradientText } from '../components/GradientText'
import { Tabs } from '../components/Tabs'

type Filter = 'all' | ListStatus
const STATUSES = Object.keys(STATUS_LABEL) as ListStatus[]

// ponytail: stored in this browser only — add Supabase sync / export-import when accounts exist
export default function ListPage() {
  const list = useList()
  const al = useAniList()
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    document.title = 'My List — Zenkai'
  }, [])

  const count = (s: ListStatus) => list.filter((i) => i.status === s).length
  const shown = filter === 'all' ? list : list.filter((i) => i.status === filter)

  return (
    <main className="pb-24 pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="mb-2 eyebrow text-accent">{al?.user ? `Synced with AniList · ${al.user.name}` : 'Saved on this device'}</p>
        <h1 className="font-display text-4xl font-black tracking-tight">
          <GradientText>My List</GradientText>
        </h1>
      </div>

      <ContinueRow className="mt-10" />

      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6" aria-label="Watchlist">
        <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Watchlist</h2>
        {list.length > 0 && (
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            tabs={[{ id: 'all', label: 'All', count: list.length }, ...STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s], count: count(s) }))]}
          />
        )}

        {list.length === 0 ? (
          <div className="mt-8 grid place-items-center rounded-3xl border border-dashed border-border px-6 py-16 text-center">
            <Bookmark className="size-10 text-muted" />
            <p className="mt-4 font-semibold">Your list is empty</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Tap the bookmark on any poster, or “My List” on a title page, to save it here.</p>
            <Link to="/browse" className="mt-5 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition active:scale-95">
              Browse anime
            </Link>
          </div>
        ) : shown.length === 0 ? (
          <p className="mt-8 text-sm text-muted">Nothing marked “{STATUS_LABEL[filter as ListStatus]}” yet.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {shown.map((i, n) => (
              <div key={i.id}>
                <AnimeCard item={{ ...i, href: `/anime/${i.id}`, caption: i.progress ? `Ep ${i.progress}${i.episodes ? ` / ${i.episodes}` : ''}` : undefined }} fluid index={n % 24} />
                <select
                  aria-label={`Status for ${i.title}`}
                  value={i.status}
                  onChange={(e) => setStatus(i.id, e.target.value as ListStatus)}
                  className="mt-2 w-full rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
