import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Server } from 'lucide-react'
import { cn } from '../lib/utils'

export interface ServerOpt {
  id: string
  name: string
  /** muted second line, e.g. "Zenkai player" */
  label: string
  /** small badges next to the name, e.g. ["SUB", "DUB"] */
  tags?: string[]
}

export const SPRING = { type: 'spring', stiffness: 270, damping: 30 } as const
/** Same-shape radius strings (8 px values) so every step interpolates instead of snapping. */
const r = (n: number) => `${n}px ${n}px ${n}px ${n}px / ${n}px ${n}px ${n}px ${n}px`
/** circle -> lopsided blob -> rounded rectangle; shared with CinePlayer popups */
export const blob = (from: number) => [r(from), '46px 18px 40px 24px / 26px 44px 20px 40px', r(24)]
export const BLOB_T = { duration: 0.6, times: [0, 0.45, 1], ease: 'easeOut' as const }

/** A circle button that morphs into the dark glass server card (circle -> rounded rectangle), then lists the servers. */
export function ServerPopup({ servers, value, onPick }: { servers: ServerOpt[]; value: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const cur = servers.find((s) => s.id === value)

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const down = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', down)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('pointerdown', down)
    }
  }, [open])

  return (
    <div ref={box} className="relative flex h-11 items-center gap-3">
      <span className="size-11 shrink-0" />
      <span className={cn('leading-tight transition-opacity', open && 'invisible opacity-0')}>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Server</span>
        <span className="block text-sm font-semibold">{cur?.name ?? 'Choose'}</span>
      </span>

      <motion.div
        initial={false}
        animate={{ width: open ? 288 : 44, height: open ? 'auto' : 44, borderRadius: open ? blob(22) : r(22) }}
        transition={{ ...SPRING, borderRadius: open ? BLOB_T : { duration: 0.3 } }}
        style={{ minHeight: 44, maxWidth: 'calc(100vw - 1.5rem)' }}
        className="absolute left-0 top-0 z-40 overflow-hidden border border-white/10 bg-neutral-900/90 shadow-xl shadow-black/40 backdrop-blur-md"
      >
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close servers' : 'Choose server'}
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 w-full items-center gap-3 text-left"
        >
          <span className="grid size-11 shrink-0 place-items-center text-accent">
            <Server className="size-[18px]" />
          </span>
          {open && <span className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-300">Servers</span>}
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul role="listbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} className="space-y-0.5 p-1.5 pt-0">
              {servers.map((s, i) => {
                const active = s.id === value
                return (
                  <motion.li key={s.id} role="option" aria-selected={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        if (!active) onPick(s.id)
                      }}
                      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors', active ? 'bg-white/10' : 'hover:bg-white/5')}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-white">{s.name}</span>
                          {s.tags?.map((t) => (
                            <span key={t} className="rounded border border-white/15 px-1 text-[9px] font-bold uppercase leading-4 text-neutral-300">
                              {t}
                            </span>
                          ))}
                        </span>
                        <span className="block truncate text-xs text-neutral-400">{s.label}</span>
                      </span>
                      {active && <Check className="size-4 shrink-0 text-accent" />}
                    </button>
                  </motion.li>
                )
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
