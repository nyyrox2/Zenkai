import { useEffect, useRef } from 'react'

interface InteractiveSnowfallProps {
  /** Total number of snowflakes on screen. Default 50 flakes. */
  count?: number
  zIndex?: number
  /** Fall speed multiplier. Default 0.24 for an ultra-calm, gentle winter drift. */
  speedMultiplier?: number
}

type FlakeKind = 'classic' | 'dendrite' | 'plate' | 'soft'
type LayerType = 'far' | 'mid' | 'close'

interface Flake {
  x: number
  y: number
  size: number
  baseSpeed: number
  driftX: number
  swaySpeed: number
  swayAmp: number
  swayPhase: number
  flutterSpeed: number
  flutterAmp: number
  flutterPhase: number
  opacity: number
  rotation: number
  spinSpeed: number
  vx: number
  vy: number
  kind: FlakeKind
  layer: LayerType
  parallaxFactor: number
}

const PI = Math.PI
const PI_OVER_3 = PI / 3
const SIN_60 = Math.sin(PI_OVER_3)
const COS_60 = 0.5

function rotate6(ctx: CanvasRenderingContext2D, fn: () => void) {
  for (let i = 0; i < 6; i++) {
    ctx.save()
    ctx.rotate(i * PI_OVER_3)
    fn()
    ctx.restore()
  }
}

function drawHexagon(ctx: CanvasRenderingContext2D, r: number) {
  ctx.moveTo(0, -r)
  for (let i = 1; i < 6; i++) {
    ctx.lineTo(Math.sin(i * PI_OVER_3) * r, -Math.cos(i * PI_OVER_3) * r)
  }
  ctx.closePath()
}

/** Pre-renders small, delicate, crystalline textured snowflake sprites */
function createFlakeSprite(kind: FlakeKind, size: number, dpr: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const dim = Math.ceil(size * dpr * 2.3 + 4)
  canvas.width = canvas.height = dim
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.scale(dpr, dpr)
  const center = (dim / dpr) / 2
  ctx.translate(center, center)

  const r = size
  const color = 'rgba(235, 248, 255, 1)'

  if (kind === 'classic') {
    // Classic 6-fold barbed snowflake
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = Math.max(0.7, r * 0.09)
    ctx.lineCap = 'round'

    ctx.beginPath()
    rotate6(ctx, () => {
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -r * 0.94)
      const barbs = [[0.4, 0.32], [0.66, 0.22]]
      for (const [pos, len] of barbs) {
        const y = -r * pos
        ctx.moveTo(0, y)
        ctx.lineTo(r * len * SIN_60, y - r * len * COS_60)
        ctx.moveTo(0, y)
        ctx.lineTo(-r * len * SIN_60, y - r * len * COS_60)
      }
    })
    ctx.stroke()

    ctx.beginPath()
    drawHexagon(ctx, r * 0.18)
    ctx.fill()
  } else if (kind === 'dendrite') {
    // Intricate recursive fractal branching crystal
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(0.65, r * 0.075)
    ctx.lineCap = 'round'

    const branch = (len: number, depth: number) => {
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -len)
      if (depth > 0) {
        const subPos = [0.35, 0.65]
        for (const p of subPos) {
          const subLen = len * (0.42 - p * 0.25)
          for (const dir of [-1, 1]) {
            ctx.save()
            ctx.translate(0, -len * p)
            ctx.rotate(dir * PI_OVER_3)
            branch(subLen, depth - 1)
            ctx.restore()
          }
        }
      }
    }

    ctx.beginPath()
    rotate6(ctx, () => branch(r * 0.95, 1))
    ctx.stroke()

    ctx.beginPath()
    drawHexagon(ctx, r * 0.15)
    ctx.stroke()
  } else if (kind === 'plate') {
    // Hexagonal crystal facet plate
    ctx.strokeStyle = color
    ctx.fillStyle = color

    ctx.beginPath()
    drawHexagon(ctx, r * 0.88)
    ctx.globalAlpha = 0.35
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.lineWidth = Math.max(0.65, r * 0.08)
    ctx.stroke()

    ctx.beginPath()
    drawHexagon(ctx, r * 0.48)
    ctx.lineWidth = Math.max(0.5, r * 0.06)
    ctx.stroke()

    ctx.beginPath()
    ctx.lineWidth = Math.max(0.5, r * 0.05)
    rotate6(ctx, () => {
      ctx.moveTo(0, -r * 0.48)
      ctx.lineTo(0, -r * 0.88)
    })
    ctx.stroke()
  } else {
    // Soft glowing bokeh snowflake
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
    grad.addColorStop(0, 'rgba(240, 249, 255, 0.95)')
    grad.addColorStop(0.35, 'rgba(224, 242, 254, 0.65)')
    grad.addColorStop(0.7, 'rgba(186, 230, 253, 0.22)')
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
  }

  return canvas
}

