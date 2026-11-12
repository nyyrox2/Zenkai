import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleHelp } from 'lucide-react'

const STEPS = ['Install Kiwi Browser (Android) or use Chrome on desktop', 'Download the extension zip', 'Menu ⋮ → Extensions → turn on Developer mode', 'Tap "+ (from .zip)" and pick zenkai-companion.zip', 'Reload Zenkai']

/** "?" button that opens a short install checklist. Shown on the player while the companion is missing. */
export function InstallHelp() {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="How to install the extension" aria-expanded={open} className="grid size-7 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition hover:text-white active:scale-90">
        <CircleHelp className="size-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button type="button" aria-label="Close" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute left-0 top-9 z-50 w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-background p-4 shadow-2xl">
              <p className="text-sm font-bold">Install the extension</p>
              <ol className="mt-2.5 space-y-1.5">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex gap-2.5 text-xs leading-snug text-muted">
                    <span className="font-extrabold text-accent">{i + 1}</span> {s}
                  </li>
                ))}
              </ol>
              <Link to="/extension/how-to" className="mt-3 inline-block text-xs font-bold text-accent">See full guide with screenshots →</Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  )
}
