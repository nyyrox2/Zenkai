import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Server, X } from 'lucide-react'
import { SELF_HOST_PATH } from '../lib/app'

const KEY = 'zenkai:free-plan-notice'
/** After closing it, the notice stays away for this long, then comes back (the limit is a daily thing). */
const QUIET_MS = 12 * 3600e3

function hidden(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY))
    return !!at && Date.now() - at < QUIET_MS
  } catch {
    return false
  }
}

/**
 * Heads-up on the opening page: Zenkai runs on a free hosting plan with a daily request limit,
 * so busy days can be slow. Points people to the self-hosting guide.
 */
export function FreePlanNotice() {
  const [gone, setGone] = useState(hidden)
  if (gone) return null

  const close = () => {
    setGone(true)
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* storage blocked: it simply shows again next visit */
    }
  }

  return (
    <aside
      role="status"
      aria-label="Service notice"
      className="relative mx-auto mb-5 w-full max-w-3xl animate-card-in overflow-hidden rounded-3xl border border-border bg-glass p-3.5 shadow-xl shadow-black/10 backdrop-blur-xl sm:mb-9 sm:p-5"
      style={{ animationDelay: '150ms' }}
    >
      <span aria-hidden className="pointer-events-none absolute -left-10 -top-12 size-40 rounded-full bg-accent/25 blur-3xl" />
      <div className="relative flex items-start gap-3.5 sm:gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-accent/30">
          <Server className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pr-6 sm:pr-0">
          <p className="font-display text-base font-extrabold tracking-tight">We&rsquo;re on a free plan, and the daily limit is low</p>
          <p className="mt-1 text-[13px] leading-snug text-muted sm:hidden">Free plan, low daily limit, so it can get slow. Host your own: <span className="font-semibold text-foreground">0 ads, 0 cost</span>.</p>
          <p className="mt-1 hidden text-sm leading-relaxed text-muted sm:block">
            Zenkai is free and ad-free, but our hosting has a daily request limit. On busy days, pages and streams can be slow or briefly unavailable.
            For the smoothest experience, run your own copy on your computer: <span className="font-semibold text-foreground">0 ads, 0 cost</span>, play whenever you want.
          </p>
          <Link
            to={SELF_HOST_PATH}
            className="mt-2.5 inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 sm:mt-3 sm:h-10 sm:px-5 text-sm font-semibold text-background transition hover:opacity-90 active:scale-95"
          >
            Host your own Zenkai
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss notice"
          className="absolute right-0 top-0 grid size-8 place-items-center rounded-full text-muted transition hover:bg-foreground/10 hover:text-foreground sm:static sm:-mr-1 sm:-mt-1"
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  )
}
