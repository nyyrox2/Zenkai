import { useRef } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

interface ViewTransitionDocument {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> }
}

/** Light / dark switch with a circular reveal from the button (View Transitions API when available). */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const ref = useRef<HTMLButtonElement>(null)

  async function handleClick() {
    const btn = ref.current
    const doc = document as unknown as ViewTransitionDocument
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!btn || !doc.startViewTransition || reduce) {
      toggle()
      return
    }
    const { top, left, width, height } = btn.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    const transition = doc.startViewTransition(() => {
      flushSync(() => toggle())
    })
    await transition.ready
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-card/60 text-foreground backdrop-blur transition-transform hover:scale-105 active:scale-90"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="grid place-items-center"
        >
          {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
