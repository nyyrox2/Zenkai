import { Link } from 'react-router-dom'
import { BookOpen, X } from 'lucide-react'
import { removeReading, useReading, type ReadKind, type ReadingItem } from '../lib/reading'

function Card({ r }: { r: ReadingItem }) {
  const pct = Math.round(Math.min(1, Math.max(0, r.progress)) * 100)
  return (
    <div className="group/card relative w-[148px] shrink-0 snap-start sm:w-[178px] lg:w-[196px]">
      <button
        type="button"
        aria-label={`Remove ${r.title} from continue reading`}
        title="Remove"
        onClick={() => removeReading(r.kind, r.id)}
        className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur transition hover:bg-accent hover:text-accent-fg focus-visible:opacity-100 group-hover/card:opacity-100 pointer-coarse:opacity-100"
      >
        <X className="size-4" />
      </button>
      <Link to={r.resume} className="group block outline-none">
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border bg-card-2 shadow-lg shadow-black/10 group-focus-visible:ring-2 group-focus-visible:ring-accent">
          {r.cover && (
            <img src={r.cover} alt={r.title} loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          )}
          <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-fg shadow-xl">
              <BookOpen className="size-5" />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8">
            <span className="text-xs font-semibold text-white">{r.label}</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25" role="progressbar" aria-label="Chapter progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-accent">{r.title}</h3>
        <p className="mt-1 truncate text-xs text-muted">{pct > 0 && pct < 100 ? `${pct}% read` : 'Up next'}</p>
      </Link>
    </div>
  )
}

/** "Continue reading" shelf for one kind, newest first. Renders nothing when there is no history. */
export function ContinueReading({ kind }: { kind: ReadKind }) {
  const items = useReading(kind).slice(0, 20)
  if (items.length === 0) return null
  return (
    <section className="mx-auto w-full max-w-7xl">
      <div className="mb-5 px-4 sm:px-6">
        <p className="mb-1 eyebrow text-accent">Pick up where you left off</p>
        <h2 className="font-display text-2xl font-bold tracking-tight">Continue Reading</h2>
      </div>
      <div className="no-scrollbar flex snap-x snap-proximity scroll-pl-4 gap-4 overflow-x-auto px-4 pb-4 pt-2 sm:scroll-pl-6 sm:gap-5 sm:px-6">
        {items.map((r) => (
          <Card key={`${r.kind}:${r.id}`} r={r} />
        ))}
      </div>
    </section>
  )
}
