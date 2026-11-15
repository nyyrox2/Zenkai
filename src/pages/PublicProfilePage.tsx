import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { UserX, Compass, MessageSquare, Bookmark } from 'lucide-react'
import { fetchPublicProfile, type PublicUserData } from '../lib/profile'
import { PublicProfileCard } from '../components/PublicProfileCard'
import { useAuth } from '../context/AuthContext'
import { useList, type ListStatus } from '../lib/library'
import { cn } from '../lib/utils'

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { username: authUsername } = useAuth()
  const selfList = useList()

  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<PublicUserData | null>(null)
  const [filter, setFilter] = useState<'all' | ListStatus>('all')

  useEffect(() => {
    if (!username) {
      setLoading(false)
      return
    }

    let alive = true
    setLoading(true)

    fetchPublicProfile(username)
      .then((data) => {
        if (!alive) return
        setUserData(data)
        if (data) {
          document.title = `${data.profile.name || data.username} (@${data.username}) — Zenkai`
        } else {
          document.title = `@${username} Not Found — Zenkai`
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [username])

  const isSelf =
    !!authUsername &&
    !!username &&
    authUsername.toLowerCase() === username.toLowerCase()

  const activeWatchlist = (isSelf ? (selfList.length > 0 ? selfList : userData?.watchlist) : userData?.watchlist) || []
  const shown = filter === 'all' ? activeWatchlist : activeWatchlist.filter((i) => i.status === filter)

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pt-10">
      {/* Loading Skeleton */}
      {loading ? (
        <div className="pb-8 border-b border-border/40">
          <div className="relative pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
              <div className="skeleton size-24 shrink-0 rounded-full" />
              <div className="space-y-2 flex-1 pb-2">
                <div className="skeleton h-7 w-48 rounded-xl" />
                <div className="skeleton h-4 w-28 rounded-lg" />
                <div className="skeleton h-4 w-64 rounded-lg" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 max-w-sm sm:ml-auto">
              <div className="skeleton h-14 rounded-2xl" />
              <div className="skeleton h-14 rounded-2xl" />
              <div className="skeleton h-14 rounded-2xl" />
            </div>
          </div>
        </div>
      ) : userData ? (
        <div className="space-y-6">
              {/* Public Profile Card */}
              <PublicProfileCard data={userData} isSelf={isSelf} watchlist={activeWatchlist} />

              {/* User Watchlist Showcase with Zenkai Theme Colors */}
              <section className="space-y-4" aria-label="User Watchlist">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Bookmark className="size-5 text-accent fill-accent/20" />
                    <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                      Watchlist
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-muted">
                    {activeWatchlist.length} anime
                  </span>
                </div>

                {/* Filter Pills with Zenkai Theme Accent */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'all' as const, label: 'All', count: activeWatchlist.length },
                    { id: 'watching' as const, label: 'Watching', count: activeWatchlist.filter((i) => i.status === 'watching').length },
                    { id: 'planning' as const, label: 'Planning', count: activeWatchlist.filter((i) => i.status === 'planning').length },
                    { id: 'completed' as const, label: 'Completed', count: activeWatchlist.filter((i) => i.status === 'completed').length },
                    { id: 'paused' as const, label: 'Paused', count: activeWatchlist.filter((i) => i.status === 'paused').length },
                    { id: 'dropped' as const, label: 'Dropped', count: activeWatchlist.filter((i) => i.status === 'dropped').length },
                  ].map((f) => {
                    const on = filter === f.id
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={cn(
                          'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-mono font-semibold transition active:scale-95',
                          on
                            ? 'bg-accent text-accent-fg font-bold shadow-md shadow-accent/25'
                            : 'border border-[#242730] bg-card/60 text-muted hover:border-border hover:text-foreground'
                        )}
                      >
                        {f.label} ({f.count})
                      </button>
                    )
                  })}
                </div>

                {/* Cards Grid */}
                {shown.length === 0 ? (
                  <div className="grid place-items-center rounded-3xl border border-dashed border-border/80 bg-card/20 px-6 py-14 text-center">
                    <Bookmark className="size-10 text-muted/50 mb-2" />
                    <p className="font-semibold text-foreground">
                      {activeWatchlist.length === 0
                        ? `@${userData.username} hasn’t added any anime to their public watchlist yet.`
                        : `No anime marked "${filter}"`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {shown.map((item) => (
                      <div key={item.id} className="group/card relative">
                        <Link to={`/anime/${item.id}`} className="block outline-none">
                          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border/70 bg-card-2 transition duration-200 group-hover:scale-[1.02] group-hover:border-accent/40 group-hover:shadow-2xl">
                            <img
                              src={item.image}
                              alt={item.title}
                              loading="lazy"
                              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            {item.score ? (
                              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 backdrop-blur-sm">
                                ★ {item.score}
                              </span>
                            ) : null}
                            {item.progress ? (
                              <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-white backdrop-blur-sm">
                                Ep {item.progress}{item.episodes ? ` / ${item.episodes}` : ''}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-2.5 line-clamp-1 text-xs sm:text-sm font-bold text-foreground transition-colors group-hover:text-accent">
                            {item.title}
                          </h3>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>
        </div>
      ) : (
        /* Not Found Fallback */
        <div className="rounded-3xl border border-border bg-card/60 p-8 text-center sm:p-12 shadow-xl">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-card-2 text-muted">
            <UserX className="size-8" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold">Otaku Not Found</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            We couldn’t find an active user with the handle{' '}
            <span className="font-semibold text-foreground">@{username}</span>. They may not have signed in yet or might have changed their username.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/community"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95"
            >
              <MessageSquare className="size-4" />
              <span>Community Lounge</span>
            </Link>
            <Link
              to="/home"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent active:scale-95"
            >
              <Compass className="size-4" />
              <span>Explore Zenkai</span>
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
