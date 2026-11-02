import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { WatchReaction } from '../lib/webrtcWatchTogether'

interface FloatingBubble {
  id: string
  emoji: string
  senderName: string
  xOffset: number
}

export function LiveReactionsOverlay({
  reactions,
  syncNotice,
  enabled = true,
}: {
  reactions: WatchReaction[]
  syncNotice?: string | null
  enabled?: boolean
}) {
  const [bubbles, setBubbles] = useState<FloatingBubble[]>([])

  useEffect(() => {
    if (!enabled || reactions.length === 0) return
    const latest = reactions[reactions.length - 1]
    const bubble: FloatingBubble = {
      id: `${latest.id}_${Date.now()}`,
      emoji: latest.emoji,
      senderName: latest.senderName,
      xOffset: (Math.random() - 0.5) * 50, // compact drift
    }

    setBubbles((prev) => [...prev.slice(-8), bubble])

    const timer = setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== bubble.id))
    }, 2200)

    return () => clearTimeout(timer)
  }, [reactions, enabled])

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {/* Sync Status Notice at Top Center */}
      <AnimatePresence>
        {syncNotice && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.92 }}
            className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/20 bg-black/80 px-3.5 py-1 text-[11px] font-semibold text-white shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{syncNotice}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Animated Reaction Emojis at Bottom Right (Optimized for Mobile) */}
      {enabled && (
        <div className="absolute bottom-14 right-3 sm:bottom-16 sm:right-6 flex flex-col items-end">
          <AnimatePresence>
            {bubbles.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, scale: 0.5, y: 15, x: b.xOffset }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0.5, 1.05, 1, 0.85],
                  y: -90 - Math.random() * 30,
                  x: b.xOffset + (Math.random() - 0.5) * 24,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.0, ease: 'easeOut' }}
                className="pointer-events-none flex items-center gap-1 select-none my-0.5"
              >
                <span className="text-xl sm:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {b.emoji}
                </span>
                <span className="rounded-full bg-black/70 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold text-white/90 backdrop-blur-sm">
                  {b.senderName}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