/**
 * Textured Interactive Snowfall Engine.
 * - Small, delicate, realistic snowflake sizes (2.5px to 7.5px radius).
 * - Textured artwork: Classic crystals, Dendrites, Hexagonal plates, and Soft bokeh.
 * - Calmer, peaceful speed (speedMultiplier ~0.24) with frame-rate independent delta time.
 * - Primary downward fall with gentle, uneven left or right meandering ("r or l unevenly, not too much").
 * - 3-layer parallax depth of field and soft cursor air-current physics.
 */
export function InteractiveSnowfall({
  count = 50,
  zIndex = 20,
  speedMultiplier = 0.24,
}: InteractiveSnowfallProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', resize)

    // Pre-cache small, delicate textured sprite canvases (radii: 2.5px, 4px, 5.5px, 7.5px)
    const spriteSizes = [2.5, 4, 5.5, 7.5]
    const spriteKinds: FlakeKind[] = ['classic', 'dendrite', 'plate', 'soft']
    const sprites: Record<string, HTMLCanvasElement> = {}

    for (const kind of spriteKinds) {
      for (const sz of spriteSizes) {
        sprites[`${kind}-${sz}`] = createFlakeSprite(kind, sz, dpr)
      }
    }

    // Cursor tracking with smoothed parallax
    const mouse = {
      x: -9999,
      y: -9999,
      normalizedX: 0,
      normalizedY: 0,
      targetNormX: 0,
      targetNormY: 0,
      active: false,
    }

    const onPointerMove = (e: PointerEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.targetNormX = (e.clientX - width / 2) / (width / 2)
      mouse.targetNormY = (e.clientY - height / 2) / (height / 2)
      mouse.active = true
    }

    const onPointerLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
      mouse.targetNormX = 0
      mouse.targetNormY = 0
      mouse.active = false
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave, { passive: true })

    // Generate 3 layers of flakes with delicate sizes, calm speed, and uneven left/right drift
    const flakes: Flake[] = []
    for (let i = 0; i < count; i++) {
      const rand = Math.random()
      let layer: LayerType = 'mid'
      let size = 4
      let baseSpeed = 0.35
      let opacity = 0.6
      let parallaxFactor = 14

      if (rand < 0.45) {
        // Far layer: distant, tiny, delicate (size 2.5)
        layer = 'far'
        size = 2.5
        baseSpeed = (0.24 + Math.random() * 0.2) * speedMultiplier
        opacity = 0.25 + Math.random() * 0.22
        parallaxFactor = 6
      } else if (rand < 0.85) {
        // Mid layer: crisp crystalline snowflakes (size 4 or 5.5)
        layer = 'mid'
        size = Math.random() < 0.5 ? 4 : 5.5
        baseSpeed = (0.45 + Math.random() * 0.3) * speedMultiplier
        opacity = 0.5 + Math.random() * 0.3
        parallaxFactor = 14
      } else {
        // Close layer: slightly larger foreground flake (size 7.5)
        layer = 'close'
        size = 7.5
        baseSpeed = (0.7 + Math.random() * 0.35) * speedMultiplier
        opacity = 0.35 + Math.random() * 0.3
        parallaxFactor = 24
      }

      // Pick textured artwork
      const kindRand = Math.random()
      let kind: FlakeKind = 'classic'
      if (kindRand < 0.35) kind = 'classic'
      else if (kindRand < 0.62) kind = 'dendrite'
      else if (kindRand < 0.84) kind = 'plate'
      else kind = 'soft'

      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size,
        baseSpeed,
        // Individual uneven left/right drift bias (-0.08 to +0.08)
        driftX: (Math.random() - 0.5) * 0.16,
        swaySpeed: 0.0006 + Math.random() * 0.001,
        swayAmp: 0.14 + Math.random() * 0.2,
        swayPhase: Math.random() * Math.PI * 2,
        flutterSpeed: 0.0014 + Math.random() * 0.0018,
        flutterAmp: 0.05 + Math.random() * 0.1,
        flutterPhase: Math.random() * Math.PI * 2,
        opacity,
        rotation: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.006,
        vx: 0,
        vy: 0,
        kind,
        layer,
        parallaxFactor,
      })
    }

    let lastTime = performance.now()

    const render = (currentTime: number) => {
      ctx.clearRect(0, 0, width, height)

      // Normalize delta time to 60fps (16.667ms per frame)
      const dtMs = currentTime - lastTime
      lastTime = currentTime
      const delta = Math.min(Math.max(dtMs / 16.667, 0.1), 2.0)

      // Smooth lerp for mouse parallax
      mouse.normalizedX += (mouse.targetNormX - mouse.normalizedX) * 0.04
      mouse.normalizedY += (mouse.targetNormY - mouse.normalizedY) * 0.04

      const cursorInfluenceRadius = 90
      const cursorRadiusSq = cursorInfluenceRadius * cursorInfluenceRadius

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]

        // Organic falling motion: primarily downward, with subtle uneven left or right meandering
        const sway = Math.sin(currentTime * f.swaySpeed + f.swayPhase) * f.swayAmp
        const flutter = Math.cos(currentTime * f.flutterSpeed + f.flutterPhase) * f.flutterAmp
        const horizontalMotion = f.driftX + sway + flutter

        // Gentle cursor air-current deflection (soft and peaceful)
        if (mouse.active) {
          const dx = f.x - mouse.x
          const dy = f.y - mouse.y
          const distSq = dx * dx + dy * dy

          if (distSq < cursorRadiusSq && distSq > 0) {
            const dist = Math.sqrt(distSq)
            const force = Math.pow(1 - dist / cursorInfluenceRadius, 2) * 0.28
            f.vx += (dx / dist) * force
            f.vy += (dy / dist) * force * 0.35
          }
        }

        // Smooth velocity damping
        f.vx *= Math.pow(0.95, delta)
        f.vy *= Math.pow(0.95, delta)

        // Position update: vertical fall is dominant, with gentle uneven L/R horizontal motion
        f.x += (horizontalMotion + f.vx) * delta
        f.y += (f.baseSpeed + f.vy) * delta
        f.rotation += f.spinSpeed * delta

        // Wrap around boundaries smoothly
        if (f.y > height + 20) {
          f.y = -20
          f.x = Math.random() * width
          f.vx = 0
          f.vy = 0
          // Refresh drift bias slightly when recycling
          f.driftX = (Math.random() - 0.5) * 0.16
        } else if (f.y < -30) {
          f.y = height + 15
        }

        if (f.x > width + 20) {
          f.x = -20
        } else if (f.x < -20) {
          f.x = width + 20
        }

        // Apply layer parallax offset based on cursor position
        const drawX = f.x - mouse.normalizedX * f.parallaxFactor
        const drawY = f.y - mouse.normalizedY * (f.parallaxFactor * 0.35)

        // Draw textured snowflake sprite
        const spriteKey = `${f.kind}-${f.size}`
        const sprite = sprites[spriteKey]

        if (sprite) {
          ctx.save()
          ctx.globalAlpha = f.opacity
          ctx.translate(drawX, drawY)
          ctx.rotate(f.rotation)

          const drawDim = sprite.width / dpr
          ctx.drawImage(sprite, -drawDim / 2, -drawDim / 2, drawDim, drawDim)
          ctx.restore()
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      cancelAnimationFrame(animationFrameId)
    }
  }, [count, speedMultiplier])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full select-none"
      style={{ zIndex }}
    />
  )
}
