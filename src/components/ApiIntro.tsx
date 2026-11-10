import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Code2, Server, Sparkles, Volume2, X } from 'lucide-react'

const KEY = 'zk:tour:api-intro'
const seen = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true // storage blocked: don't nag on every visit
  }
}

/** First-visit promo for the Zenkai API. "Take me to the page" opens /api, where the guided tour starts by itself. */
export function ApiIntro() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (seen()) return
    let t = 0
    // wait while another modal (release notes) has locked the page scroll
    const tick = () => {
      if (document.body.style.overflow === 'hidden') t = window.setTimeout(tick, 1000)
      else {
        try {
          localStorage.setItem(KEY, '1')
        } catch {}
        setOpen(true)
      }
    }
    t = window.setTimeout(tick, 1500)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  const go = () => {
    setOpen(false)
    navigate('/api')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[125] grid place-items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Introducing the Zenkai API"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-2xl"
          >
            <div className="relative px-6 pt-7 pb-5" style={{ background: 'radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--accent) 34%, transparent), transparent 70%)' }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-foreground/10 text-foreground/80 transition hover:bg-foreground/20"
              >
                <X className="size-4" />
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-accent-fg uppercase">
                <Sparkles className="size-3" /> New
              </span>
              <h2 className="mt-3 font-display text-2xl leading-tight font-extrabold">Zenkai Player API</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">Put any anime episode on your own site with a single iframe. No keys, no setup.</p>
            </div>

            <div className="space-y-4 px-6 pb-6">
              <code className="block overflow-x-auto rounded-xl border border-border bg-card-2 px-3 py-2.5 font-mono text-[11px] whitespace-nowrap text-accent">
                {'<iframe src="…/embed?id=195604&ep=1">'}
              </code>
              <ul className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-muted">
                <li className="rounded-xl bg-foreground/5 px-1 py-2.5"><Server className="mx-auto mb-1 size-4 text-accent" />4 servers</li>
                <li className="rounded-xl bg-foreground/5 px-1 py-2.5"><Volume2 className="mx-auto mb-1 size-4 text-accent" />Sub &amp; Dub</li>
                <li className="rounded-xl bg-foreground/5 px-1 py-2.5"><Code2 className="mx-auto mb-1 size-4 text-accent" />AniList ID</li>
              </ul>
              <button
                type="button"
                onClick={go}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-extrabold text-accent-fg shadow-[0_8px_24px_var(--glow)] transition active:scale-95"
              >
                Take me to the page <ArrowRight className="size-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="block w-full text-center text-xs font-semibold text-muted hover:text-foreground">
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
