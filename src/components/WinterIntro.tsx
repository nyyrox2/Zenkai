import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, Snowflake } from 'lucide-react'
import { BorderBeam } from './BorderBeam'
import { LOGO_URL } from '../lib/constants'

const STORAGE_KEY = 'zenkai_winter_intro_2026'
const DURATION_MS = 6000
const ART = '/winter/anime_character.png'
const EASE = [0.16, 1, 0.3, 1] as const

// Slow drifting aurora (React Bits "Aurora" look in plain CSS gradients, no WebGL).
const AURORA = [
  { color: 'rgba(56,189,248,.20)', cls: '-left-[10%] -top-[20%] size-[70vmax]', x: [0, 60, 0], y: [0, 40, 0], d: 22 },
  { color: 'rgba(99,102,241,.18)', cls: '-right-[15%] top-[10%] size-[60vmax]', x: [0, -50, 0], y: [0, 60, 0], d: 26 },
  { color: 'rgba(232,41,76,.10)', cls: '-bottom-[25%] left-[20%] size-[55vmax]', x: [0, 40, 0], y: [0, -40, 0], d: 30 },
]

const blurIn = (i: number) => ({
  initial: { opacity: 0, filter: 'blur(14px)', y: 18 },
  animate: { opacity: 1, filter: 'blur(0px)', y: 0 },
  transition: { duration: 0.8, delay: 0.55 + i * 0.14, ease: EASE },
})
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE },
})

