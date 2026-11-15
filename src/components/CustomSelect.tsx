import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'

export interface Option {
  value: string
  label: string
  /** small tag shown at the end of the row, e.g. "Playing" */
  hint?: string
}

/** Themed dropdown (replaces the native select). Portaled so the scrolling filter bar never clips it; keyboard + screen-reader friendly. */
export function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  prefix,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder: string
  /** muted text shown in the button before the selected label */
  prefix?: string
  /** extra classes for the button (e.g. full width) */
  className?: string
}) {
  const id = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [box, setBox] = useState({ left: 0, top: 0, width: 0, up: false })
  const selected = options.find((o) => o.value === value)

  const openMenu = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    btn.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const need = Math.min(300, options.length * 40 + 12)
    const up = window.innerHeight - r.bottom < need + 16 && r.top > window.innerHeight - r.bottom
    const width = Math.max(r.width, 176)
    setBox({ left: Math.min(Math.max(8, r.left), window.innerWidth - width - 8), top: up ? r.top - 8 : r.bottom + 8, width, up })
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e.type === 'scroll' && list.current?.contains(e.target as Node)) return
      if (e.type === 'pointerdown' && (list.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'ArrowDown') setActive((a) => Math.min(options.length - 1, a + 1))
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
    else if (e.key === 'Home') setActive(0)
    else if (e.key === 'End') setActive(options.length - 1)
    else if (e.key === 'Enter' || e.key === ' ') pick(options[active].value)
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false)
    else return
    e.preventDefault()
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKey}
        className={cn(
          'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border bg-card/60 pl-4 pr-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent',
          value ? 'border-accent/60 text-foreground' : 'border-border text-muted',
          open && 'border-accent',
          className,
        )}
      >
        <span className="flex items-center gap-2 whitespace-nowrap">
          {prefix && <span className="text-muted">{prefix}</span>}
          <span>{value && selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={list}
              id={`${id}-list`}
              role="listbox"
              aria-label={label}
              initial={{ opacity: 0, y: box.up ? 6 : -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: box.up ? 6 : -6, scale: 0.97 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={{ position: 'fixed', left: box.left, top: box.top, minWidth: box.width, transformOrigin: box.up ? 'bottom' : 'top', translate: box.up ? '0 -100%' : undefined }}
              className="no-scrollbar z-[100] max-h-72 overflow-y-auto rounded-2xl border border-border bg-card/95 p-1.5 text-foreground shadow-2xl shadow-black/40 backdrop-blur-xl"
            >
              {options.map((o, i) => {
                const on = o.value === value
                return (
                  <div
                    key={o.value || '__none'}
                    id={`${id}-${i}`}
                    data-i={i}
                    role="option"
                    aria-selected={on}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors',
                      i === active && 'bg-card-2',
                      on && 'font-semibold text-accent',
                    )}
                  >
                    <span>{o.label}</span>
                    <span className="flex items-center gap-2">
                      {o.hint && <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-background">{o.hint}</span>}
                      {on && <Check className="size-4" />}
                    </span>
                  </div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
