import { Link } from 'react-router-dom'
import { Play, X } from 'lucide-react'
import { removeHistory, useHistory, type HistoryItem } from '../lib/library'
import { cn } from '../lib/utils'

const left = (h: HistoryItem) => {
  if (h.dur > 0 && h.pos >= h.dur * 0.9) return 'Completed'
  if (h.dur > 0) return `${Math.max(1, Math.ceil((h.dur - h.pos) / 60))}m left`
  return 'Up next'
}

function Card({ h }: { h: HistoryItem }) {
  const pct = h.dur > 0 ? Math.min(100, Math.round((h.pos / h.dur) * 100)) : 0
  const isDone = h.dur > 0 && h.pos >= h.dur * 0.9
  const href = `/watch/${h.id}?ep=${h.ep}&server=${h.server}&audio=${h.audio}`
  return (
    <div className="group/card relative w-[148px] shrink-0 snap-start sm:w-[178px] lg:w-[196px]">
      <button
        type="button"
        aria-label={`Remove ${h.title} from continue watching`}
        title="Remove"
        onClick={() => removeHistory(h.id)}
        className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur transition hover:bg-accent hover:text-accent-fg focus-visible:opacity-100 group-hover/card:opacity-100 pointer-coarse:opacity-100"
      >
        <X className="size-4" />
      </button>
      <Link to={href} className="group block outline-none">
        <div
          style={{ backgroundColor: h.color ?? undefined }}
          className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card-2 shadow-lg shadow-black/10 group-focus-visible:ring-2 group-focus-visible:ring-accent"
        >
          <img src={h.image} alt={h.title} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-fg shadow-xl">
              <Play className="size-5 fill-current" />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8">
            <span className="text-xs font-semibold text-white">Episode {h.ep}</span>
            {h.audio === 'dub' && <span className="ml-1.5 rounded bg-white/25 px-1 text-[10px] font-bold text-white">DUB</span>}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25" role="progressbar" aria-label="Episode progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-accent">{h.title}</h3>
        <p className={cn("mt-1 truncate text-xs", isDone ? "font-semibold text-accent" : "text-muted")}>{left(h) ?? 'Up next'}</p>
      </Link>
    </div>
  )
}

/** "Continue watching" shelf, newest first. Renders nothing when there is no history. */
export function ContinueRow({ limit = 20, className = '' }: { limit?: number; className?: string }) {
  const items = useHistory().slice(0, limit)
  if (items.length === 0) return null
  return (
    <section id="continue" className={`mx-auto w-full max-w-7xl ${className}`}>
      <div className="mb-5 px-4 sm:px-6">
        <p className="mb-1 eyebrow text-accent">Pick up where you left off</p>
        <h2 className="font-display text-2xl font-bold tracking-tight">Continue Watching</h2>
      </div>
      <div className="no-scrollbar flex snap-x snap-proximity scroll-pl-4 gap-4 overflow-x-auto px-4 pb-4 pt-2 sm:scroll-pl-6 sm:gap-5 sm:px-6">
        {items.map((h) => (
          <Card key={h.id} h={h} />
        ))}
      </div>
    </section>
  )
}
