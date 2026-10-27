import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BookCard, type BookCardItem } from './BookCard'
import { Skeleton } from './Skeleton'

/** Titled, horizontally scrollable shelf of book cards (same shell as AnimeRow). */
export function BookRow({
  eyebrow,
  title,
  items,
  loading = false,
  ranked = false,
}: {
  eyebrow?: string
  title: string
  items?: BookCardItem[]
  loading?: boolean
  ranked?: boolean
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.85, behavior: 'smooth' })

  if (!loading && (!items || items.length === 0)) return null

  return (
    <section className="cv-auto mx-auto w-full max-w-7xl">
      <div className="mb-5 flex items-end justify-between gap-4 px-4 sm:px-6">
        <div>
          {eyebrow && <p className="mb-1 eyebrow text-accent">{eyebrow}</p>}
          <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        </div>
        <div className="hidden gap-2 md:flex">
          {([-1, 1] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-label={`Scroll ${title} ${d < 0 ? 'left' : 'right'}`}
              onClick={() => scroll(d)}
              className="grid size-10 place-items-center rounded-full border border-border bg-card/60 transition hover:bg-foreground hover:text-background active:scale-90"
            >
              {d < 0 ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-proximity scroll-pl-4 scroll-pr-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-4 pt-2 sm:scroll-pl-6 sm:scroll-pr-6 sm:gap-5 sm:px-6"
      >
        {loading || !items
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-[148px] shrink-0 sm:w-[178px] lg:w-[196px]">
                <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                <Skeleton className="mt-3 h-4 w-4/5" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            ))
          : items.map((item, i) => <BookCard key={item.key} item={item} index={i} rank={ranked ? i + 1 : undefined} />)}
      </div>
    </section>
  )
}
