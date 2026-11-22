import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Play, Users, X } from 'lucide-react'

const KEY = 'zk:notice:bc-ep9'
const ANIME_ID = 195604 // ponytail: AniList id of Black Clover Season 2, verify it opens the right title
const EP = 9
const UNTIL = new Date(2026, 10, 24).getTime() // ponytail: hard expiry, end of Nov 23 local time; no config

const seen = () => {
  try {
    return !!localStorage.getItem(KEY)
  } catch {
    return true // storage blocked: don't nag on every visit
  }
}

/** One-time notice (Nov 22-23 2026 only): Black Clover ep 9 leaked early and is already playable here. */
export function PreReleaseNotice({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled || Date.now() >= UNTIL || seen()) return
    let t = 0
    const tryOpen = () => {
      if (document.querySelector('[role="dialog"]')) return void (t = window.setTimeout(tryOpen, 1500)) // wait out release notes
      setOpen(true)
    }
    t = window.setTimeout(tryOpen, 1500)
    return () => window.clearTimeout(t)
  }, [enabled])

  const close = () => {
    setOpen(false)
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
  }

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])

  const btn = 'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition active:scale-95'
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/80 p-4"
        >
          <motion.div
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bc9-title"
            className="relative my-auto w-full max-w-md rounded-2xl border border-white/10 bg-black p-6 text-white sm:p-7"
          >
            <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 text-white/50 transition-colors hover:text-white">
              <X className="size-5" />
            </button>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">Early release</p>
            <h2 id="bc9-title" className="mt-2 font-display text-2xl font-extrabold tracking-tight">
              Black Clover episode 9 is already here
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              The episode was released ahead of schedule by accident and is playable on our sources right now. It may be pulled at any time, so watch it while it is up.
            </p>
            <div className="mt-5 flex gap-2.5">
              <Link to={`/watch/${ANIME_ID}?ep=${EP}`} onClick={close} className={`${btn} bg-accent text-accent-fg hover:opacity-90`}>
                <Play className="size-4" />
                Watch ep {EP}
              </Link>
              <Link to={`/watch/${ANIME_ID}?ep=${EP}&createRoom=1`} onClick={close} className={`${btn} border border-white/15 hover:bg-white/10`}>
                <Users className="size-4" />
                Watch party
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
