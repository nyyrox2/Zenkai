import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion'
import { HyperText } from './HyperText'
import { WinterScene } from './WinterScene'

const STORAGE_KEY = 'zenkai_winter_intro_2026'
const EASE = [0.16, 1, 0.3, 1] as const
const SPOT = 520
const LINES = ['When the nights grow long,', 'the best stories wait to be watched.']
const BAR = 8 // letterbox height in svh
const TITLE = 'font-display text-[clamp(3.5rem,14vw,9.5rem)] leading-none font-black tracking-[0.14em] pl-[0.14em]'
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

/**
 * Cinematic first-visit intro: letterbox opens on a moonlit mountain scene, two title cards, then the title with a lens-flare streak.
 * Never auto-closes — click / tap anywhere (or Enter, Space, Escape) to enter. Transform + opacity animation only.
 */
export function WinterIntro({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0)
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

  // Title-card timeline
  useEffect(() => {
    const ts = [2000, 4600, 7400].map((ms, i) => window.setTimeout(() => setStep(i + 1), ms))
    return () => ts.forEach(window.clearTimeout)
  }, [])

  // Pointer -> camera parallax + a light that trails the cursor (touch drag works too)
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const gx = useMotionValue(window.innerWidth / 2 - SPOT / 2)
  const gy = useMotionValue(window.innerHeight / 2 - SPOT / 2)
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

  const bar = (origin: string) => ({
    initial: { scaleY: 1 },
    animate: { scaleY: BAR / 50 },
    exit: { scaleY: 1, transition: { duration: 0.55, ease: EASE } },
    transition: { duration: 2.2, delay: 0.3, ease: EASE },
    className: `absolute inset-x-0 z-20 h-[50svh] bg-black ${origin}`,
  })

  return (
    <motion.aside
      key="winter-intro-scene"
      exit={{ opacity: 0, transition: { duration: 0.4, delay: 0.5 } }}
      onClick={finish}
      aria-label="Winter intro. Click anywhere to enter."
      className="relative z-10 min-h-svh w-full cursor-pointer overflow-hidden bg-black text-white select-none"
    >
      {/* camera: slow push-in over the whole scene */}
      <motion.div
        className="absolute inset-0 will-change-transform"
        initial={{ opacity: 0, scale: 1 }}
        animate={{ opacity: 1, scale: 1.08 }}
        transition={{ opacity: { duration: 2.2, delay: 0.4 }, scale: { duration: 26, ease: 'linear' } }}
      >
        <WinterScene px={px} py={py} />
      </motion.div>

      <motion.div
        aria-hidden
        style={{ x: sx, y: sy, width: SPOT, height: SPOT }}
        className="pointer-events-none absolute top-0 left-0 rounded-full bg-[radial-gradient(closest-side,rgba(186,230,253,.10),transparent)] will-change-transform"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.07]" style={{ backgroundImage: GRAIN }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_45%,transparent_55%,rgba(0,0,0,.65)_100%)]" />

      {/* title cards */}
      <div className="pointer-events-none absolute inset-x-0 top-[19svh] z-10 flex min-h-[clamp(9rem,24vw,13rem)] flex-col items-center justify-center px-6 text-center sm:top-[17svh]">
        <AnimatePresence mode="wait">
          {(step === 1 || step === 2) && (
            <motion.p
              key={step}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.5 } }}
              className="max-w-[24ch] font-display text-[clamp(1.25rem,3.4vw,2.1rem)] leading-snug font-light tracking-[0.04em] text-white/90 [text-shadow:0_2px_30px_rgba(0,0,0,.7)]"
            >
              {LINES[step - 1].split(' ').map((w, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: i * 0.12, ease: EASE }}
                  className="mr-[0.3em] inline-block"
                >
                  {w}
                </motion.span>
              ))}
            </motion.p>
          )}
        </AnimatePresence>

        {step >= 3 && (
          <div className="relative flex flex-col items-center">
            <motion.span
              aria-hidden
              className="absolute top-1/2 left-1/2 h-px w-[min(92vw,980px)] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(125,211,252,.9),#fff,rgba(125,211,252,.9),transparent)] will-change-transform"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: [0, 1, 0.5] }}
              transition={{ duration: 1.8, ease: EASE }}
            />
            <h1 aria-label="Zenkai" className={`relative ${TITLE} text-[#e8f6ff] [text-shadow:0_0_50px_rgba(125,211,252,.45),0_2px_0_rgba(0,0,0,.4)]`}>
              {'ZENKAI'.split('').map((c, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="inline-block"
                  initial={{ opacity: 0, y: 36, scale: 1.12 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 1, delay: 0.15 + i * 0.09, ease: EASE }}
                >
                  {c}
                </motion.span>
              ))}
              <motion.span
                aria-hidden
                className={`pointer-events-none absolute inset-0 bg-clip-text text-transparent ${TITLE}`}
                style={{
                  fontKerning: 'none',
                  textShadow: 'none',
                  backgroundImage: 'linear-gradient(105deg, transparent 42%, rgba(255,255,255,.95) 50%, transparent 58%)',
                  backgroundSize: '300% 100%',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: '100% 0%',
                }}
                animate={{ backgroundPosition: ['100% 0%', '0% 0%'] }}
                transition={{ duration: 2.4, delay: 1.5, repeat: Infinity, repeatDelay: 4.5, ease: 'easeInOut' }}
              >
                ZENKAI
              </motion.span>
            </h1>
            <HyperText text="WINTER · 2026" delay={900} className="mt-5 font-mono text-xs font-semibold tracking-[0.45em] text-sky-100/75 sm:text-sm" />
          </div>
        )}
      </div>

      {/* letterbox */}
      <motion.div {...bar('top-0 origin-top')} />
      <motion.div {...bar('bottom-0 origin-bottom')} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        style={{ height: `${BAR}svh` }}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 font-mono text-[10px] tracking-[0.35em] text-white/35 uppercase sm:px-10"
      >
        <span>A Zenkai Original</span>
        <span>Chapter · Winter</span>
      </motion.div>
      <div style={{ height: `${BAR}svh` }} className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={step >= 3 ? 'enter' : 'skip'}
            initial={{ opacity: 0 }}
            animate={step >= 3 ? { opacity: [0.35, 0.95, 0.35] } : { opacity: 0.4 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={step >= 3 ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : { delay: 2, duration: 1 }}
            className="text-[11px] font-medium tracking-[0.3em] text-white uppercase"
          >
            {step >= 3 ? 'Click anywhere to enter' : 'Click to skip'}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}
