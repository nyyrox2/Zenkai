import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Check, FlipHorizontal2, FlipVertical2, Loader2, RotateCcw, RotateCw, Sparkles, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '../lib/utils'
import { bytesToDataUrl, canDecodeAnimated, closeFrames, decodeFrames, encodeGif, sniffBlob, type AnimFormat } from '../lib/animatedImage'

export type CropKind = 'avatar' | 'banner'

/** Output size of the saved image. Avatar is square (shown round), banner is 3:1. */
const OUT: Record<CropKind, [number, number]> = { avatar: [384, 384], banner: [1200, 400] }
/** Animated (GIF / APNG) output is smaller so the data: url stays light enough to sync. */
const AOUT: Record<CropKind, [number, number]> = { avatar: [256, 256], banner: [720, 240] }
const TITLE: Record<CropKind, string> = { avatar: 'Crop profile picture', banner: 'Crop profile banner' }

type V = { x: number; y: number }
const rad = (d: number) => (d * Math.PI) / 180
const rot = (x: number, y: number, a: number): V => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) })
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The four corners of the crop frame, expressed in the image's own (rotated) axes. */
function corners(fw: number, fh: number, a: number): V[] {
  return [rot(fw / 2, fh / 2, -a), rot(fw / 2, -fh / 2, -a), rot(-fw / 2, fh / 2, -a), rot(-fw / 2, -fh / 2, -a)]
}

/** Smallest scale at which the (rotated) image still covers the whole frame when centred. */
function coverScale(w: number, h: number, fw: number, fh: number, a: number) {
  return Math.max(...corners(fw, fh, a).map((o) => Math.max((2 * Math.abs(o.x)) / w, (2 * Math.abs(o.y)) / h)))
}

/** Keep the frame fully inside the image: c is the frame centre in image axes (screen px). */
function clampCentre(c: V, s: number, w: number, h: number, fw: number, fh: number, a: number): V {
  const o = corners(fw, fh, a)
  const range = (half: number, k: 'x' | 'y') => {
    const lo = Math.max(...o.map((p) => -half - p[k]))
    const hi = Math.min(...o.map((p) => half - p[k]))
    return lo > hi ? [(lo + hi) / 2, (lo + hi) / 2] : [lo, hi]
  }
  const [x0, x1] = range((s * w) / 2, 'x')
  const [y0, y1] = range((s * h) / 2, 'y')
  return { x: clamp(c.x, x0, x1), y: clamp(c.y, y0, y1) }
}

