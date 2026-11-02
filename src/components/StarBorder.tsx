import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'

/** Primary call-to-action button. Renders a Link when `to` is set. */
export function StarBorder({ children, to, onClick, className }: { children: ReactNode; to?: string; onClick?: () => void; className?: string }) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-gradient-to-b from-[color-mix(in_srgb,var(--accent)_24%,#0a0a0c)] to-[#0a0a0c] px-7 py-3.5 text-sm font-bold text-white transition-transform duration-200 hover:scale-[1.04] active:scale-95',
    className,
  )
  return to ? (
    <Link to={to} className={classes}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  )
}
