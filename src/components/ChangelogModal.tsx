import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Flame,
  ShieldCheck,
  Sparkles,
  Tv,
  X,
  Zap,
} from 'lucide-react'
import { BorderBeam } from './BorderBeam'
import { Meteors } from './Meteors'
import { ShimmerButton } from './ShimmerButton'
import { ShinyText } from './ShinyText'
import {
  CURRENT_RELEASE,
  hasSeenLatestRelease,
  markReleaseSeen,
  onChangelogToggle,
} from '../lib/changelog'
import { cn } from '../lib/utils'

const BADGE_STYLES = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
  crimson: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
}

const ITEM_ICONS = [Zap, Tv, Flame, ShieldCheck]

export function ChangelogModal() {
  const [isOpen, setIsOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  // Show automatically on first open after a new release
  useEffect(() => {
    if (!hasSeenLatestRelease()) {
      const timer = window.setTimeout(() => setIsOpen(true), 750)
      return () => window.clearTimeout(timer)
    }
  }, [])

  // Listen to manual toggle events (e.g. from footer link)
  useEffect(() => {
    return onChangelogToggle((open) => setIsOpen(open))
  }, [])

  // Prevent background scrolling while open & handle ESC
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleClose = () => {
    markReleaseSeen(CURRENT_RELEASE.version)
    setIsOpen(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            ref={cardRef}
            onMouseMove={(e) => {
              const rect = cardRef.current?.getBoundingClientRect()
              if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
            }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="relative z-10 my-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 p-6 sm:p-8 text-foreground shadow-2xl shadow-black/80 backdrop-blur-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="changelog-title"
          >
            {/* React Bits: Spotlight Glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                opacity: isHovering ? 1 : 0,
                background: `radial-gradient(380px circle at ${mousePos.x}px ${mousePos.y}px, rgba(220, 20, 60, 0.14), transparent 70%)`,
              }}
            />

            {/* Magic UI: Meteors in Top Area */}
            <Meteors number={14} className="bg-accent/70" />

            {/* Magic UI: Border Beam */}
            <BorderBeam size={220} duration={12} delay={0} />

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="group absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label="Close changelog"
            >
              <X className="size-4 transition-transform duration-200 group-hover:rotate-90" />
            </button>

            {/* Header */}
            <div className="relative z-10 flex flex-col items-start">
              {/* React Bits: Shiny Text Version Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent shadow-sm shadow-accent/10">
                <Sparkles className="size-3.5 text-accent animate-pulse" />
                <ShinyText speed={2.5} className="font-semibold tracking-wide">
                  WHAT&apos;S NEW · v{CURRENT_RELEASE.version}
                </ShinyText>
              </div>

              <h2
                id="changelog-title"
                className="mt-3.5 text-2xl font-bold tracking-tight text-white"
              >
                {CURRENT_RELEASE.title}
              </h2>

              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                {CURRENT_RELEASE.tagline}
              </p>
            </div>

            {/* Highlights List */}
            <div className="relative z-10 mt-6 space-y-3.5 max-h-[46vh] overflow-y-auto pr-1.5 custom-scrollbar">
              {CURRENT_RELEASE.highlights.map((item, idx) => {
                const Icon = ITEM_ICONS[idx % ITEM_ICONS.length]
                const badgeCls = BADGE_STYLES[item.badgeVariant] ?? BADGE_STYLES.emerald
                return (
                  <div
                    key={item.title}
                    className="group relative flex items-start gap-3.5 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06]"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/80 text-accent shadow-inner">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">
                          {item.title}
                        </h3>
                        <span
                          className={cn(
                            'inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                            badgeCls,
                          )}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer / Actions */}
            <div className="relative z-10 mt-6 flex items-center justify-end pt-4 border-t border-white/10">
              {/* Magic UI: Shimmer Button */}
              <ShimmerButton
                onClick={handleClose}
                className="w-full sm:w-auto px-7 py-3 text-sm font-semibold shadow-lg shadow-accent/20 hover:shadow-accent/40"
              >
                <span className="flex items-center gap-2">
                  <span>Continue</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </ShimmerButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
