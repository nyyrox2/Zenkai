import { useEffect, useState } from 'react'

const LINES = ['Summoning the page...', 'Almost there!', 'Warming up the portal...', 'Fetching the good stuff...', 'Hold on, boo is working.']

/** Route-change loader: the error-page ghost floats over a squishing shadow and talks while the next page loads.
 *  Appears after 200ms, so fast navigations never flash it. Art: public/characters/ghost.svg (OpenMoji, CC BY-SA 4.0). */
export function PageLoader() {
  const [show, setShow] = useState(false)
  const [i, setI] = useState(() => Math.floor(Math.random() * LINES.length))
  useEffect(() => {
    const a = window.setTimeout(() => setShow(true), 200)
    const b = window.setInterval(() => setI((n) => (n + 1) % LINES.length), 1800)
    return () => (clearTimeout(a), clearInterval(b))
  }, [])
  if (!show) return <div className="min-h-[70svh]" />
  return (
    <div role="status" aria-label="Loading page" className="zk-pageload grid min-h-[70svh] place-items-center px-4">
      <div className="flex flex-col items-center">
        <div className="zk-bob size-28 [animation:bob_1.6s_ease-in-out_infinite] sm:size-36">
          <img src="/characters/ghost.svg" alt="" draggable={false} className="size-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]" />
        </div>
        <i aria-hidden className="zk-shadow mt-1 h-2 w-20 rounded-full bg-black/30 blur-[2px]" />
        <p key={i} className="mt-6 text-sm font-medium text-muted [animation:zk-pop_0.25s_ease-out]">{LINES[i]}</p>
        <span aria-hidden className="mt-3 grid grid-cols-3 gap-[3px] text-accent">
          {Array.from({ length: 9 }, (_, k) => (
            <span key={k} className="zk-dot size-[5px] rounded-[1px] bg-current" style={{ animationDelay: `${((k % 3) + Math.floor(k / 3)) * 120}ms` }} />
          ))}
        </span>
      </div>
    </div>
  )
}
