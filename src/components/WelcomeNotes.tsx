import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Film, Puzzle, Users, X } from 'lucide-react'
import { isCompanionActive } from '../lib/useCompanion'

const KEY = 'zk:tour:welcome-notes'
const SHOW_MS = 6000

/** `wait` = pause before this note, counted from the previous note vanishing, so each one lands at a different time. */
const NOTES = [
  { wait: 3000, icon: Film, title: 'Watch movies & TV directly', text: 'Open Movies, pick a title and hit play. No sign-up needed.', to: '/movies', cta: 'Browse movies' },
  { wait: 6000, icon: Puzzle, title: 'Get the Stream Companion', text: 'A free desktop Chrome extension for direct, faster streaming.', to: '/extension', cta: 'See how', skipIfInstalled: true },
  { wait: 9000, icon: BookOpen, title: 'Anime, manga & novels too', text: 'Switch sections any time from the menu.', to: '/home', cta: 'Explore' },
  { wait: 12000, icon: Users, title: 'Watch together', text: 'Start a watch party and chat by voice with friends.', to: '/watchparty', cta: 'Start a party' },
]

/** First-visit info notes: one small card at a time, staggered, non-blocking. The X skips the rest. */
export function WelcomeNotes({ enabled }: { enabled: boolean }) {
  const [i, setI] = useState<number | null>(null)
  const [off, setOff] = useState(false)

  useEffect(() => {
    if (!enabled || off) return
    try {
      if (localStorage.getItem(KEY)) return
    } catch {
      return // storage blocked: don't nag on every visit
    }
    let t = 0
    const run = (n: number) => {
      const note = NOTES[n]
      if (!note) return
      if (note.skipIfInstalled && isCompanionActive()) return run(n + 1)
      t = window.setTimeout(function show() {
        if (document.querySelector('[role="dialog"]')) {
          t = window.setTimeout(show, 1500) // wait out release notes / promos
          return
        }
        try {
          localStorage.setItem(KEY, '1')
        } catch {}
        setI(n)
        t = window.setTimeout(() => (setI(null), run(n + 1)), SHOW_MS)
      }, note.wait)
    }
    run(0)
    return () => window.clearTimeout(t)
  }, [enabled, off])

  const note = enabled && i !== null ? NOTES[i] : null
  return (
    <AnimatePresence>
      {note && (
        <motion.div
          key={i}
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-24 left-3 right-3 z-[110] flex gap-3 rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl sm:right-auto sm:bottom-6 sm:left-6 sm:w-80"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <note.icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{note.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{note.text}</p>
            <Link to={note.to} onClick={() => setI(null)} className="mt-2 inline-block text-xs font-extrabold text-accent">
              {note.cta} →
            </Link>
          </div>
          <button type="button" onClick={() => (setOff(true), setI(null))} aria-label="Skip tips" className="self-start text-muted transition-colors hover:text-foreground">
            <X className="size-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
