import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Red page-load line (NProgress / YouTube style).
 * Runs on every route change (the first load has the opening screen instead): creeps toward ~85%, then snaps to 100% and fades out.
 * Transform/opacity only, so it never causes layout work.
 */
export function TopLoader() {
  const { pathname } = useLocation()
  const [w, setW] = useState(0)
  const [show, setShow] = useState(false) // the opening screen covers the very first load
  const timers = useRef<number[]>([])
  const first = useRef(true)

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
    clear()

    if (first.current) {
      first.current = false
      return clear
    }

    setShow(true)
    setW(0)
    at(30, () => setW(0.3))
    at(250, () => setW(0.55))
    at(600, () => setW(0.75))
    at(1100, () => setW(0.85))

    // finish shortly after the route settles
    at(700, () => {
      clear()
      setW(1)
      at(260, () => setShow(false))
    })
    return clear
  }, [pathname])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px]"
      style={{ opacity: show ? 1 : 0, transition: 'opacity 0.3s ease' }}
    >
      <div
        className="h-full origin-left"
        style={{
          transform: `scaleX(${w})`,
          transition: w === 0 ? 'none' : w === 1 ? 'transform 0.2s ease-out' : 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          background: 'linear-gradient(90deg, #dc143c, #ff4d6a)',
          boxShadow: '0 0 10px rgba(232, 41, 76, 0.7), 0 0 4px rgba(232, 41, 76, 0.9)',
          willChange: 'transform',
        }}
      />
    </div>
  )
}
