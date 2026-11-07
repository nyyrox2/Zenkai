import { frameById, frameUrl } from '../lib/frames'
import { cn } from '../lib/utils'

/**
 * Round avatar with an optional animated frame.
 * The frame is an APNG rendered in a dedicated overlay container without CSS transforms on the <img>,
 * allowing modern browsers (Chrome/Firefox/Safari) to decode and animate APNG frames at full framerate.
 */
export function Avatar({
  size,
  src,
  frame,
  name,
  className,
}: {
  size: number
  src?: string | null
  frame?: string | null
  name?: string
  className?: string
  animateFrame?: boolean
}) {
  const f = frameById(frame)

  return (
    <span
      className={cn('relative inline-block shrink-0 align-middle', className)}
      style={{ width: size, height: size }}
    >
      {/* Base Avatar Circle */}
      <span
        className="grid size-full place-items-center overflow-hidden rounded-full bg-card-2 font-display font-bold text-muted ring-1 ring-border"
        style={{ fontSize: size * 0.42 }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            referrerPolicy="no-referrer"
            draggable={false}
            className="size-full object-cover"
          />
        ) : (
          (name?.trim()[0] ?? '?').toUpperCase()
        )}
      </span>

      {/* Animated APNG Avatar Decoration / Frame */}
      {f && (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ width: size * 1.28, height: size * 1.28 }}
        >
          <img
            key={f.id}
            src={frameUrl(f)}
            alt=""
            aria-hidden
            draggable={false}
            decoding="sync"
            className="size-full object-contain pointer-events-none"
          />
        </span>
      )}
    </span>
  )
}
