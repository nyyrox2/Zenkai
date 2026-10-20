import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

/** Playful ghost for error pages: leans toward the pointer, hops / twirls / sparkles when poked, talks back.
 *  Art: OpenMoji "ghost" (CC BY-SA 4.0, openmoji.org), public/characters/ghost.svg. */
export function GhostBuddy({ lines, className }: { lines: string[]; className?: string }) {
  const stage = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLSpanElement>(null)
  const timer = useRef(0)
  const [pokes, setPokes] = useState(0)
  const [say, setSay] = useState<string | null>(null)

  useEffect(() => {
    const st = stage.current
    const g = ghost.current
    if (!st || !g || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0
    const move = (e: PointerEvent) => {
      const r = st.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy) || 1
      const k = Math.min(1, d / 260) * 20
      tx = (dx / d) * k
      ty = (dy / d) * k
    }
    const tick = () => {
      x += (tx - x) * 0.09
      y += (ty - y) * 0.09
      g.style.transform = `translate(${x}px, ${y}px) rotate(${x * 0.7}deg)`
      raf = requestAnimationFrame(tick)
    }
    addEventListener('pointermove', move)
    raf = requestAnimationFrame(tick)
    return () => {
      removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [])

  const talk = (t: string) => {
    setSay(t)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSay(null), 2800)
  }
  useEffect(() => {
    const t = window.setTimeout(() => talk(lines[0]), 900)
    return () => (clearTimeout(t), clearTimeout(timer.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const poke = () => {
    const n = pokes + 1
    setPokes(n)
    talk(n > 9 ? "Okay okay, you win. I'm dizzy." : lines[n % lines.length])
  }
  const anim = pokes === 0 ? undefined : pokes % 3 === 0 ? 'zk-twirl 0.7s ease-in-out' : 'zk-hop 0.65s ease-out'

  return (
    <div ref={stage} className={cn('relative inline-grid place-items-center', className)}>
      {say && (
        <span key={say} role="status" className="absolute -top-12 left-1/2 z-10 w-max max-w-[16rem] -translate-x-1/2 rounded-2xl border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-lg [animation:zk-pop_0.25s_ease-out]">
          {say}
          <i className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-border bg-card" />
        </span>
      )}
      <div className="zk-bob [animation:bob_3.2s_ease-in-out_infinite]">
        <span ref={ghost} className="block will-change-transform">
          <button
            key={pokes}
            type="button"
            onClick={poke}
            aria-label="Poke the ghost"
            className="zk-act block size-full cursor-pointer select-none outline-none transition-transform active:scale-90"
            style={{ animation: anim }}
          >
            <img src="/characters/ghost.svg" alt="" draggable={false} className="size-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]" />
          </button>
        </span>
      </div>
      {pokes > 0 && (
        <span key={`s${pokes}`} aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <i key={a} className="zk-spk absolute text-accent [animation:zk-spark_0.7s_ease-out_forwards]" style={{ '--a': `${a}deg` } as React.CSSProperties}>
              ✦
            </i>
          ))}
        </span>
      )}
    </div>
  )
}
