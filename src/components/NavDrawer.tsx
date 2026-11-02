import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Film,
  BookOpen,
  Book,
  Clapperboard,
  MessageSquare,
  Compass,
  CalendarDays,
  Bookmark,
  Sparkles,
  Download,
  Code2,
  User,
  LogOut,
  ChevronRight,
  Flame,
  Star,
  Search,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../lib/profile'
import { useSearch } from '../context/SearchContext'
import { Avatar } from './Avatar'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '../lib/utils'

interface NavSection {
  title: string
  items: {
    label: string
    to: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
    isExternal?: boolean
  }[]
}

export function NavDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { pathname } = useLocation()
  const { user, username, signOut } = useAuth()
  const me = useProfile()
  const { openSearch } = useSearch()
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on route change
  useEffect(() => {
    onClose()
  }, [pathname])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const SECTIONS: NavSection[] = [
    {
      title: 'Anime Hub',
      items: [
        { label: 'Anime Home', to: '/home', icon: Film },
        { label: 'Trending', to: '/trending', icon: Flame, badge: 'Hot' },
        { label: 'Popular', to: '/popular', icon: Sparkles },
        { label: 'Top Rated', to: '/top', icon: Star },
        { label: 'Browse Catalog', to: '/browse', icon: Compass },
        { label: 'Release Schedule', to: '/schedule', icon: CalendarDays },
        { label: 'My Watchlist', to: '/list', icon: Bookmark },
      ],
    },
    {
      title: 'Manga & Novels',
      items: [
        { label: 'Manga Hub', to: '/manga', icon: BookOpen },
        { label: 'Browse Manga', to: '/manga/browse', icon: Compass },
        { label: 'Light Novels Hub', to: '/novel', icon: Book },
        { label: 'Find Novels', to: '/novel/find', icon: Search },
      ],
    },
    {
      title: 'Movies & TV',
      items: [
        { label: 'Movies Hub', to: '/movies', icon: Clapperboard },
        { label: 'Browse Movies & Series', to: '/movies/browse', icon: Compass },
      ],
    },
    {
      title: 'Social & Inbox',
      items: [
        { label: 'Direct Messages', to: '/messages', icon: MessageSquare },
        { label: 'Community Lounge', to: '/community', icon: Users, badge: 'Live' },
        ...(username ? [{ label: 'My Public Profile', to: `/u/${username}`, icon: User }] : []),
      ],
    },
    {
      title: 'Apps & Docs',
      items: [
        { label: 'Android App', to: '/app', icon: Download, badge: 'APK' },
        { label: 'API & Embed Docs', to: '/docs', icon: Code2 },
      ],
    },
  ]

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Drawer Sidebar */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative flex h-full w-[88vw] max-w-sm flex-col border-r border-border bg-card/95 shadow-2xl backdrop-blur-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border/70 p-4 sm:px-6">
              <div className="flex items-center gap-3">
                <Logo size={32} showText={false} />
                <span className="font-display text-sm font-bold tracking-tight text-foreground">
                  Navigation
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-card-2 hover:text-foreground active:scale-90"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* User Profile Card (if logged in) */}
            <div className="border-b border-border/60 p-4 sm:px-6">
              {user ? (
                <Link
                  to="/profile"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card-2/60 p-3 transition hover:border-accent/40 active:scale-[0.98]"
                >
                  <Avatar size={40} src={me.avatar} frame={me.frame} name={me.name} animateFrame />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">
                      {me.name || 'Your Profile'}
                    </p>
                    <p className="truncate text-[11px] text-accent">
                      @{username || user.email?.split('@')[0]}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted" />
                </Link>
              ) : (
                <Link
                  to="/profile"
                  onClick={onClose}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-xs font-bold text-background transition hover:opacity-90 active:scale-95"
                >
                  <User className="size-4" />
                  <span>Sign In / Register</span>
                </Link>
              )}

              {/* Quick Search Button in Drawer */}
              <button
                type="button"
                onClick={() => {
                  onClose()
                  openSearch()
                }}
                className="mt-2.5 flex h-10 w-full items-center gap-2.5 rounded-xl border border-border bg-card-2/80 px-3 text-xs text-muted transition hover:border-accent/40 hover:text-foreground"
              >
                <Search className="size-4" />
                <span>Search anime, manga, movies…</span>
              </button>
            </div>

            {/* Scrollable Navigation Sections */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 overscroll-contain">
              {SECTIONS.map((sec) => (
                <div key={sec.title}>
                  <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                    {sec.title}
                  </h3>
                  <div className="mt-1.5 space-y-0.5">
                    {sec.items.map((item) => {
                      const Icon = item.icon
                      const isActive = pathname === item.to
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={cn(
                            'flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-[0.98]',
                            isActive
                              ? 'bg-accent/15 text-accent font-bold shadow-sm'
                              : 'text-foreground/90 hover:bg-card-2 hover:text-foreground'
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={cn('size-4', isActive ? 'text-accent' : 'text-muted')} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[9px] font-bold text-accent">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Drawer Footer */}
            {user && (
              <div className="border-t border-border/70 p-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    void signOut()
                  }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-card-2/40 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10 active:scale-95"
                >
                  <LogOut className="size-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
