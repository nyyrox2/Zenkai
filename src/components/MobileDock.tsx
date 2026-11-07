import { Link, useLocation } from 'react-router-dom'
import { Bookmark, Clapperboard, Compass, House, Menu, Search, Tv, type LucideIcon } from 'lucide-react'
import { useSearch } from '../context/SearchContext'
import { sectionOf } from '../lib/sections'
import { cn } from '../lib/utils'

interface MobileDockProps {
  onOpenDrawer?: () => void
}

const items: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Home', to: '/home', icon: House },
  { label: 'Library', to: '/list', icon: Bookmark },
  { label: 'Browse', to: '/browse', icon: Compass },
]

const movieItems: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Home', to: '/movies', icon: House },
  { label: 'Movies', to: '/movies/browse?type=movie', icon: Clapperboard },
  { label: 'TV Shows', to: '/movies/browse?type=tv', icon: Tv },
]

/** Bottom tab bar shown on phones only — thumb-friendly navigation. */
export function MobileDock({ onOpenDrawer }: MobileDockProps) {
  const { openSearch } = useSearch()
  const { pathname, search } = useLocation()
  const section = sectionOf(pathname)
  if (section !== 'anime' && section !== 'movies') return null
  const list = section === 'movies' ? movieItems : items

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-3 bottom-3 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-center justify-between rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-2xl shadow-black/20">
        {/* Left items */}
        {list.slice(0, 2).map((it) => {
          const active = section === 'movies' ? pathname + search === it.to : pathname === it.to
          const Icon = it.icon
          return (
            <li key={it.label}>
              <Link
                to={it.to}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 text-[10px] font-medium transition active:scale-90',
                  active ? 'text-foreground' : 'text-muted',
                )}
              >
                <Icon className={cn('size-5 transition-transform', active && 'scale-110')} />
                {it.label}
              </Link>
            </li>
          )
        })}

        {/* Center Search Button */}
        <li>
          <button
            type="button"
            aria-label="Search"
            onClick={() => openSearch()}
            className="-mt-7 grid size-13 place-items-center rounded-full bg-foreground text-background shadow-xl shadow-black/30 transition active:scale-90"
          >
            <Search className="size-5.5" />
          </button>
        </li>

        {/* Right item */}
        {list.slice(2, 3).map((it) => {
          const active = pathname === it.to
          const Icon = it.icon
          return (
            <li key={it.label}>
              <Link
                to={it.to}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 text-[10px] font-medium transition active:scale-90',
                  active ? 'text-foreground' : 'text-muted',
                )}
              >
                <Icon className={cn('size-5 transition-transform', active && 'scale-110')} />
                {it.label}
              </Link>
            </li>
          )
        })}

        {/* Menu Drawer Button */}
        <li>
          <button
            type="button"
            onClick={onOpenDrawer}
            className="flex flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 text-[10px] font-medium text-muted transition hover:text-foreground active:scale-90"
          >
            <Menu className="size-5" />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  )
}
