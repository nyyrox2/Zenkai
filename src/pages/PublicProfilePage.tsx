import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserX, Compass, MessageSquare } from 'lucide-react'
import { fetchPublicProfile, type PublicUserData } from '../lib/profile'
import { PublicProfileCard } from '../components/PublicProfileCard'
import { useAuth } from '../context/AuthContext'

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { username: authUsername } = useAuth()

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

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pb-28 pt-24 sm:px-6">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-xs font-semibold text-foreground backdrop-blur-md transition hover:border-accent hover:text-accent active:scale-95"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <span>Public Profile</span>
          {username && <span className="text-accent">@{username}</span>}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="overflow-hidden rounded-3xl border border-border bg-card/60 shadow-xl">
          <div className="skeleton h-44 w-full sm:h-64" />
          <div className="relative px-6 pb-8 pt-4">
            <div className="flex items-end gap-5">
              <div className="skeleton -mt-16 size-24 shrink-0 rounded-full ring-4 ring-card sm:-mt-20 sm:size-28" />
              <div className="space-y-2 flex-1 pb-2">
                <div className="skeleton h-7 w-48 rounded-xl" />
                <div className="skeleton h-4 w-28 rounded-lg" />
              </div>
            </div>
            <div className="mt-6 skeleton h-20 w-full rounded-2xl" />
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="skeleton h-16 rounded-2xl" />
              <div className="skeleton h-16 rounded-2xl" />
              <div className="skeleton h-16 rounded-2xl" />
            </div>
          </div>
        </div>
      ) : userData ? (
        /* Public Profile Card */
        <PublicProfileCard data={userData} isSelf={isSelf} />
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
