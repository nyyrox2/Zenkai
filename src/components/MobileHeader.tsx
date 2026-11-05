import { Link } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import { Logo } from './Logo'
import { Avatar } from './Avatar'
import { ThemeToggle } from './ThemeToggle'
import { useProfile } from '../lib/profile'
import { useSearch } from '../context/SearchContext'

interface MobileHeaderProps {
  onOpenDrawer: () => void
}

export function MobileHeader({ onOpenDrawer }: MobileHeaderProps) {
  const me = useProfile()
  const { openSearch } = useSearch()

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-3 backdrop-blur-lg md:hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open navigation menu"
          className="grid size-9 place-items-center rounded-xl border border-border bg-card/60 text-muted transition hover:text-foreground active:scale-90"
        >
          <Menu className="size-5" />
        </button>
        <Logo size={28} to="/home" textClassName="text-sm font-bold" />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => openSearch()}
          aria-label="Search"
          className="grid size-9 place-items-center rounded-xl border border-border bg-card/60 text-muted transition hover:text-foreground active:scale-90"
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
