import { useEffect, useState } from 'react'
import { LoadingGrid } from './LoadingGrid'

const WORD = 'ZENKAI'
const SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Letters scramble and lock in one by one (Magic UI "Hyper Text" idea), then repeat. */
function useScramble(word: string) {
  const [t, setT] = useState(word)
  useEffect(() => {
    let n = 0
    const id = window.setInterval(() => {
      const done = Math.min(word.length, Math.floor((n++ % 40) / 4))
      setT([...word].map((c, i) => (i < done ? c : SET[Math.floor(Math.random() * SET.length)])).join(''))
    }, 45)
    return () => clearInterval(id)
  }, [word])
  return t
}

/** Black & white loader: scrambling wordmark, a hairline sweep and the live timer. Fills its (positioned) parent. */
export function HeroLoader({ label = 'Loading' }: { label?: string }) {
  const text = useScramble(WORD)
  return (
    <div role="status" aria-label={label} className="hl absolute inset-0 grid place-items-center bg-black text-white">
      <div className="flex flex-col items-center gap-6">
        <p aria-hidden className="font-mono text-5xl font-black tracking-[0.35em] sm:text-7xl">
          {text}
        </p>
        <span aria-hidden className="relative h-px w-44 overflow-hidden bg-white/15">
          <i className="absolute inset-y-0 w-1/3 bg-white" style={{ animation: 'hl-bar 1.3s cubic-bezier(.6,0,.4,1) infinite' }} />
        </span>
        <LoadingGrid label={label} className="text-white/50" />
      </div>
    </div>
  )
}