export function ImageCropper({ src, kind, onApply, onClose }: { src: string; kind: CropKind; onApply: (dataUrl: string) => void; onClose: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [angle, setAngle] = useState(0)
  const [flip, setFlip] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [anim, setAnim] = useState<AnimFormat>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [c, setC] = useState<V>({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Frame + stage sizes, measured once from the viewport.
  const dims = useMemo(() => {
    const modalW = Math.min(window.innerWidth - 24, 560)
    const stageW = modalW - 32
    if (kind === 'avatar') {
      const f = Math.min(260, stageW - 48)
      return { stageW, stageH: f + 64, fw: f, fh: f }
    }
    const fw = stageW - 40
    return { stageW, stageH: Math.round(fw / 3) + 96, fw, fh: Math.round(fw / 3) }
  }, [kind])

  useEffect(() => {
    const i = new Image()
    i.onload = () => setImg(i)
    i.onerror = () => setFailed(true)
    i.src = src
  }, [src])

  useEffect(() => {
    let live = true
    fetch(src)
      .then((r) => r.blob())
      .then(sniffBlob)
      .then((f) => live && setAnim(f))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [src])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      const step = e.shiftKey ? 12 : 3
      const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key]
      if (!d || (e.target as HTMLElement).tagName === 'INPUT') return
      e.preventDefault()
      nudge.current(d[0], d[1])
    }
    window.addEventListener('keydown', key)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', key)
    }
  }, [onClose])

  const w = img?.naturalWidth ?? 1
  const h = img?.naturalHeight ?? 1
  const a = rad(angle)
  const base = img ? coverScale(w, h, dims.fw, dims.fh, a) : 1
  const s = base * zoom
  const cc = img ? clampCentre(c, s, w, h, dims.fw, dims.fh, a) : c
  const pan = rot(cc.x, cc.y, a) // image centre offset = -pan
  const nudge = useRef((_x: number, _y: number) => {})
  nudge.current = (x, y) => {
    const d = rot(x, y, -a)
    setC({ x: cc.x + d.x, y: cc.y + d.y })
  }

  // Pointer gestures: one finger / mouse pans, two fingers pinch-zoom.
  const pts = useRef(new Map<number, V>())
  const pinch = useRef(0)
  function down(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setDragging(true)
    if (pts.current.size === 2) {
      const [p, q] = [...pts.current.values()]
      pinch.current = Math.hypot(p.x - q.x, p.y - q.y)
    }
  }
  function move(e: React.PointerEvent) {
    const prev = pts.current.get(e.pointerId)
    if (!prev) return
    const now = { x: e.clientX, y: e.clientY }
    pts.current.set(e.pointerId, now)
    if (pts.current.size === 2) {
      const [p, q] = [...pts.current.values()]
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      if (pinch.current) setZoom((z) => clamp(z * (d / pinch.current), 1, 5))
      pinch.current = d
      return
    }
    const d = rot(-(now.x - prev.x), -(now.y - prev.y), -a)
    setC({ x: cc.x + d.x, y: cc.y + d.y })
  }
  function up(e: React.PointerEvent) {
    pts.current.delete(e.pointerId)
    pinch.current = 0
    if (pts.current.size === 0) setDragging(false)
  }

  const setAngleSnap = (v: number) => setAngle(Math.abs(v) < 1 ? 0 : clamp(v, -180, 180))
  const turn = (d: number) => setAngle((x) => { const n = x + d; return n > 180 ? n - 360 : n < -180 ? n + 360 : n })
  const reset = () => {
    setZoom(1)
    setAngle(0)
    setFlip(false)
    setFlipV(false)
    setC({ x: 0, y: 0 })
  }

  /** Paint the image through the current pan / zoom / rotate / flip onto an output canvas context. */
  function paint(g: CanvasRenderingContext2D, src: CanvasImageSource, ow: number, oh: number, scale = 1) {
    const k = ow / dims.fw
    g.imageSmoothingQuality = 'high'
    g.scale(scale, scale)
    g.translate(ow / 2 - pan.x * k, oh / 2 - pan.y * k)
    g.rotate(a)
    g.scale((flip ? -1 : 1) * s * k, (flipV ? -1 : 1) * s * k)
    g.drawImage(src, -w / 2, -h / 2, w, h)
  }

  async function apply() {
    if (!img || busy) return
    setBusy(true)
    setError('')
    setProgress(0)
    try {
      if (anim) {
        const blob = await (await fetch(src)).blob()
        // Browser can't decode frames: keep the original animation untouched rather than flattening it.
        if (!canDecodeAnimated()) {
          if (blob.size > 3 * 1048576) throw new Error('This browser cannot crop animated images and the file is over 3 MB.')
          onApply(await bytesToDataUrl(new Uint8Array(await blob.arrayBuffer()), blob.type || 'image/gif'))
          return
        }
        const [ow, oh] = AOUT[kind]
        const frames = await decodeFrames(blob, anim)
        try {
          const bytes = await encodeGif(frames, ow, oh, (g, f, sc) => paint(g, f as CanvasImageSource, ow, oh, sc), { onProgress: setProgress })
          if (bytes.byteLength > 3 * 1048576) throw new Error('Animation is too long or detailed to fit. Try a shorter GIF.')
          onApply(await bytesToDataUrl(bytes, 'image/gif'))
        } finally {
          closeFrames(frames)
        }
        return
      }
      const [ow, oh] = OUT[kind]
      const canvas = document.createElement('canvas')
      canvas.width = ow
      canvas.height = oh
      const g = canvas.getContext('2d')!
      g.fillStyle = '#000'
      g.fillRect(0, 0, ow, oh)
      paint(g, img, ow, oh)
      onApply(canvas.toDataURL('image/jpeg', 0.9))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process that image.')
      setBusy(false)
    }
  }

  const iconBtn = 'grid size-10 place-items-center rounded-full border border-border bg-card-2/60 transition hover:border-accent hover:text-accent active:scale-90'

  return createPortal(
    <motion.div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={TITLE[kind]}
        initial={{ y: 60, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="max-h-[calc(100dvh-24px)] w-full max-w-[560px] overflow-y-auto rounded-3xl border border-border bg-card p-4 text-foreground shadow-2xl shadow-black/60"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{TITLE[kind]}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={iconBtn}>
            <X className="size-4" />
          </button>
        </div>

        {/* Stage: the whole image is visible, the part outside the frame is dimmed */}
        <div className="relative mx-auto touch-none select-none overflow-hidden rounded-2xl bg-black" style={{ width: dims.stageW, height: dims.stageH, cursor: dragging ? 'grabbing' : 'grab' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => setZoom((z) => clamp(z * Math.exp(-e.deltaY * 0.0015), 1, 5))}>
          {img && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform: `translate(${-pan.x}px, ${-pan.y}px) rotate(${angle}deg) scale(${flip ? -s : s}, ${flipV ? -s : s})` }}
            />
          )}
          {!img && <p className="absolute inset-0 grid place-items-center text-sm text-white/60">{failed ? 'Could not read that image.' : 'Loading…'}</p>}
          <div
            aria-hidden
            className={cn('pointer-events-none absolute left-1/2 top-1/2 border-2 border-accent', kind === 'avatar' ? 'rounded-full' : 'rounded-xl')}
            style={{ width: dims.fw, height: dims.fh, transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 9999px rgba(10, 6, 24, 0.74)' }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-[inherit] transition-opacity duration-200" style={{ opacity: dragging ? 1 : 0 }}>
              {[1, 2].map((i) => (
                <span key={i}>
                  <span className="absolute inset-y-0 w-px bg-white/35" style={{ left: `${(i * 100) / 3}%` }} />
                  <span className="absolute inset-x-0 h-px bg-white/35" style={{ top: `${(i * 100) / 3}%` }} />
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted">Drag to move. Scroll or pinch to zoom. Arrow keys nudge.</p>
        {anim && (
          <p className="mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="size-3.5" /> Animated {anim === 'gif' ? 'GIF' : anim === 'apng' ? 'APNG' : 'WebP'}: animation is kept
          </p>
        )}

        <div className="mt-3 space-y-4 rounded-2xl border border-border bg-background/40 p-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="crop-zoom" className="text-sm font-semibold">Zoom</label>
              <span className="text-xs tabular-nums text-muted">{zoom.toFixed(2)}x</span>
            </div>
            <div className="flex items-center gap-3">
              <ZoomOut className="size-4 shrink-0 text-muted" />
              <input id="crop-zoom" type="range" min={1} max={5} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="zk-range w-full" />
              <ZoomIn className="size-4 shrink-0 text-muted" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor="crop-angle" className="text-sm font-semibold">Rotate</label>
              <span className="flex items-center gap-1.5">
                <input
                  aria-label="Angle in degrees"
                  type="number"
                  min={-180}
                  max={180}
                  step={0.5}
                  value={Number(angle.toFixed(1))}
                  onChange={(e) => setAngleSnap(Number(e.target.value) || 0)}
                  className="h-8 w-20 rounded-full border border-border bg-card/60 px-3 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <span className="text-sm text-muted">°</span>
              </span>
            </div>
            <input id="crop-angle" type="range" min={-180} max={180} step={0.5} value={angle} onChange={(e) => setAngleSnap(Number(e.target.value))} className="zk-range w-full" />
            <div className="relative mt-1 h-4 text-[10px] text-muted">
              {[-180, -90, 0, 90, 180].map((t) => (
                <span key={t} className="absolute -translate-x-1/2" style={{ left: `${((t + 180) / 360) * 100}%` }}>{t}°</span>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => turn(-90)} className={iconBtn} aria-label="Rotate 90° left" title="Rotate 90° left">
                <RotateCcw className="size-4" />
              </button>
              <button type="button" onClick={() => turn(90)} className={iconBtn} aria-label="Rotate 90° right" title="Rotate 90° right">
                <RotateCw className="size-4" />
              </button>
              <button type="button" onClick={() => setFlip((f) => !f)} aria-pressed={flip} className={cn(iconBtn, flip && 'border-accent bg-accent/15 text-accent')} aria-label="Flip horizontally" title="Flip horizontally">
                <FlipHorizontal2 className="size-4" />
              </button>
              <button type="button" onClick={() => setFlipV((f) => !f)} aria-pressed={flipV} className={cn(iconBtn, flipV && 'border-accent bg-accent/15 text-accent')} aria-label="Flip vertically" title="Flip vertically">
                <FlipVertical2 className="size-4" />
              </button>
              <button type="button" onClick={reset} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold text-muted transition hover:text-foreground active:scale-95">
                <Undo2 className="size-4" /> Reset
              </button>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        {busy && anim && (
          <div className="mt-3" aria-live="polite">
            <div className="mb-1 flex justify-between text-xs text-muted"><span>Processing animation…</span><span className="tabular-nums">{Math.round(progress * 100)}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} /></div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-full border border-border px-5 text-sm font-semibold transition hover:bg-card-2 active:scale-95">
            Cancel
          </button>
          <button type="button" onClick={busy || !img ? undefined : apply} disabled={busy || !img} className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-bold text-background transition hover:opacity-90 active:scale-95 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {busy ? 'Working' : 'Apply'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
