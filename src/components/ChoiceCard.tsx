import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { BorderBeam } from './BorderBeam'

/**
 * Big "pick your world" card: 3D tilt that follows the pointer (React Bits "Tilted Card") with a cursor
 * spotlight (React Bits "Spotlight Card") and a Border Beam on hover. Mouse-only effects; touch just taps through.
 */
export function ChoiceCard({
  to,
  kanji,
  eyebrow,
  title,
  blurb,
  chips,
  icon,
  index,
}: {
  to: string
  kanji: string
  eyebrow: string
  title: string
  blurb: string
  chips: string[]
  icon: ReactNode
  index: number
}) {
  const tilt = useRef<HTMLDivElement>(null)
  const glow = useRef<HTMLDivElement>(null)
  const beam = useRef<HTMLDivElement>(null)
  const raf = useRef(0)

  function onMove(e: React.PointerEvent<HTMLAnchorElement>) {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      if (tilt.current) tilt.current.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * 10}deg) rotateY(${(px - 0.5) * 12}deg) scale3d(1.02,1.02,1.02)`
      if (glow.current) {
        glow.current.style.opacity = '1'
        glow.current.style.background = `radial-gradient(420px circle at ${px * 100}% ${py * 100}%, var(--glow), transparent 65%)`
      }
      if (beam.current) beam.current.style.opacity = '1'
    })
  }
  function onLeave() {
    cancelAnimationFrame(raf.current)
    if (tilt.current) tilt.current.style.transform = ''
    if (glow.current) glow.current.style.opacity = '0'
    if (beam.current) beam.current.style.opacity = '0'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.8, delay: 0.55 + index * 0.14, ease: 'easeOut' }}
      className="h-full"
    >
      <Link to={to} onPointerMove={onMove} onPointerLeave={onLeave} className="group block h-full outline-none">
        <div
          ref={tilt}
          className="relative h-full overflow-hidden rounded-[2rem] border border-border bg-card/70 p-6 backdrop-blur-md transition-[transform,box-shadow] duration-200 ease-out group-hover:shadow-2xl group-hover:shadow-accent/20 group-focus-visible:ring-2 group-focus-visible:ring-accent sm:p-8"
        >
          <div ref={glow} aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300" />
          <div ref={beam} aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300">
            <BorderBeam size={220} duration={7} delay={index * 2} />
          </div>

          {/* giant kanji watermark */}
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-6 -right-3 select-none font-display text-[7.5rem] font-black leading-none text-foreground/[0.05] transition-transform duration-500 group-hover:-translate-y-2 group-hover:scale-110"
          >
            {kanji}
          </span>

          <div className="relative flex h-full min-h-[270px] flex-col sm:min-h-[340px]">
            <div className="flex items-start justify-between">
              <span className="grid size-14 place-items-center rounded-2xl border border-border bg-background/60 text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                {icon}
              </span>
              <span className="grid size-10 place-items-center rounded-full border border-border bg-background/60 transition-all duration-300 group-hover:rotate-12 group-hover:border-accent group-hover:bg-accent group-hover:text-accent-fg">
                <ArrowUpRight className="size-5" />
              </span>
            </div>

            <div className="mt-auto pt-10">
              <p className="eyebrow text-accent">{eyebrow}</p>
              <h2 className="mt-2 font-display text-4xl font-black tracking-tight">{title}</h2>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{blurb}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <li key={c} className="rounded-full border border-border bg-background/50 px-3 py-1 text-[11px] font-medium text-muted">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
