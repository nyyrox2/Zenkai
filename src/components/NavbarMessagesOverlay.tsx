import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageSquare, ArrowRight, CheckCheck, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './Avatar'
import {
  fetchConversations,
  getUnreadDmCount,
  markConversationAsRead,
  markAllMessagesAsRead,
  type ConversationSummary,
} from '../lib/messages'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'

function timeAgo(dateString: string) {
  const d = new Date(dateString)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function NavbarMessagesOverlay() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    if (!user?.id) return
    try {
      const [count, convs] = await Promise.all([
        getUnreadDmCount(user.id),
        fetchConversations(user.id),
      ])
      setUnreadCount(count)
      setConversations(convs.slice(0, 6))
    } catch {
      // ignore
    }
  }

  // Load and subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0)
      setConversations([])
      return
    }

    void loadData()

    // Realtime listener for incoming messages & status updates
    const channel = supabase
      .channel(`inbox_overlay_realtime:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'direct_messages' },
        () => {
          void loadData()
        }
      )
      .subscribe()

    // Listen to local read events for instantaneous badge clearing
    const handleLocalRead = () => {
      void loadData()
    }
    window.addEventListener('zk:dm_read', handleLocalRead)

    // Periodic check as fallback
    const interval = window.setInterval(() => {
      if (!document.hidden) void loadData()
    }, 12000)

    return () => {
      void supabase.removeChannel(channel)
      window.removeEventListener('zk:dm_read', handleLocalRead)
      window.clearInterval(interval)
    }
  }, [user?.id])

  // Click outside & Escape key listeners
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!user) return null

  const handleToggle = () => {
    if (!open) {
      setLoading(true)
      void loadData().finally(() => setLoading(false))
    }
    setOpen((prev) => !prev)
  }

  const handleOpenChat = async (partnerUsername: string, partnerId: string, currentUnread: number) => {
    // Immediately clear local unread count
    if (currentUnread > 0) {
      setUnreadCount((c) => Math.max(0, c - currentUnread))
      setConversations((list) =>
        list.map((item) =>
          item.partnerId === partnerId ? { ...item, unreadCount: 0 } : item
        )
      )
      void markConversationAsRead(user.id, partnerId)
    }
    setOpen(false)
    navigate(`/messages/${partnerUsername}`)
  }

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (unreadCount === 0) return
    setUnreadCount(0)
    setConversations((list) => list.map((item) => ({ ...item, unreadCount: 0 })))
    toast('Marked all messages as read', 'success')
    await markAllMessagesAsRead(user.id)
  }

  return (
    <div ref={popoverRef} className="relative shrink-0">
      {/* Trigger Button in Navbar */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Direct Messages Inbox"
        title="Messages"
        className="relative grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card/60 transition hover:border-accent hover:text-accent active:scale-90"
      >
        <MessageSquare className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-fg shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Responsive Overlay Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            /* Mobile: fixed inset-x-3 top-16 (12px margins, perfectly centered, never clipped). Desktop: absolute right-0 top-11 */
            className="fixed inset-x-3 top-16 z-[100] max-h-[82vh] overflow-hidden rounded-3xl border border-border bg-card/95 p-3 shadow-2xl shadow-black/70 backdrop-blur-2xl flex flex-col sm:absolute sm:inset-auto sm:right-0 sm:top-11 sm:w-96 sm:max-h-[32rem]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-foreground">Inbox & Chats</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    title="Mark all as read"
                    className="text-[11px] font-semibold text-muted hover:text-accent transition flex items-center gap-1 active:scale-95"
                  >
                    <CheckCheck className="size-3 text-accent" />
                    <span>Read all</span>
                  </button>
                )}
                <Link
                  to="/messages"
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-0.5"
                >
                  <span>View all</span>
                  <ArrowRight className="size-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="grid size-6 place-items-center rounded-full text-muted hover:text-foreground sm:hidden"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-1 space-y-1.5 overscroll-contain">
              {loading && conversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted">Loading conversations…</div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-card-2 text-muted">
                    <MessageSquare className="size-6" />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-foreground">No messages yet</p>
                  <p className="mt-1 text-[11px] text-muted leading-relaxed">
                    Visit any user’s public profile and tap <span className="text-accent font-semibold">Message</span> to chat directly!
                  </p>
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.partnerId}
                    type="button"
                    onClick={() => handleOpenChat(c.partnerUsername, c.partnerId, c.unreadCount)}
                    className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-card-2/80 active:scale-[0.98]"
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        size={40}
                        name={c.partnerDisplayName}
                        src={c.partnerAvatar}
                        frame={c.partnerFrame}
                        animateFrame={false}
                      />
                      {c.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-accent-fg shadow-sm animate-pulse">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-bold text-foreground">
                          {c.partnerDisplayName}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted">
                          {timeAgo(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="truncate text-xs text-muted">
                          {c.lastMessage}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="size-2 shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer: Open full inbox */}
            <div className="pt-2 border-t border-border/60 shrink-0">
              <Link
                to="/messages"
                onClick={() => setOpen(false)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-card-2 border border-border text-xs font-bold text-foreground transition hover:border-accent hover:text-accent active:scale-[0.98]"
              >
                <span>Open Full Inbox</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
