import { useId } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SECTIONS, type Section } from '../lib/sections'
import { cn } from '../lib/utils'

/** Anime / Novels / Manga pill with a sliding highlight — lives in the navbar and the footer. */
export function SectionSwitcher({ current, className }: { current: Section | null; className?: string }) {
  const layoutId = useId()
  return (
    <div role="tablist" aria-label="Switch section" className={cn('inline-flex gap-0.5 rounded-full border border-border bg-card/60 p-1 backdrop-blur', className)}>
      {SECTIONS.map((s) => {
        const active = s.id === current
        return (
          <Link
            key={s.id}
            to={s.to}
            role="tab"
            aria-selected={active}
            className={cn('relative rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4', active ? 'text-background' : 'text-muted hover:text-foreground')}
          >
            {active && (
              <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-foreground" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
            )}
            <span className="relative z-10">{s.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
