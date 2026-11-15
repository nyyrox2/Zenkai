import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { useSearch } from '../context/SearchContext'

/** Slim top bar for pages that run without the sidebar (player, details): logo, search, a few links. */
export function SiteHeader() {
  const { openSearch } = useSearch()
  return (
    <header className="relative z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background px-3 sm:px-4">
      <Logo size={28} to="/home" textClassName="text-base font-extrabold" />
      <button
        type="button"
        onClick={() => openSearch()}
        className="ml-2 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm font-semibold text-muted transition-colors hover:text-foreground sm:max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search anime…</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] font-bold sm:inline">Ctrl K</kbd>
      </button>
      <nav className="ml-auto hidden items-center gap-1 text-sm font-bold md:flex">
        <Link to="/home" className="rounded-md px-3 py-1.5 text-muted transition-colors hover:text-foreground">Home</Link>
        <Link to="/browse" className="rounded-md px-3 py-1.5 text-muted transition-colors hover:text-foreground">Browse</Link>
        <Link to="/schedule" className="rounded-md px-3 py-1.5 text-muted transition-colors hover:text-foreground">Schedule</Link>
        <Link to="/list" className="rounded-md px-3 py-1.5 text-muted transition-colors hover:text-foreground">My List</Link>
      </nav>
      <ThemeToggle />
    </header>
  )
}
