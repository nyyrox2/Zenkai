import { useCallback, useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

const STORAGE_KEY = 'zenkai_winter_intro_2026'
const INTRO_DURATION_MS = 5000

interface WinterIntroProps {
  onFinish: () => void
}

/**
 * High-end immersive Winter Intro sequence.
 * - 3D Interactive Mouse/Touch Parallax: Layers shift smoothly in opposite directions.
 * - Character Lighting & Lens Flare: Pulsing starlight glint and warm ambient lighting.
 * - Staggered Typography Reveal: Subtitle first -> Scale/Slide Headline with text-shadow glow -> Cozy description last.
 * - Cinematic Radial Zoom Exit: Camera pushes through soft frost blur when entering the site.
 */
export function WinterIntro({ onFinish }: WinterIntroProps) {
  const [active, setActive] = useState(true)

  // Motion values for smooth interactive 3D parallax
  const rawMouseX = useMotionValue(0)
  const rawMouseY = useMotionValue(0)

  // Opposite-direction 3D parallax layers
  const bgX = useSpring(useTransform(rawMouseX, (v) => -v * 26), { damping: 36, stiffness: 80 })
  const bgY = useSpring(useTransform(rawMouseY, (v) => -v * 26), { damping: 36, stiffness: 80 })

  const charX = useSpring(useTransform(rawMouseX, (v) => -v * 14), { damping: 30, stiffness: 95 })
  const charY = useSpring(useTransform(rawMouseY, (v) => -v * 14), { damping: 30, stiffness: 95 })

  const textX = useSpring(useTransform(rawMouseX, (v) => -v * 7), { damping: 32, stiffness: 110 })
  const textY = useSpring(useTransform(rawMouseY, (v) => -v * 7), { damping: 32, stiffness: 110 })

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {}
    setActive(false)
    // Allow smooth exit animation to complete before unmounting
    const t = window.setTimeout(onFinish, 700)
    return () => window.clearTimeout(t)
  }, [onFinish])

  // Mouse & Touch Parallax Listener
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const { innerWidth, innerHeight } = window
      const x = (e.clientX - innerWidth / 2) / (innerWidth / 2)
      const y = (e.clientY - innerHeight / 2) / (innerHeight / 2)
      rawMouseX.set(x)
      rawMouseY.set(y)
    }

    const handlePointerLeave = () => {
      rawMouseX.set(0)
      rawMouseY.set(0)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [rawMouseX, rawMouseY])

  // Auto-transition to landing page after sequence completes
  useEffect(() => {
    const timer = window.setTimeout(finish, INTRO_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [finish])

  // Allow instant skip on any key, scroll, or tap
  useEffect(() => {
    const onKey = () => finish()
    const onScroll = () => finish()
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onScroll, { passive: true })
    window.addEventListener('touchmove', onScroll, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onScroll)
      window.removeEventListener('touchmove', onScroll)
    }
  }, [finish])

  return (
    <motion.aside
      key="winter-intro-scene"
      initial={{ opacity: 0 }}
      animate={{ opacity: active ? 1 : 0 }}
      exit={{
        opacity: 0,
        scale: 1.15,
        filter: 'blur(16px)',
        transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
      }}
      onClick={finish}
      className="relative z-10 flex min-h-svh w-full cursor-pointer flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-hidden"
      aria-label="Winter intro animation. Tap anywhere to enter."
    >
      {/* Background Parallax Layer: Deep Aurora & Ambient Glow */}
      <motion.div
        aria-hidden
        style={{ x: bgX, y: bgY }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18)_0%,rgba(99,102,241,0.08)_40%,transparent_68%)]"
      />

      <div className="relative z-10 flex flex-col items-center max-w-xl px-4">
        {/* Character Showcase with 3D Parallax & Custom Lighting */}
        <motion.div
          style={{ x: charX, y: charY }}
          initial={{ opacity: 0, scale: 0.88, y: 22 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-3 flex items-center justify-center"
        >
          {/* Soft ambient light gradient that pulses on her scarf and silhouette */}
          <motion.div
            aria-hidden
            animate={{
              opacity: [0.45, 0.75, 0.45],
              scale: [0.98, 1.04, 0.98],
            }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="pointer-events-none absolute -inset-8 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.25)_0%,rgba(244,114,182,0.12)_45%,transparent_70%)] blur-2xl"
          />

          {/* 2D Anime Character */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 4.8, ease: 'easeInOut' }}
            className="relative flex items-center justify-center"
          >
            <img
              src="/winter/anime_character.png"
              alt="Happy Winter Anime Girl"
              className="h-48 w-auto max-w-[14rem] sm:h-60 sm:max-w-[17rem] object-contain drop-shadow-[0_12px_36px_rgba(56,189,248,0.4)]"
            />

            {/* Glowing Lens Flare & Pulsing Starlight on the snowflake in her hand */}
            <motion.div
              animate={{
                scale: [0.9, 1.35, 0.9],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
              className="pointer-events-none absolute right-[18%] top-[16%] flex items-center justify-center"
            >
              {/* Outer soft aura ring */}
              <div className="absolute size-10 rounded-full bg-cyan-300/35 blur-md" />
              {/* Core golden/cyan star glint */}
              <div className="absolute size-3 rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.9),0_0_30px_rgba(56,189,248,0.8)]" />
              {/* Horizontal flare beam */}
              <div className="absolute h-[1.5px] w-12 bg-gradient-to-r from-transparent via-cyan-200 to-transparent" />
              {/* Vertical flare beam */}
              <div className="absolute w-[1.5px] h-12 bg-gradient-to-b from-transparent via-cyan-200 to-transparent" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Parallax Content Container */}
        <motion.div
          style={{ x: textX, y: textY }}
          className="flex flex-col items-center"
        >
          {/* Step 1: Subtitle ("冬の季節 • ZENKAI WINTER 2026") fades & slides in FIRST */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.28, ease: 'easeOut' }}
            className="flex items-center gap-2 text-xs font-bold tracking-[0.35em] text-sky-200/90 uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: "'Comfortaa', 'Outfit', sans-serif" }}
          >
            <span>冬の季節</span>
            <span className="text-sky-400">•</span>
            <span>ZENKAI WINTER 2026</span>
          </motion.div>

          {/* Step 2: "Welcome to Winter" smooth scale-up & slide-up reveal with text-shadow glow */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.9,
              delay: 0.85,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-3 text-5xl sm:text-7xl font-bold tracking-wide text-white drop-shadow-[0_0_36px_rgba(56,189,248,0.65)]"
            style={{ fontFamily: "'Mountains of Christmas', 'Sniglet', cursive" }}
          >
            Welcome to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-sky-300 to-indigo-200 drop-shadow-[0_0_40px_rgba(56,189,248,0.85)]">
              Winter
            </span>
          </motion.h1>

          {/* Step 3: Description fades in LAST (no cursor line) */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.85,
              delay: 1.65,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="mt-3 text-sm sm:text-base font-medium text-slate-200 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-md leading-relaxed"
            style={{ fontFamily: "'Comfortaa', sans-serif" }}
          >
            The cold nights have arrived. Grab a warm blanket and cozy up with Zenkai.
          </motion.p>

          {/* Bottom Skip Hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.65 }}
            transition={{ duration: 0.6, delay: 2.2 }}
            className="mt-7 text-[11px] font-medium tracking-widest text-slate-300 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: "'Comfortaa', sans-serif" }}
          >
            tap or click anywhere to enter
          </motion.p>
        </motion.div>
      </div>
    </motion.aside>
  )
}
