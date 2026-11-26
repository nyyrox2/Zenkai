import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Search, MessagesSquare, Bookmark } from 'lucide-react'
import { Logo } from './Logo'
import { Avatar } from './Avatar'
import { ThemeToggle } from './ThemeToggle'
import { useProfile } from '../lib/profile'
import { useSearch } from '../context/SearchContext'
import { cn } from '../lib/utils'

interface MobileHeaderProps {
  onOpenDrawer: () => void
}

export function MobileHeader({ onOpenDrawer }: MobileHeaderProps) {
  const me = useProfile()
  const { openSearch } = useSearch()
  // Clear over the page at the top, frosted glass once you scroll.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const chip = 'grid size-9 place-items-center rounded-xl border border-white/10 bg-background/30 text-foreground/80 backdrop-blur-md transition hover:text-foreground active:scale-90'

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b px-3 transition-[background-color,border-color,backdrop-filter] duration-300 md:hidden',
        scrolled ? 'border-white/10 bg-background/30 backdrop-blur-xl backdrop-saturate-150' : 'border-transparent bg-transparent',
      )}
    >
      {/* soft top fade keeps the icons readable over banners and posters while the bar is clear */}
      <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 -z-10 h-20 bg-gradient-to-b from-background/55 to-transparent transition-opacity duration-300', scrolled && 'opacity-0')} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open navigation menu"
          className={chip}
        >
          <Menu className="size-5" />
        </button>
        <Logo size={28} to="/home" textClassName="text-sm font-bold" />
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          to="/list"
          aria-label="Watchlist"
          className={chip}
        >
          <Bookmark className="size-4" />
        </Link>
        <Link
          to="/community"
          aria-label="Community"
          className={chip}
        >
          <MessagesSquare className="size-4" />
        </Link>
        <button
          type="button"
          onClick={() => openSearch()}
          aria-label="Search"
          className={chip}
        >
          <Search className="size-4" />
        </button>
        <ThemeToggle />
        <Link to="/profile" aria-label="Profile" className="ml-1 shrink-0 rounded-full active:scale-90 transition">
          <Avatar size={30} src={me.avatar} frame={me.frame} name={me.name} />
        </Link>
      </div>
    </header>
  )
}
