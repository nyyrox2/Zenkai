import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Pencil, Reply, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'

/** Open-source Fluent Emoji (MIT, Microsoft), bundled in /public/emoji. Stored in the DB as the unicode char. */
export const REACTIONS = [
  { e: '💀', f: 'skull' }, { e: '🗿', f: 'moai' }, { e: '🫠', f: 'melt' }, { e: '🤯', f: 'mind' },
  { e: '🥹', f: 'tears' }, { e: '🫡', f: 'salute' }, { e: '🍿', f: 'popcorn' }, { e: '👀', f: 'eyes' },
  { e: '🔥', f: 'fire' }, { e: '🫶', f: 'hearthands' }, { e: '😭', f: 'cry' }, { e: '🤣', f: 'lmao' },
] as const

export function Emoji({ e, size = 18 }: { e: string; size?: number }) {
  const [bad, setBad] = useState(false)
  const f = REACTIONS.find((r) => r.e === e)?.f
  if (!f || bad) return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{e}</span>
  return <img src={`${import.meta.env.BASE_URL}emoji/${f}.png`} alt={e} width={size} height={size} draggable={false} onError={() => setBad(true)} className="shrink-0 select-none" />
}

/** Long-press (touch) or right-click (mouse) props. Scrolling cancels the hold. Callback must be idempotent. */
let holdTimer = 0
let holdAt = { x: 0, y: 0 }
export const holdProps = (cb: () => void) => ({
  onPointerDown: (e: RPointerEvent) => {
    if (e.pointerType === 'mouse') return
    holdAt = { x: e.clientX, y: e.clientY }
    window.clearTimeout(holdTimer)
    holdTimer = window.setTimeout(() => { navigator.vibrate?.(8); cb() }, 380)
  },
  onPointerMove: (e: RPointerEvent) => { if (Math.hypot(e.clientX - holdAt.x, e.clientY - holdAt.y) > 10) window.clearTimeout(holdTimer) },
  onPointerUp: () => window.clearTimeout(holdTimer),
  onPointerCancel: () => window.clearTimeout(holdTimer),
  onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); cb() },
})

type Props = {
  open: boolean
  preview: string
  mine: boolean
  mineReacts: string[]
  onClose: () => void
  onReact: (emoji: string) => void
  onReply: () => void
  onCopy: () => void
  onEdit: () => void
  onUnsend: () => void
}

export function MsgMenu({ open, preview, mine, mineReacts, onClose, onReact, onReply, onCopy, onEdit, onUnsend }: Props) {
  const t0 = useRef(0)
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!open) return
    t0.current = Date.now()
    setArmed(false)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null

  const row = 'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition active:bg-foreground/10 hover:bg-foreground/5'
  const go = (fn: () => void) => () => { onClose(); fn() }

  return createPortal(
    // the first 350ms ignore taps: the finger lifting from the long-press must not close the menu
    <div role="dialog" aria-modal="true" aria-label="Message options" onClick={() => Date.now() - t0.current > 350 && onClose()} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-3xl border border-border bg-card p-2 shadow-2xl">
        {preview && <p className="truncate px-3 pb-1.5 pt-1 text-xs text-muted">{preview}</p>}
        <div className="grid grid-cols-6 gap-0.5 px-1 pb-1.5">
          {REACTIONS.map((r) => (
            <button key={r.e} type="button" aria-label={`React ${r.e}`} aria-pressed={mineReacts.includes(r.e)} onClick={go(() => onReact(r.e))} className={cn('grid aspect-square place-items-center rounded-xl transition active:scale-90', mineReacts.includes(r.e) ? 'bg-accent/15 ring-1 ring-accent/50' : 'hover:bg-foreground/5')}>
              <Emoji e={r.e} size={26} />
            </button>
          ))}
        </div>
        <div className="border-t border-border pt-1">
          <button type="button" onClick={go(onReply)} className={row}><Reply className="size-4 text-muted" />Reply</button>
          <button type="button" onClick={go(onCopy)} className={row}><Copy className="size-4 text-muted" />Copy</button>
          {mine && <button type="button" onClick={go(onEdit)} className={row}><Pencil className="size-4 text-muted" />Edit</button>}
          {mine && (
            <button type="button" onClick={() => (armed ? (onClose(), onUnsend()) : setArmed(true))} className={cn(row, 'text-red-400', armed && 'bg-red-500/10')}>
              <Trash2 className="size-4" />{armed ? 'Tap again to unsend' : 'Unsend'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
