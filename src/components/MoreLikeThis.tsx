import type { CardItem } from '../types/anime'
import { cn } from '../lib/utils'
import { AnimeCard } from './AnimeCard'
import { Skeleton } from './Skeleton'

/** "More like this" poster grid. Stands in for the episode list on movies (they only have one "episode"). */
export function MoreLikeThis({ items, loading, compact = false }: { items: CardItem[]; loading: boolean; compact?: boolean }) {
  const grid = cn('grid gap-x-3 gap-y-5', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5')
  return (
    <div>
      <h2 className="font-display text-xl font-extrabold">More like this</h2>
      <p className={cn('text-sm text-muted', compact ? 'mb-3' : 'mb-4')}>Picked by viewers who watched this</p>
      {loading ? (
        <div className={grid}>
          {Array.from({ length: compact ? 6 : 10 }, (_, i) => <Skeleton key={i} className="aspect-[2/3] w-full rounded-2xl" />)}
        </div>
      ) : items.length > 0 ? (
        <div className={grid}>
          {items.map((r, i) => <AnimeCard key={r.id} item={r} index={i} fluid />)}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">No similar titles found yet.</p>
      )}
    </div>
  )
}
