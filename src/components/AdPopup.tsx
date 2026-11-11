import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Play, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { openAd, popupShown, popupSnoozed, shouldShowPopup } from '../lib/ads'
import { toast } from '../lib/toast'

/**
 * Occasional "Support Zenkai" sheet while browsing. Never on players, readers, chats or embeds (`enabled`),
 * at most once per 15 min, only after a few page changes, and always dismissible. The ad opens only on "Watch ad".
 */
export function AdPopup({ enabled }: { enabled: boolean }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled || !shouldShowPopup()) return
    const t = window.setTimeout(() => {
      // skip while another dialog is up or the tab is in the background
      if (document.visibilityState !== 'visible' || document.querySelector('[role="dialog"]')) return
      popupShown()
      setOpen(true)
    }, 2500)
    return () => window.clearTimeout(t)
  }, [pathname, enabled])

  useEffect(() => {
    if (!enabled) setOpen(false)
  }, [enabled])

  const later = () => (popupSnoozed(), setOpen(false))
  const watch = () => (openAd(), toast('Thank you for supporting Zenkai ❤', 'success'), setOpen(false))

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && later()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={later}
          className="fixed inset-0 z-[110] grid items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ad-title"
            className="relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/90 p-6 text-center text-white shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <span aria-hidden className="pointer-events-none absolute -top-16 left-1/2 size-44 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
            <button type="button" onClick={later} aria-label="Close" className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white">
              <X className="size-4" />
            </button>
            <span className="relative mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-fg shadow-[0_0_32px_var(--glow)]">
              <Heart className="size-6" />
            </span>
            <p className="relative mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Sponsored · Support Zenkai</p>
            <h2 id="ad-title" className="relative mt-1.5 font-display text-xl font-extrabold tracking-tight">
              Enjoying Zenkai?
            </h2>
            <p className="relative mt-2 text-sm leading-relaxed text-white/55">Zenkai is free. Watching a short ad takes a few seconds and helps cover the servers.</p>
            <div className="relative mt-5 grid gap-2">
              <button type="button" onClick={watch} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-bold text-accent-fg shadow-lg shadow-accent/30 transition active:scale-95">
                <Play className="size-4 fill-current" /> Watch ad
              </button>
              <button type="button" onClick={later} className="rounded-full border border-white/10 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 active:scale-95">
                Maybe later
              </button>
            </div>
            <p className="relative mt-3 text-[11px] text-white/35">Opens in a new tab · totally optional</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
