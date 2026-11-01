import { LoadingGrid } from './LoadingGrid'

const PETALS = Array.from({ length: 12 }, (_, i) => ({ left: (i * 37 + 9) % 100, delay: (i * 0.65) % 6, dur: 5 + (i % 4), size: 7 + (i % 3) * 3 }))
const STREAKS = [18, 34, 52, 68, 82]

/** Anime-style loader: spinning shuriken with a glowing ring, speed streaks, drifting sakura petals and flickering katakana.
 *  Fills its (positioned) parent. Colours follow --accent. */
export function HeroLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="hl absolute inset-0 grid place-items-center overflow-hidden">
      {STREAKS.map((top, i) => (
        <i
          key={top}
          aria-hidden
          className="absolute left-0 h-px w-1/2 bg-gradient-to-r from-transparent via-accent to-transparent"
          style={{ top: `${top}%`, animation: `hl-streak ${2.2 + (i % 3) * 0.5}s ease-in infinite`, animationDelay: `${i * 0.35}s` }}
        />
      ))}
      {PETALS.map((p, i) => (
        <i
          key={i}
          aria-hidden
          className="absolute top-0 rounded-[80%_0_80%_0] bg-accent/70"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.7, animation: `hl-petal ${p.dur}s linear infinite`, animationDelay: `${p.delay}s` }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="relative grid size-32 place-items-center sm:size-40">
          <svg aria-hidden viewBox="0 0 120 120" className="absolute inset-0 text-accent/60" style={{ animation: 'hl-ring 6s linear infinite' }}>
            <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 9" strokeLinecap="round" />
          </svg>
          <svg
            aria-hidden
            viewBox="0 0 120 120"
            className="size-24 text-accent drop-shadow-[0_0_16px_var(--accent)] sm:size-28"
            style={{ animation: 'hl-spin 2.4s cubic-bezier(.6,0,.3,1) infinite' }}
          >
            <path fill="currentColor" fillRule="evenodd" d="M60 4 72 48 116 60 72 72 60 116 48 72 4 60 48 48ZM60 50a10 10 0 1 0 0 20 10 10 0 1 0 0-20Z" />
            <path fill="currentColor" opacity=".45" transform="rotate(45 60 60) scale(.62) translate(37 37)" d="M60 4 72 48 116 60 72 72 60 116 48 72 4 60 48 48Z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-white/90" style={{ animation: 'hl-kana 1.6s ease-in-out infinite' }}>
          ロード中
        </p>
        <LoadingGrid label={label} className="text-white/60" />
      </div>
    </div>
  )
}
