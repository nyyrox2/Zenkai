import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Compass, Download, Search, Menu } from 'lucide-react'
import { MOVIE_LINKS, NAV_LINKS } from '../lib/constants'
import { sectionOf } from '../lib/sections'
import { cn } from '../lib/utils'
import { useSearch } from '../context/SearchContext'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from './Avatar'
import { NavbarMessagesOverlay } from './NavbarMessagesOverlay'
import { NavDrawer } from './NavDrawer'
import { useProfile } from '../lib/profile'

/** Floating glass navbar (Aceternity "Floating Navbar") with an animated hover pill. */
export function Navbar() {
  const { openSearch } = useSearch()
  const me = useProfile()
  const { pathname, search } = useLocation()
  const section = sectionOf(pathname)
  const anime = section === 'anime'
  const movies = section === 'movies'
  const links = anime ? NAV_LINKS : movies ? MOVIE_LINKS : null
  const browseTo = movies ? '/movies/browse' : '/manga/browse'
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Movies home / details open on a dark full-bleed backdrop: keep the bar light-on-dark until it turns into glass
  const overHero = movies && !scrolled && (pathname === '/movies' || /^\/movies\/(movie|tv)\/\d+$/.test(pathname))
  const [hovered, setHovered] = useState<string | null>(null)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6', overHero && 'dark text-foreground')} data-section={overHero ? 'movies' : undefined}>
      <nav
        aria-label="Main"
        className={cn(
          'mx-auto flex h-14 max-w-7xl 2xl:max-w-screen-2xl items-center justify-between rounded-full border px-3 transition-all duration-300 sm:px-4 gap-2',
          scrolled ? 'border-border bg-glass shadow-xl shadow-black/10 md:backdrop-blur-xl' : 'border-transparent bg-transparent',
        )}
      >
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            title="Menu"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card/60 transition hover:border-accent hover:text-accent active:scale-90"
          >
            <Menu className="size-4" />
          </button>
          <Logo size={34} to={anime ? '/home' : `/${section}`} textClassName="hidden 2xl:inline" />
        </div>

        {links && (
        <ul className="hidden items-center md:flex shrink min-w-0 gap-0.5 overflow-hidden" onMouseLeave={() => setHovered(null)}>
          {links.map((l, idx) => {
            const hideOnSmall = idx >= 6 ? 'hidden 2xl:block' : idx >= 4 ? 'hidden xl:block' : 'block'
            return (
              <li key={l.to} className={cn('relative shrink-0', hideOnSmall)} onMouseEnter={() => setHovered(l.to)}>
                {hovered === l.to && (
                  <motion.span
                    layoutId="nav-hover"
                    className="absolute inset-0 rounded-full bg-foreground/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <Link
                  to={l.to}
                  className={cn(
                    'relative z-10 block whitespace-nowrap px-2 py-1 text-xs font-medium transition-colors hover:text-foreground lg:px-2.5 lg:py-1.5 lg:text-sm',
                    pathname + (l.to.includes('?') ? search : '') === l.to ? 'text-foreground font-semibold' : 'text-muted',
                  )}
                >
                  {l.label}
                </Link>
              </li>
            )
          })}
        </ul>
        )}

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!anime && (
            <Link to={`/${section}`} className={cn('shrink-0 items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold backdrop-blur transition active:scale-95 sm:px-3.5 sm:text-sm', movies ? 'hidden sm:inline-flex' : 'inline-flex')}>
              <span className="font-display text-accent">{section === 'novel' ? '小説' : movies ? '映画' : '漫画'}</span>
              {section === 'novel' ? 'Novels' : movies ? 'Movies' : 'Manga'}
            </Link>
          )}
          {(section === 'manga' || movies) && (
            <Link
              to={browseTo}
              aria-label={movies ? 'Browse movies' : 'Browse manga'}
              className={cn(
                'shrink-0 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition active:scale-95 sm:px-4',
                pathname === browseTo ? 'bg-foreground text-background' : 'bg-accent text-accent-fg hover:brightness-110',
              )}
            >
              <Compass className="size-4" />
              <span className="hidden sm:inline">Browse</span>
            </Link>
          )}
          {(anime || movies) && (
            <>
          <button
            type="button"
            onClick={() => openSearch()}
            className="hidden h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card/60 pl-3 pr-3 text-sm text-muted transition hover:border-accent/40 hover:text-foreground sm:inline-flex"
          >
            <Search className="size-4 shrink-0 text-muted" />
            <span className="hidden 2xl:inline">{movies ? 'Search movies' : 'Search anime'}</span>
            <span className="hidden sm:inline 2xl:hidden">Search</span>
            <kbd className="hidden 2xl:inline-flex rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted">
              {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>
          <button
            type="button"
            aria-label="Search"
            onClick={() => openSearch()}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card/60 transition active:scale-90 sm:hidden"
          >
            <Search className="size-4" />
          </button>
          {anime && <Link
            to="/app"
            className={cn(
              'hidden h-9 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition active:scale-95 2xl:inline-flex',
              pathname === '/app' ? 'bg-foreground text-background' : 'bg-accent text-accent-fg hover:brightness-110',
            )}
          >
            <Download className="size-4" />
            Get app
          </Link>}
            </>
          )}
          <ThemeToggle />
          <NavbarMessagesOverlay />
          <Link to="/profile" aria-label="Your profile" title={me.name || 'Profile'} className="ml-0.5 shrink-0 rounded-full transition active:scale-90 sm:ml-1">
            <Avatar size={34} src={me.avatar} frame={me.frame} name={me.name} />
          </Link>
        </div>
      </nav>
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  )
}
