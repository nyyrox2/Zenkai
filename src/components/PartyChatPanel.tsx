import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, MessageSquare, Send, X } from 'lucide-react'
import { Avatar } from './Avatar'
import { cn } from '../lib/utils'
import type { WatchChatMessage } from '../lib/webrtcWatchTogether'

const EMOJIS = ['🔥', '😱', '❤️', '😂', '👏', '⚡', '🍿', '⚔️']
const MAX = 300
const GROUP_MS = 2 * 60e3
const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/**
 * Watch Together chat. Fills its parent (the page gives it ~24% beside the player, a bottom sheet on phones,
 * and the player overlays it in fullscreen). `glass` = dark translucent skin for use over the video.
 */
export function PartyChatPanel({
  messages,
  selfId,
  online,
  onSend,
  onReact,
  onClose,
  glass = false,
  bare = false,
  className,
}: {
  messages: WatchChatMessage[]
  selfId: string
  online: number
  onSend: (text: string) => void
  onReact: (emoji: string) => void
  onClose: () => void
  glass?: boolean
  /** inside the Watch Together panel: no own header or frame */
  bare?: boolean
  className?: string
}) {
  const [text, setText] = useState('')
  const [away, setAway] = useState(false) // scrolled up: do not yank the view when a message arrives
  const [missed, setMissed] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const last = useRef(0)

  const toBottom = (smooth = false) => {
    const el = list.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    setAway(false)
    setMissed(0)
  }

  useLayoutEffect(() => toBottom(), []) // opening lands on the latest message

  useEffect(() => {
    const fresh = messages.length - last.current
    last.current = messages.length
    if (fresh <= 0) return
    const mine = messages[messages.length - 1]?.senderId === selfId
    if (!away || mine) toBottom(true)
    else setMissed((m) => m + fresh)
  }, [messages, away, selfId])

  // consecutive messages from one person inside two minutes share a header
  const rows = useMemo(
    () => messages.map((m, i) => ({ m, head: !messages[i - 1] || messages[i - 1].senderId !== m.senderId || m.timestamp - messages[i - 1].timestamp > GROUP_MS })),
    [messages],
  )

  const send = () => {
    const t = text.trim().slice(0, MAX)
    if (!t) return
    onSend(t)
    setText('')
  }

  const line = glass ? 'border-white/10' : 'border-border'
  return (
    <section
      aria-label="Room chat"
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden border',
        bare ? 'border-0 bg-transparent text-white' : glass ? 'rounded-2xl border-white/10 bg-black/70 text-white backdrop-blur-xl' : 'rounded-2xl border-border bg-card text-foreground shadow-xl lg:rounded-3xl',
        className,
      )}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {!bare && <header className={cn('flex shrink-0 items-center gap-2 border-b px-3 py-2.5', line)}>
        <MessageSquare className="size-4 text-accent" />
        <h2 className="text-xs font-bold tracking-tight">Room Chat</h2>
        <span className={cn('flex items-center gap-1 text-[10px] font-semibold', glass ? 'text-white/60' : 'text-muted')}>
          <span className="size-1.5 rounded-full bg-emerald-400" />
          {online} watching
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className={cn('ml-auto grid size-7 place-items-center rounded-lg transition active:scale-90', glass ? 'text-white/70 hover:bg-white/10' : 'text-muted hover:bg-card-2 hover:text-foreground')}
        >
          <X className="size-4" />
        </button>
      </header>}

      <div className="relative min-h-0 flex-1">
        <div
          ref={list}
          role="log"
          aria-live="polite"
          onScroll={(e) => {
            const el = e.currentTarget
            const far = el.scrollHeight - el.scrollTop - el.clientHeight > 80
            setAway(far)
            if (!far) setMissed(0)
          }}
          className="h-full space-y-0.5 overflow-y-auto overscroll-contain px-2.5 py-2"
        >
          {rows.length === 0 ? (
            <div className="grid h-full place-items-center p-4 text-center">
              <div>
                <div className={cn('mx-auto grid size-10 place-items-center rounded-2xl', glass ? 'bg-white/10' : 'bg-card-2')}>
                  <MessageSquare className="size-5 text-accent" />
                </div>
                <p className="mt-2 text-xs font-bold">No messages yet</p>
                <p className={cn('mt-0.5 text-[11px] leading-relaxed', glass ? 'text-white/60' : 'text-muted')}>Say hi or send a reaction. Everyone in the room sees it live.</p>
              </div>
            </div>
          ) : (
            rows.map(({ m, head }) => {
              const own = m.senderId === selfId
              return (
                <div key={m.id} className={cn('flex gap-2', head && 'pt-2', own && 'flex-row-reverse')}>
                  <div className="w-7 shrink-0">{head && !own && <Avatar size={28} name={m.senderName} src={m.avatar} />}</div>
                  <div className={cn('flex min-w-0 max-w-[85%] flex-col', own && 'items-end')}>
                    {head && (
                      <div className={cn('mb-0.5 flex items-baseline gap-1.5 px-1', own && 'flex-row-reverse')}>
                        <span className={cn('truncate text-[11px] font-bold', glass ? 'text-white/80' : 'text-muted')}>{own ? 'You' : m.senderName}</span>
                        <span className={cn('shrink-0 text-[9px]', glass ? 'text-white/40' : 'text-muted/70')}>{time(m.timestamp)}</span>
                      </div>
                    )}
                    <p
                      className={cn(
                        'w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-xs leading-snug',
                        own ? (glass ? 'bg-white text-black' : 'bg-accent text-accent-fg') : glass ? 'bg-white/10' : 'border border-border/60 bg-card-2',
                      )}
                    >
                      {m.text}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {away && (
          <button
            type="button"
            onClick={() => toBottom(true)}
            className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold text-accent-fg shadow-lg transition active:scale-95"
          >
            <ArrowDown className="size-3" />
            {missed > 0 ? `${missed} new` : 'Latest'}
          </button>
        )}
      </div>

      <footer className={cn('shrink-0 space-y-2 border-t p-2.5', line)}>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onReact(e)}
              aria-label={`React ${e}`}
              className={cn('grid size-7 shrink-0 place-items-center rounded-lg text-sm transition active:scale-125', glass ? 'bg-white/10 hover:bg-white/20' : 'bg-card-2 hover:bg-accent/20')}
            >
              {e}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex gap-1.5"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX}
            placeholder="Message the room"
            aria-label="Message"
            autoComplete="off"
            className={cn(
              'h-9 min-w-0 flex-1 rounded-xl border px-3 text-xs outline-none transition focus-visible:border-accent',
              glass ? 'border-white/15 bg-white/10 text-white placeholder:text-white/40' : 'border-border bg-card-2 text-foreground placeholder:text-muted',
            )}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send"
            className={cn('grid size-9 shrink-0 place-items-center rounded-xl transition hover:brightness-110 active:scale-95 disabled:opacity-40', glass ? 'bg-white text-black' : 'bg-accent text-accent-fg')}
          >
            <Send className="size-4" />
          </button>
        </form>
      </footer>
    </section>
  )
}
