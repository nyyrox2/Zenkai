import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { useAniList } from '../lib/anilist'
import { setStatus, useCustomLists, useList } from '../lib/library'
import { ContinueRow } from '../components/ContinueRow'
import { WatchlistPanel } from '../components/WatchlistPanel'

// ponytail: stored in this browser only — add Supabase sync / export-import when accounts exist
export default function ListPage() {
  const list = useList()
  const al = useAniList()
  const customLists = useCustomLists()

  useEffect(() => {
    document.title = 'My List — Zenkai'
  }, [])

  return (
    <main className="pb-28 pt-6 sm:pt-8 md:pb-16 md:pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="mb-2 eyebrow text-muted">{al?.user ? `Synced with AniList · ${al.user.name}` : 'Saved on this device'}</p>
        <h1 className="font-display text-4xl font-black tracking-tight">
          My List
        </h1>
      </div>

      <ContinueRow className="mt-10" />

      <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6" aria-label="Watchlist">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold tracking-tight">Watchlist</h2>
          <span className="text-xs text-muted">{list.length} saved</span>
        </div>
        {list.length === 0 ? (
          <div className="grid place-items-center rounded-3xl border border-dashed border-border px-6 py-16 text-center">
            <Bookmark className="size-10 text-muted" />
            <p className="mt-4 font-semibold">Your list is empty</p>
            <p className="mt-1 max-w-sm text-sm text-muted">Tap the bookmark on any poster, or “My List” on a title page, to save it here.</p>
            <Link to="/browse" className="mt-5 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition active:scale-95">
              Browse anime
            </Link>
          </div>
        ) : (
          <WatchlistPanel items={list} lists={customLists} onStatus={setStatus} />
        )}
      </section>
    </main>
  )
}
