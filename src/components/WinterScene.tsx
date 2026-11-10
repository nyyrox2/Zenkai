import { motion, useSpring, useTransform, type MotionValue } from 'framer-motion'

const rand = (seed: number) => {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const tri = (t: number) => 1 - Math.abs((((t % 2) + 2) % 2) - 1)

/** Alpine ridge as closed + open SVG paths: `base` is the valley line, peaks rise by up to `amp`. Wider than the viewBox (1600 x 560) so wide screens never show an edge. */
function ridge(seed: number, base: number, amp: number) {
  const r = rand(seed)
  let line = ''
  for (let x = -800; x <= 2400; x += 24) {
    const y = base - amp * (0.65 * tri(x * 0.0042 + seed) + 0.35 * tri(x * 0.0113 + seed * 3)) + (r() - 0.5) * amp * 0.16
    line += `${line ? ' L' : 'M'}${x} ${y.toFixed(1)}`
  }
  return { line, fill: `${line} L2400 560 L-800 560 Z` }
}

/** Rows of three-tier pines as one path. `gap` thins the middle so the centre stays open. */
function pines(seed: number, y: number, min: number, max: number, n: number, gap?: [number, number]) {
  const r = rand(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const x = -300 + (i + r() * 0.8) * (2200 / n)
    const h = min + r() * (max - min)
    if (gap && x > gap[0] && x < gap[1] && r() < 0.8) continue
    for (let k = 0; k < 3; k++) {
      const by = y - h * 0.28 * k
      const w = h * 0.3 * (1 - 0.22 * k)
      d += `M${x - w} ${by} L${x} ${by - h * 0.46} L${x + w} ${by}Z`
    }
  }
  return d
}

const FAR = ridge(7, 335, 165)
const MID = ridge(21, 400, 75)
const FOREST = pines(3, 528, 34, 66, 70)
const NEAR = pines(11, 575, 110, 190, 30, [380, 1220])
const STARS = Array.from({ length: 80 }, (_, i) => {
  const r = rand(i + 90)
  return { l: r() * 100, t: r() * 46, s: 1.2 + r() * 1.6, o: 0.3 + r() * 0.6 }
})

function useDepth(px: MotionValue<number>, py: MotionValue<number>, f: number) {
  const cfg = { damping: 40, stiffness: 90 }
  return { x: useSpring(useTransform(px, (v) => -v * f), cfg), y: useSpring(useTransform(py, (v) => -v * f * 0.5), cfg) }
}

const LAYER = 'absolute inset-x-[-4%] bottom-0 h-[56svh] sm:h-[50svh]'
const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 1600 560" preserveAspectRatio="xMidYMax slice" className="size-full overflow-visible">
    {children}
  </svg>
)
const Fog = ({ bottom, d, x }: { bottom: string; d: number; x: number }) => (
  <motion.div
    className="absolute inset-x-[-12%] h-[14svh] bg-[linear-gradient(transparent,rgba(186,230,253,.11),transparent)] will-change-transform"
    style={{ bottom }}
    animate={{ x: [-x, x] }}
    transition={{ duration: d, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
  />
)

/** Night mountain scene in depth layers (sky, moon, ridges, lit cabin, fog, pines). Layers shift with the pointer; everything animates via transform/opacity. */
export function WinterScene({ px, py }: { px: MotionValue<number>; py: MotionValue<number> }) {
  const sky = useDepth(px, py, 3)
  const moon = useDepth(px, py, 6)
  const far = useDepth(px, py, 9)
  const mid = useDepth(px, py, 18)
  const near = useDepth(px, py, 34)

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(#02040a,#07112a_36%,#0f2d4a_64%,#256080_90%)]" />

      {/* stars, aurora, shooting stars */}
      <motion.div style={sky} className="absolute -inset-[3%]">
        {STARS.map((s, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${s.l}%`, top: `${s.t}%`, width: s.s, height: s.s, opacity: s.o }}
            animate={i % 5 === 0 ? { opacity: [s.o, 0.1, s.o] } : undefined}
            transition={{ duration: 2.5 + (i % 4), repeat: Infinity, delay: i * 0.17, ease: 'easeInOut' }}
          />
        ))}
        <motion.div
          className="absolute top-[10%] -left-[10%] h-[34%] w-[80%] -rotate-[8deg] bg-[radial-gradient(closest-side,rgba(45,212,191,.34),transparent)] will-change-transform"
          animate={{ x: [0, 70, 0], scaleX: [1, 1.15, 1], opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-[4%] -right-[8%] h-[30%] w-[70%] rotate-[6deg] bg-[radial-gradient(closest-side,rgba(129,140,248,.30),transparent)] will-change-transform"
          animate={{ x: [0, -60, 0], scaleX: [1.1, 0.95, 1.1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        {[
          { l: '8%', t: '8%', d: 3.5, w: 7 },
          { l: '52%', t: '4%', d: 8, w: 10 },
        ].map((m) => (
          <motion.span
            key={m.l}
            className="absolute h-px w-28 origin-left bg-gradient-to-r from-transparent to-white will-change-transform"
            style={{ left: m.l, top: m.t, rotate: 28 }}
            initial={{ opacity: 0 }}
            animate={{ x: [0, 360], y: [0, 190], opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, delay: m.d, repeat: Infinity, repeatDelay: m.w, ease: 'easeIn' }}
          />
        ))}
      </motion.div>

      {/* moon */}
      <motion.div style={moon} className="absolute top-[11svh] right-[10%] sm:top-[13svh] sm:right-[9%]">
        <div className="absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(186,230,253,.24),transparent)]" />
        <div className="relative size-14 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff,#e2e8f0_55%,#94a3b8)] sm:size-20" />
      </motion.div>

      {/* far ridge */}
      <motion.div style={far} className={LAYER}>
        <Svg>
          <defs>
            <linearGradient id="wi-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a9c8e4" />
              <stop offset=".16" stopColor="#4a7096" />
              <stop offset=".45" stopColor="#1a3454" />
              <stop offset="1" stopColor="#0b1a2c" />
            </linearGradient>
          </defs>
          <path d={FAR.fill} fill="url(#wi-far)" />
          <path d={FAR.line} fill="none" stroke="rgba(220,240,255,.35)" strokeWidth="1.2" />
        </Svg>
      </motion.div>
      <Fog bottom="30svh" d={16} x={40} />

      {/* mid ridge + lit cabin */}
      <motion.div style={mid} className={LAYER}>
        <Svg>
          <defs>
            <linearGradient id="wi-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2b4f73" />
              <stop offset=".25" stopColor="#12263d" />
              <stop offset="1" stopColor="#070f1b" />
            </linearGradient>
            <linearGradient id="wi-snow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2c5273" />
              <stop offset="1" stopColor="#0d2034" />
            </linearGradient>
            <radialGradient id="wi-glow">
              <stop offset="0" stopColor="#fbbf24" stopOpacity=".55" />
              <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d={MID.fill} fill="url(#wi-mid)" />
          <path d={MID.line} fill="none" stroke="rgba(186,230,253,.22)" strokeWidth="1.2" />
          <path d="M470 560 Q700 335 930 560 Z" fill="url(#wi-snow)" />
          <path d="M470 560 Q700 335 930 560" fill="none" stroke="rgba(186,230,253,.35)" strokeWidth="1.2" />
          <g transform="translate(700 447) scale(1.7) translate(-700 -480)">
            <motion.circle
              cx="691" cy="468" r="80" fill="url(#wi-glow)"
              animate={{ opacity: [0.7, 1, 0.78, 1, 0.7] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <rect x="672" y="452" width="56" height="28" fill="#0a111c" />
            <path d="M664 454 L700 430 L736 454Z" fill="#0a111c" />
            <path d="M664 454 L700 430 L736 454 L731 454 L700 436 L669 454Z" fill="#d6e8f7" opacity=".85" />
            <rect x="714" y="432" width="8" height="16" fill="#0a111c" />
            <rect x="684" y="462" width="14" height="11" fill="#fbbf24" />
            <rect x="706" y="464" width="9" height="16" fill="#f59e0b" opacity=".55" />
            {[0, 1, 2].map((i) => (
              <motion.circle
                key={i}
                cx="718" cy="428" r="4" fill="#cbd5e1"
                animate={{ cy: [428, 392], cx: [718, 728 + i * 3], r: [3, 9], opacity: [0, 0.32, 0] }}
                transition={{ duration: 4.5, delay: i * 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
            ))}
          </g>
        </Svg>
      </motion.div>
      <Fog bottom="13svh" d={20} x={60} />

      {/* forest + ground + near pines */}
      <motion.div style={near} className={LAYER}>
        <Svg>
          <path d={FOREST} fill="#050d17" />
          <path d="M-800 560 L-800 540 Q400 525 800 538 T2400 532 L2400 560Z" fill="#0a1a2b" />
          <path d={NEAR} fill="#02050a" />
        </Svg>
      </motion.div>
    </div>
  )
}
