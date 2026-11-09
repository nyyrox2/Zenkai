import { Children, type ReactNode } from 'react'
import { motion } from 'framer-motion'

/**
 * Items travelling round a ring (Magic UI "Orbiting Circles"). Sized in % of the parent box so it scales with it.
 * One rotating layer, transform-only; driven by framer-motion so it keeps running under the global reduced-motion CSS.
 */
export function OrbitingCircles({
  children,
  size = 100,
  duration = 30,
  reverse = false,
}: {
  children: ReactNode
  size?: number
  duration?: number
  reverse?: boolean
}) {
  const items = Children.toArray(children)
  return (
    <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `${size}%`, height: `${size}%` }}>
      <div className="absolute inset-0 rounded-full border border-white/[0.07]" />
      <motion.div
        className="absolute inset-0 will-change-transform"
        animate={{ rotate: reverse ? -360 : 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      >
        {items.map((child, i) => (
          <div key={i} className="absolute inset-0" style={{ transform: `rotate(${(360 / items.length) * i}deg)` }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">{child}</div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
