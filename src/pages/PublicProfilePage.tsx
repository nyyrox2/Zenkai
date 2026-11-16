import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { UserX, Compass, MessageSquare, Bookmark, Lock } from 'lucide-react'
import { fetchPublicProfile, type PublicUserData } from '../lib/profile'
import { PublicProfileCard } from '../components/PublicProfileCard'
import { useAuth } from '../context/AuthContext'
import { useCustomLists, useList } from '../lib/library'
import { WatchlistPanel } from '../components/WatchlistPanel'

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { username: authUsername } = useAuth()
  const selfList = useList()
  const selfLists = useCustomLists()

  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<PublicUserData | null>(null)

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

              <section className="space-y-4" aria-label="User Watchlist">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Bookmark className="size-5 text-foreground" />
                    <h2 className="font-display text-xl font-bold tracking-tight text-foreground">Watchlist</h2>
                  </div>
                  <span className="font-mono text-xs text-muted">{userData.watchlistPrivate && !isSelf ? 'Private' : `${activeWatchlist.length} anime`}</span>
                </div>
                {userData.watchlistPrivate && !isSelf ? (
                  <div className="grid place-items-center rounded-3xl border border-dashed border-border px-6 py-14 text-center">
                    <Lock className="size-9 text-muted/70" />
                    <p className="mt-3 text-sm font-semibold">This watchlist is private</p>
                    <p className="mt-1 max-w-xs text-xs text-muted">@{userData.username} chose to keep their list to themselves.</p>
                  </div>
                ) : (
                  <>
                    {userData.watchlistPrivate && isSelf && (
                      <p className="flex items-center gap-1.5 text-xs text-muted"><Lock className="size-3.5" /> Private: only you can see this list.</p>
                    )}
                    <WatchlistPanel
                      items={activeWatchlist}
                      lists={isSelf && selfLists.length ? selfLists : userData.customLists || []}
                      emptyTitle={`@${userData.username} hasn’t added any anime to their public watchlist yet.`}
                    />
                  </>
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
