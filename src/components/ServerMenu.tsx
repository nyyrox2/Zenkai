import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Info, Languages, Server, Zap } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Provider } from '../services/movies'

const MULTI = 'Multi audio'
const DIRECT = 'Direct'

function Tag({ label }: { label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        label === DIRECT ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : label === MULTI ? 'bg-accent text-accent-fg' : 'border border-border bg-card-2 text-muted',
      )}
    >
      {label === MULTI && <Languages className="size-3" />}
      {label === DIRECT && <Zap className="size-3" />}
      {label}
    </span>
  )
}

/** One button that opens the full server list, grouped into sections (custom menu, not a native select). */
export function ServerMenu({
  providers,
  value,
  onPick,
  forceOpen = false,
}: {
  providers: Provider[]
  value?: string
  onPick: (id: string) => void
  forceOpen?: boolean
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const current = providers.find((p) => p.id === value)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const sections = [
    { title: 'Direct Streams', hint: 'Native player with multi-audio dub switcher', items: providers.filter((p) => p.tags.includes(DIRECT)) },
    { title: 'Multi audio', hint: 'Switch the audio track inside the player', items: providers.filter((p) => !p.tags.includes(DIRECT) && p.tags.includes(MULTI)) },
    { title: 'More servers', hint: 'If one is slow or empty, try the next', items: providers.filter((p) => !p.tags.includes(DIRECT) && !p.tags.includes(MULTI)) },
  ].filter((s) => s.items.length > 0)

  return (
    <div ref={box} className="w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="server-list"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3 text-left backdrop-blur transition hover:border-accent active:scale-[0.99] sm:w-auto sm:min-w-[22rem]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg">
          <Server className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Server</span>
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {current?.label ?? 'Choose a server'}
            {current?.tags.map((t) => <Tag key={t} label={t} />)}
          </span>
        </span>
        <span className="text-xs text-muted">{providers.length} servers</span>
        <ChevronDown className={cn('size-5 shrink-0 text-muted transition-transform duration-300', open && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="server-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-5 rounded-3xl border border-border bg-card/60 p-3 backdrop-blur sm:p-4">
              {sections.map((sec) => (
                <section key={sec.title} aria-label={sec.title}>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-3 px-1">
                    <h3 className="text-xs font-bold uppercase tracking-[0.18em]">{sec.title}</h3>
                    <p className="text-xs text-muted">{sec.hint}</p>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sec.items.map((p) => {
                      const active = p.id === value
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              onPick(p.id)
                              setOpen(false)
                            }}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.98]',
                              active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card hover:border-accent',
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{p.label}</span>
                              {p.tags.length > 0 && (
                                <span className="mt-1.5 flex flex-wrap gap-1.5">
                                  {p.tags.map((t) => <Tag key={t} label={t} />)}
                                </span>
                              )}
                            </span>
                            {active && <Check className="size-4 shrink-0" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
              <p className="flex items-start gap-2 px-1 text-xs text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Servers are third-party embeds. Change language or subtitles from the player&rsquo;s own settings. If one shows pop-ups, close them or switch server.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
