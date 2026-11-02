import { memo, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { WatchReaction } from '../lib/webrtcWatchTogether'

const LIFE = 2200 // ms a reaction stays on screen
const MAX_ON_SCREEN = 10

interface Bubble {
  id: string
  emoji: string
  name: string
  avatar?: string | null
  x: number // horizontal drift in px
  rise: number // how far it floats up in px
}

/** Float up ~75% of the way from the origin to the top of the player (less on phones), then be gone. */
function riseFor(root: HTMLElement | null) {
  const h = root?.clientHeight ?? 360
  const frac = window.innerWidth >= 640 ? 0.75 : 0.55
  return (h / 2) * frac * (0.85 + Math.random() * 0.15)
}

/** Profile picture that fades into the emoji (Instagram-live style), floating up. */
const ReactionBubble = memo(function ReactionBubble({ b }: { b: Bubble }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 0, x: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: -b.rise, x: [0, b.x * 0.5, b.x * 0.9, b.x], scale: [0.6, 1, 1, 0.9] }}
      transition={{ duration: LIFE / 1000, times: [0, 0.12, 0.55, 1], ease: 'easeOut' }}
      className="pointer-events-none absolute bottom-0 left-0 grid size-11 select-none place-items-center will-change-transform sm:size-14"
    >
      {/* avatar -> fades out */}
      <motion.span
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: [1, 1, 0, 0], scale: [1, 1, 0.5, 0.5] }}
        transition={{ duration: LIFE / 1000, times: [0, 0.3, 0.5, 1], ease: 'easeInOut' }}
        className="absolute inset-0 overflow-hidden rounded-full border-2 border-white/80 bg-card-2 shadow-lg shadow-black/50"
      >
        {b.avatar ? (
          <img src={b.avatar} alt="" draggable={false} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-sm font-bold text-foreground sm:text-base">
            {b.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </motion.span>
      {/* emoji -> fades in */}
      <motion.span
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0, 1, 1], scale: [0.4, 0.4, 1.2, 1] }}
        transition={{ duration: LIFE / 1000, times: [0, 0.3, 0.5, 1], ease: 'easeOut' }}
        className="absolute inset-0 grid place-items-center text-[28px] leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:text-[38px]"
      >
        {b.emoji}
      </motion.span>
    </motion.div>
  )
})

export function LiveReactionsOverlay({
  reactions,
  syncNotice,
  enabled = true,
}: {
  reactions: WatchReaction[]
  syncNotice?: string | null
  enabled?: boolean
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  // Every reaction id already handled. Kept up to date even while hidden, so
  // re-enabling never replays old reactions.
  const seen = useRef<Set<string> | null>(null)
  const timers = useRef<number[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(reactions.map((r) => r.id)) // existing ones on mount are history
      return
    }
    const fresh = reactions.filter((r) => !seen.current!.has(r.id))
    if (fresh.length === 0) return
    for (const r of fresh) seen.current.add(r.id)
    if (seen.current.size > 200) seen.current = new Set(reactions.map((r) => r.id))
    if (!enabled) return

    const added: Bubble[] = fresh.slice(-4).map((r) => ({
      id: r.id,
      emoji: r.emoji,
      name: r.senderName || '?',
      avatar: r.avatar,
      x: (Math.random() - 0.5) * 70,
      rise: riseFor(rootRef.current),
    }))
    setBubbles((prev) => [...prev, ...added].slice(-MAX_ON_SCREEN))
    for (const b of added) {
      timers.current.push(window.setTimeout(() => setBubbles((prev) => prev.filter((x) => x.id !== b.id)), LIFE + 100))
    }
  }, [reactions, enabled])

  useEffect(() => {
    if (!enabled) setBubbles([])
  }, [enabled])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <AnimatePresence>
        {syncNotice && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.92 }}
            className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/20 bg-black/80 px-3.5 py-1 text-[11px] font-semibold text-white shadow-xl"
          >
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span>{syncNotice}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {enabled && (
        <div className="absolute left-[calc(50%+5.5rem)] top-1/2 size-0 sm:left-[calc(50%+8rem)]">
          {bubbles.map((b) => (
            <ReactionBubble key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  )
}
