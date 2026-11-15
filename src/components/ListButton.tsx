import { Bookmark, BookmarkCheck } from 'lucide-react'
import { meta, toggleList, useListItem, type Meta } from '../lib/library'
import { cn } from '../lib/utils'

/** Add / remove a title from the local watchlist. `pill` is the labelled button, `icon` the round one overlaid on posters. */
export function ListButton({ item, variant = 'pill', className }: { item: Meta; variant?: 'pill' | 'icon'; className?: string }) {
  const inList = !!useListItem(item.id)
  const Icon = inList ? BookmarkCheck : Bookmark
  const label = inList ? 'Remove from My List' : 'Add to My List'
  const click = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleList(meta(item))
  }

  if (variant === 'icon')
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={inList}
        title={label}
        onClick={click}
        className={cn(
          'absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-black/70 text-white backdrop-blur transition hover:scale-110 hover:bg-accent hover:text-accent-fg focus-visible:opacity-100 active:scale-90 group-hover/card:opacity-100 pointer-coarse:opacity-100',
          inList ? 'opacity-100 bg-accent text-accent-fg' : 'opacity-0',
          className,
        )}
      >
        <Icon className="size-4" />
      </button>
    )

  return (
    <button
      type="button"
      aria-pressed={inList}
      onClick={click}
      className={cn(
        'inline-flex items-center gap-1.5 border transition active:scale-95',
        inList ? 'border-transparent bg-accent text-accent-fg' : 'border-border hover:bg-foreground hover:text-background',
        className,
      )}
    >
      <Icon className="size-4" /> {inList ? 'In My List' : 'My List'}
    </button>
  )
}
