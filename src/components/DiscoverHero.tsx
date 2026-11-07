import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'

/** Top of the Novels / Manga home pages: same plain header as Browse and Schedule, plus the search field. */
export function DiscoverHero({
  eyebrow,
  title,
  accent,
  subtitle,
  query,
  onQuery,
  placeholder,
  children,
}: {
  eyebrow: string
  title: string
  accent: string
  subtitle: string
  query: string
  onQuery: (v: string) => void
  placeholder: string
  children?: ReactNode
}) {
  return (
    <section className="px-4 pb-8 pt-6 sm:px-6 sm:pt-8 md:pt-10">
      <div className="mx-auto max-w-7xl">
        <p className="mb-2 eyebrow text-accent">{eyebrow}</p>
        <h1 className="font-display text-4xl font-black tracking-tight">
          {title} <span className="text-muted">{accent}</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted">{subtitle}</p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <label className="relative block w-full sm:max-w-md">
            <span className="sr-only">{placeholder}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="discover-search"
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={placeholder}
              className="h-12 w-full rounded-full border border-border bg-card/60 pl-11 pr-11 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => onQuery('')} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-foreground/10 hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </label>
          {children}
        </div>
      </div>
    </section>
  )
}
