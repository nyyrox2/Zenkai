import { Heart, Play } from 'lucide-react'
import { openAd } from '../lib/ads'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'

const watch = () => (openAd(), toast('Thank you for supporting Zenkai ❤', 'success'))

/** Small "Support Zenkai" card shown under the server picker on the players. */
export function SupportCard({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-3xl border border-border bg-card/60 p-4 backdrop-blur', className)}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-accent/20 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg shadow-[0_0_24px_var(--glow)]">
          <Heart className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Support Zenkai</p>
          <p className="text-sm font-semibold leading-snug">Watch a short ad to keep Zenkai free</p>
        </div>
        <button type="button" onClick={watch} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background transition active:scale-95">
          <Play className="size-3.5 fill-current" /> Watch ad
        </button>
      </div>
      <p className="relative mt-2.5 text-[11px] text-muted">Opens in a new tab · totally optional</p>
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
