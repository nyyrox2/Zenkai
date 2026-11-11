import { Heart, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { openAd } from '../lib/ads'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'

const watch = () => (openAd(), toast('Thank you for supporting Zenkai ❤', 'success'))

/** Minimal "Support Zenkai" row shown under the server picker on the players. */
export function SupportCard({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-border pt-4', className)}>
      <Heart className="size-4 shrink-0 fill-accent text-accent" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">Support Zenkai.</span> <span className="text-muted">No funds? No worries, watch an ad.</span>
      </p>
      <div className="flex items-center gap-2">
        <Link to="/support" className="rounded-full bg-accent px-4 py-2 text-xs font-bold text-accent-fg transition active:scale-95">
          Fund
        </Link>
        <button type="button" onClick={watch} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold transition hover:bg-foreground/[0.06] active:scale-95">
          <Play className="size-3.5 fill-current" /> Watch ad
        </button>
      </div>
    </div>
  )
}

/** Compact row for the manga reader settings (follows the reader's own colours). */
export function SupportRow() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Support</p>
      <div className="flex items-center gap-3 rounded-2xl border border-current/20 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg">
          <Heart className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Support Zenkai</span>
          <span className="block text-xs opacity-60">Watch a short ad · opens in a new tab</span>
        </span>
        <button type="button" onClick={watch} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-xs font-bold text-accent-fg transition active:scale-95">
          <Play className="size-3.5 fill-current" /> Watch ad
        </button>
      </div>
    </div>
  )
}
