import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { hasSeenLatestRelease, markReleaseSeen, onChangelogToggle, useRelease } from '../lib/changelog'

/** Minimal black & white "what's new" card, crimson only on the version label and button hover. No blur, no per-mouse state. */
export function ChangelogModal() {
  const [open, setOpen] = useState(false)
  const { release: r, ready } = useRelease()
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname === '/' || !ready || hasSeenLatestRelease(r.version)) return // not over the winter intro / landing
    const t = window.setTimeout(() => setOpen(true), 3500)
    return () => window.clearTimeout(t)
  }, [ready, r.version, pathname])
  useEffect(() => onChangelogToggle(setOpen), [])

  const close = () => (markReleaseSeen(r.version), setOpen(false))

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', key)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', key)
    }
  }, [open, r.version])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={close}
          className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/80 p-4"
        >
          <motion.div
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="changelog-title"
            className="relative my-auto w-full max-w-md rounded-2xl border border-white/10 bg-black p-6 text-white sm:p-7"
          >
            <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 text-white/50 transition-colors hover:text-white">
              <X className="size-5" />
            </button>

            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">What&apos;s new · v{r.version}</p>
            <h2 id="changelog-title" className="mt-3 pr-6 text-xl font-bold tracking-tight">
              {r.title}
            </h2>
            {r.tagline && <p className="mt-1.5 text-sm leading-relaxed text-white/50">{r.tagline}</p>}

            <ul className="mt-5 max-h-[44vh] divide-y divide-white/10 overflow-y-auto border-y border-white/10">
              {r.highlights.map((h, i) => (
                <li key={h.title} className="flex gap-4 py-3.5">
                  <span className="pt-0.5 font-mono text-xs text-white/30">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">
                      {h.title}
                      {h.badge && <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-white/40">{h.badge}</span>}
                    </h3>
                    {h.description && <p className="mt-1 text-xs leading-relaxed text-white/50">{h.description}</p>}
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={close}
              className="mt-5 w-full rounded-full bg-white py-3 text-sm font-semibold text-black transition-colors hover:bg-accent hover:text-white active:scale-[0.99]"
            >
              Continue
            </button>
            <a href={r.githubUrl} target="_blank" rel="noreferrer" className="mt-3 block text-center text-xs text-white/40 transition-colors hover:text-white">
              Full notes on GitHub ↗
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