/** First-visit winter intro: key-visual poster with aurora, blur-in headline, shimmer CTA and an auto-enter progress line. */
export function WinterIntro({ onFinish }: { onFinish: () => void }) {
  const reduce = useReducedMotion()
  const [loaded, setLoaded] = useState(false)
  const done = useRef(false)
  const cb = useRef(onFinish)
  cb.current = onFinish

  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {}
    cb.current()
  }, [])

  // Hold the art back until it is decoded so it never pops in mid-animation.
  useEffect(() => {
    const img = new Image()
    img.onload = img.onerror = () => setLoaded(true)
    img.src = ART
  }, [])

  // Pointer parallax (mouse only, off for reduced motion)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const spring = { damping: 40, stiffness: 90 }
  const artX = useSpring(useTransform(mx, (v) => -v * 14), spring)
  const artY = useSpring(useTransform(my, (v) => -v * 10), spring)
  const glowX = useSpring(useTransform(mx, (v) => v * 26), spring)
  const glowY = useSpring(useTransform(my, (v) => v * 18), spring)

  useEffect(() => {
    if (reduce) return
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      mx.set((e.clientX / window.innerWidth - 0.5) * 2)
      my.set((e.clientY / window.innerHeight - 0.5) * 2)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [reduce, mx, my])

  // Auto-enter, or skip on key / scroll / swipe / tap
  useEffect(() => {
    const t = window.setTimeout(finish, DURATION_MS)
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) finish()
    }
    window.addEventListener('keydown', key)
    window.addEventListener('wheel', finish, { passive: true })
    window.addEventListener('touchmove', finish, { passive: true })
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', key)
      window.removeEventListener('wheel', finish)
      window.removeEventListener('touchmove', finish)
    }
  }, [finish])

  return (
    <motion.aside
      key="winter-intro-scene"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.8 } }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(10px)', transition: { duration: 0.7, ease: EASE } }}
      onClick={finish}
      aria-label="Winter intro. Tap anywhere to enter."
      className="relative z-10 min-h-svh w-full cursor-pointer select-none overflow-hidden bg-[#04060c] text-white"
    >
      {/* Aurora + dot grid + vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {AURORA.map((a) => (
          <motion.div
            key={a.cls}
            className={`absolute rounded-full will-change-transform ${a.cls}`}
            style={{ background: `radial-gradient(closest-side, ${a.color}, transparent)` }}
            animate={reduce ? undefined : { x: a.x, y: a.y }}
            transition={{ duration: a.d, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
        <div
          className="absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_30%_50%,#000,transparent_70%)]"
          style={{ backgroundImage: 'radial-gradient(rgba(186,230,253,.35) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.6, delay: 0.3 }}
          className="absolute -left-[3%] top-1/2 -translate-y-1/2 font-display text-[min(62vw,34rem)] leading-none text-transparent"
          style={{ WebkitTextStroke: '1px rgba(186,230,253,.07)' }}
        >
          冬
        </motion.span>
      </div>

      {/* Key visual */}
      <motion.div
        aria-hidden
        style={{ x: artX, y: artY }}
        className="pointer-events-none absolute right-0 bottom-0 aspect-[896/1200] h-[54svh] translate-y-[3%] sm:h-[72svh] lg:right-[3%] lg:h-[94svh]"
      >
        <motion.div style={{ x: glowX, y: glowY }} className="absolute -inset-[14%] bg-[radial-gradient(closest-side,rgba(125,211,252,.30),rgba(99,102,241,.12)_55%,transparent)]" />
        <motion.div
          initial={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
          animate={loaded ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : undefined}
          transition={{ duration: 1.3, delay: 0.25, ease: EASE }}
          className="absolute inset-0"
        >
          <motion.img
            src={ART}
            alt=""
            decoding="async"
            draggable={false}
            animate={reduce ? undefined : { y: [0, -7, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="size-full object-contain drop-shadow-[0_20px_60px_rgba(56,189,248,.28)]"
          />
          {/* glint on the snowflake she is holding */}
          <motion.span
            animate={reduce ? undefined : { opacity: [0.3, 0.85, 0.3], scale: [0.8, 1.25, 0.8] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute size-16 -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
            style={{
              left: '20.9%',
              top: '29.3%',
              background: 'radial-gradient(circle, rgba(255,255,255,.9) 0 6%, rgba(125,211,252,.5) 20%, transparent 62%)',
            }}
          />
        </motion.div>
      </motion.div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_72%_60%,transparent_40%,#04060c_100%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#04060c] to-transparent" />

      {/* Content */}
      <div className="relative z-20 mx-auto flex min-h-svh w-full max-w-7xl flex-col px-6 sm:px-10">
        <motion.header {...rise(0.2)} className="flex items-center justify-between pt-6 sm:pt-8">
          <span className="inline-flex items-center gap-2.5">
            <img src={LOGO_URL} alt="" width={32} height={32} className="size-8 rounded-lg object-cover ring-1 ring-white/15" />
            <span className="font-display text-lg font-extrabold tracking-tight">Zenkai</span>
          </span>
          <button
            type="button"
            onClick={finish}
            className="rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            Skip
          </button>
        </motion.header>

        <main className="flex flex-1 flex-col justify-start pt-10 sm:justify-center sm:pt-0 lg:max-w-xl">
          <motion.div {...rise(0.4)} className="relative inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.22em] text-sky-100/80 uppercase backdrop-blur">
            <Snowflake className="size-3.5 text-sky-300" />
            Winter Edition · 2026
            <BorderBeam size={70} duration={5} color="#7dd3fc" />
          </motion.div>

          <h1 className="mt-6 font-display text-[clamp(3.25rem,9vw,6.75rem)] leading-[0.95] font-extrabold tracking-[-0.03em]">
            <motion.span
              {...blurIn(0)}
              className={`animate-shine-text block bg-clip-text pb-1 text-transparent ${reduce ? '[animation:none]' : ''}`}
              style={{
                backgroundImage: 'linear-gradient(110deg,#e0f2fe 30%,#7dd3fc 42%,#fff 50%,#a5b4fc 58%,#e0f2fe 70%)',
                backgroundSize: '200% 100%',
                animationDuration: '4s',
              }}
            >
              Winter
            </motion.span>
            <motion.span {...blurIn(1)} className="block text-white/90">
              on Zenkai.
            </motion.span>
          </h1>

          <motion.p {...rise(1.5)} className="mt-5 max-w-md text-base leading-relaxed text-white/60 sm:text-lg">
            Cold nights, warm blankets and every new episode. Settle in.
          </motion.p>

          <motion.div {...rise(1.8)} className="mt-8">
            <button
              type="button"
              onClick={finish}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-7 py-3.5 text-sm font-bold text-black shadow-[0_10px_40px_rgba(125,211,252,.25)] transition-transform duration-200 hover:scale-[1.03] active:scale-95"
            >
              <span className="relative z-10">Enter Zenkai</span>
              <ArrowRight className="relative z-10 size-4 transition-transform group-hover:translate-x-0.5" />
              <span aria-hidden className="animate-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-sky-200/60 to-transparent" />
            </button>
          </motion.div>
        </main>

        <motion.footer {...rise(2.1)} className="flex items-center justify-between pb-6 text-[11px] font-medium tracking-[0.22em] text-white/40 uppercase sm:pb-8">
          <span>冬 · Season of stories</span>
          <span className="hidden sm:inline">Press any key to enter</span>
        </motion.footer>
      </div>

      {/* Auto-enter progress */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 z-30 h-[2px] bg-white/10">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: DURATION_MS / 1000, ease: 'linear' }}
          className="h-full origin-left bg-accent"
        />
      </div>
    </motion.aside>
  )
}
