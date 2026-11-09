import { useCallback, useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Snowflake } from 'lucide-react'
import { HyperText } from './HyperText'
import { OrbitingCircles } from './OrbitingCircles'
import { LOGO_URL } from '../lib/constants'

const STORAGE_KEY = 'zenkai_winter_intro_2026'
const EASE = [0.16, 1, 0.3, 1] as const
const SPOT = 640 // pointer spotlight diameter

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: EASE },
})

const SPARKLES = [
  { l: '-3%', t: '12%', s: 14, d: 0 },
  { l: '101%', t: '26%', s: 10, d: 0.9 },
  { l: '86%', t: '-4%', s: 16, d: 1.7 },
  { l: '14%', t: '98%', s: 9, d: 2.4 },
]

/** Twinkling four-point star (Magic UI "Sparkles Text"). */
function Sparkle({ l, t, s, d }: (typeof SPARKLES)[number]) {
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 24 24"
      width={s}
      height={s}
      className="absolute fill-sky-100"
      style={{ left: l, top: t, marginLeft: -s / 2, marginTop: -s / 2 }}
      animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 90, 180] }}
      transition={{ duration: 2.6, delay: 1.8 + d, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
    >
      <path d="M12 0C12.9 7.5 16.5 11.1 24 12C16.5 12.9 12.9 16.5 12 24C11.1 16.5 7.5 12.9 0 12C7.5 11.1 11.1 7.5 12 0Z" />
    </motion.svg>
  )
}

/** First-visit winter intro. Never auto-closes: tap / click anywhere to enter. Transform + opacity animation only. */
export function WinterIntro({ onFinish }: { onFinish: () => void }) {
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

  // Pointer -> tilt of the orbit stage + a soft spotlight that trails the cursor (touch drag works too)
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const gx = useMotionValue(window.innerWidth / 2 - SPOT / 2)
  const gy = useMotionValue(window.innerHeight / 2 - SPOT / 2)
  const tilt = { damping: 30, stiffness: 120 }
  const rotY = useSpring(useTransform(px, (v) => v * 12), tilt)
  const rotX = useSpring(useTransform(py, (v) => -v * 12), tilt)
  const sx = useSpring(gx, { damping: 40, stiffness: 70 })
  const sy = useSpring(gy, { damping: 40, stiffness: 70 })

  useEffect(() => {
    const move = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth) * 2 - 1)
      py.set((e.clientY / window.innerHeight) * 2 - 1)
      gx.set(e.clientX - SPOT / 2)
      gy.set(e.clientY - SPOT / 2)
    }
    const key = (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') && finish()
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('keydown', key)
    }
  }, [px, py, gx, gy, finish])

  return (
    <motion.aside
      key="winter-intro-scene"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6 } }}
      exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.6, ease: EASE } }}
      onClick={finish}
      aria-label="Winter intro. Click anywhere to enter."
      className="relative z-10 flex min-h-svh w-full cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#05070d] px-6 text-center text-white select-none"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_0%,rgba(56,189,248,.10),transparent)]" />
      <motion.div
        aria-hidden
        style={{ x: sx, y: sy, width: SPOT, height: SPOT }}
        className="pointer-events-none absolute top-0 left-0 rounded-full bg-[radial-gradient(closest-side,rgba(125,211,252,.16),transparent)] will-change-transform"
      />

      {/* Orbit stage */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.1, ease: EASE }}
        className="relative z-10"
      >
        <motion.div style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 900 }} className="relative aspect-square h-[clamp(190px,34svh,300px)] will-change-transform">
          <OrbitingCircles size={100} duration={38} reverse>
            <Snowflake className="size-4 text-sky-200/80" />
            <span className="block size-1.5 rounded-full bg-sky-200/60" />
            <Snowflake className="size-3 text-indigo-200/70" />
            <span className="block size-1 rounded-full bg-white/60" />
            <Snowflake className="size-4 text-sky-100/80" />
            <span className="block size-1.5 rounded-full bg-indigo-200/60" />
          </OrbitingCircles>
          <OrbitingCircles size={62} duration={26}>
            <Snowflake className="size-5 text-sky-100" />
            <span className="block size-1.5 rounded-full bg-sky-200/70" />
            <Snowflake className="size-3.5 text-sky-200/80" />
          </OrbitingCircles>
          <div className="absolute inset-0 grid place-items-center">
            <motion.img
              src={LOGO_URL}
              alt=""
              draggable={false}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-[24%] rounded-2xl object-cover shadow-[0_0_60px_rgba(125,211,252,.35)] ring-1 ring-white/15"
            />
          </div>
        </motion.div>
      </motion.div>

      <motion.div {...rise(0.6)} className="relative z-10 mt-6">
        <HyperText text="WINTER 2026" delay={700} className="font-mono text-xs font-semibold tracking-[0.35em] text-sky-200/70" />
      </motion.div>

      <h1 className="relative z-10 mt-4 font-display font-extrabold tracking-[-0.03em]">
        <motion.span {...rise(0.8)} className="block text-[clamp(1.4rem,4vw,2.25rem)] font-semibold text-white/70">
          Welcome to
        </motion.span>
        <motion.span {...rise(1)} className="relative mt-1 inline-block text-[clamp(3.75rem,13vw,8rem)] leading-none">
          <motion.span
            className="block bg-clip-text pb-2 text-transparent"
            style={{
              backgroundImage: 'linear-gradient(110deg,#7dd3fc,#c7d2fe,#f5d0fe,#a5f3fc,#7dd3fc)',
              backgroundSize: '200% 100%',
            }}
            animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
          >
            Winter
          </motion.span>
          {SPARKLES.map((s) => (
            <Sparkle key={s.l} {...s} />
          ))}
        </motion.span>
      </h1>

      <p className="relative z-10 mt-5 max-w-md text-base leading-relaxed text-white/55 sm:text-lg">
        {'Cold nights, warm blankets and every new episode. Settle in.'.split(' ').map((w, i) => (
          <motion.span key={i} {...rise(1.3 + i * 0.05)} className="mr-[0.28em] inline-block">
            {w}
          </motion.span>
        ))}
      </p>

      <motion.div {...rise(2.2)} className="relative z-10 mt-10">
        <motion.span
          animate={{ opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          className="block text-[11px] font-medium tracking-[0.3em] text-white uppercase"
        >
          Click anywhere to enter
        </motion.span>
      </motion.div>
    </motion.aside>
  )
}
