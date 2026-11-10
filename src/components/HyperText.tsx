import { useCallback, useEffect, useRef, useState } from 'react'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Letters scramble then settle left to right, on mount and on hover (Magic UI "Hyper Text"). Use a mono font so the width never jumps. */
export function HyperText({ text, className, duration = 900, delay = 0 }: { text: string; className?: string; duration?: number; delay?: number }) {
  const [out, setOut] = useState(() => text.replace(/\S/g, ' '))
  const raf = useRef(0)

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current)
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setOut(
        text
          .split('')
          .map((c, i) => (!/\w/.test(c) || i < p * text.length ? c : LETTERS[(Math.random() * LETTERS.length) | 0]))
          .join(''),
      )
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [text, duration])

  useEffect(() => {
    const t = window.setTimeout(play, delay)
    return () => {
      window.clearTimeout(t)
      cancelAnimationFrame(raf.current)
    }
  }, [play, delay])

  return (
    <span aria-label={text} onPointerEnter={play} className={className}>
      <span aria-hidden>{out}</span>
    </span>
  )
}
