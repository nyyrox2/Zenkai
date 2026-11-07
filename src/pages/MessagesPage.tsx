import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  MessageSquare,
  Search,
  Send,
  UserX,
  X,
  Phone,
  PhoneCall,
  PhoneOff,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useVoiceCall } from '../context/VoiceCallContext'
import { Avatar } from '../components/Avatar'
import { Logo } from '../components/Logo'
import {
  fetchConversations,
  fetchMessagesWith,
  findUserByHandle,
  sendDirectMessage,
  markConversationAsRead,
  parseCallMessage,
  formatCallDuration,
  formatCallTimer,
  type ConversationSummary,
  type DirectMessage,
  type PartnerProfile,
} from '../lib/messages'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { requestMicrophoneStream } from '../lib/microphone'

function timeLabel(dateString: string) {
  const d = new Date(dateString)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function dateDividerLabel(dateString: string) {
  const d = new Date(dateString)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

export default function MessagesPage() {
  const { partnerHandle } = useParams<{ partnerHandle?: string }>()
  const navigate = useNavigate()
  const { user, signInWithGoogle } = useAuth()
  const { startCall, activeCall } = useVoiceCall()
  const [liveCallSeconds, setLiveCallSeconds] = useState(0)

  useEffect(() => {
    if (!activeCall || activeCall.status === 'ended' || activeCall.status === 'idle') {
      setLiveCallSeconds(0)
      return
    }

    setLiveCallSeconds(activeCall.getDuration())
    const interval = window.setInterval(() => {
      setLiveCallSeconds(activeCall.getDuration())
    }, 1000)

    return () => clearInterval(interval)
  }, [activeCall, activeCall?.status])

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Active chat state
  const [activePartner, setActivePartner] = useState<PartnerProfile | null>(null)
  const [partnerNotFound, setPartnerNotFound] = useState(false)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendTick, setSendTick] = useState(0)

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Stable React keys (temp -> real id) and ids already on screen, so only new bubbles animate.
  const keyOf = useRef(new Map<string, string>())
  const seen = useRef(new Set<string>())

  // Pure container-level scroll: NEVER triggers window.scroll or page jumping
  const scrollToBottom = (smooth = false) => {
    const el = messagesContainerRef.current
    if (!el) return
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      el.scrollTop = el.scrollHeight
    }
  }

  // Load conversations list
  const reloadConversations = async () => {
    if (!user?.id) return
    try {
      const convs = await fetchConversations(user.id)
      setConversations(convs)
    } finally {
      setLoadingConvs(false)
    }
  }

  useEffect(() => {
    document.title = 'Inbox & Messages — Zenkai'
    if (user?.id) {
      void reloadConversations()
    } else {
      setLoadingConvs(false)
    }
  }, [user?.id])

  // Resolve partner when URL changes
  useEffect(() => {
    if (!partnerHandle || !user?.id) {
      setActivePartner(null)
      setPartnerNotFound(false)
      setMessages([])
      return
    }

    let alive = true
    setLoadingMessages(true)
    setPartnerNotFound(false)

    findUserByHandle(partnerHandle).then(async (partner) => {
      if (!alive) return
      if (!partner) {
        setPartnerNotFound(true)
        setLoadingMessages(false)
        return
      }

      setActivePartner(partner)
      document.title = `Chat with ${partner.displayName} (@${partner.username}) — Zenkai`

      try {
        const msgs = await fetchMessagesWith(user.id, partner.id)
        if (alive) {
          keyOf.current.clear()
          seen.current = new Set(msgs.map((m) => m.id))
          setMessages(msgs)
          void markConversationAsRead(user.id, partner.id)
          setConversations((list) =>
            list.map((item) => (item.partnerId === partner.id ? { ...item, unreadCount: 0 } : item))
          )
          setTimeout(() => scrollToBottom(), 50)
        }
      } finally {
        if (alive) setLoadingMessages(false)
      }
    })

    return () => {
      alive = false
    }
  }, [partnerHandle, user?.id])

  // Realtime subscription for incoming direct messages
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`dm_messages_page:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'direct_messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as DirectMessage

            // If message belongs to current active conversation
            if (
              activePartner &&
              (newMsg.sender_id === activePartner.id || newMsg.receiver_id === activePartner.id)
            ) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev
                return [...prev, newMsg]
              })
              setTimeout(() => scrollToBottom(true), 40)
              if (user.id === newMsg.receiver_id) void markConversationAsRead(user.id, newMsg.sender_id)
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as DirectMessage
            if (
              activePartner &&
              (updatedMsg.sender_id === activePartner.id || updatedMsg.receiver_id === activePartner.id)
            ) {
              setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)))
            }
          }

          // Refresh conversation list preview
          void reloadConversations()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, activePartner?.id])

  // Auto-grow textarea
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text])

  const handleSend = async () => {
    if (!user?.id || !activePartner?.id) return
    const content = text.trim()
    if (!content || sending) return

    setSending(true)
    const tempId = `temp-${Date.now()}`
    const optimistic: DirectMessage = {
      id: tempId,
      sender_id: user.id,
      receiver_id: activePartner.id,
      content,
      read: false,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimistic])
    setSendTick((n) => n + 1)
    setText('')
    setTimeout(() => scrollToBottom(true), 30)

    try {
      const real = await sendDirectMessage(user.id, activePartner.id, content)
      if (real) {
        keyOf.current.set(real.id, tempId)
        setMessages((prev) =>
          prev.some((m) => m.id === real.id)
            ? prev.filter((m) => m.id !== tempId)
            : prev.map((m) => (m.id === tempId ? real : m)),
        )
        void reloadConversations()
      }
    } catch {
      toast('Failed to send message', 'error')
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setText(content)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  // Not logged in view
  if (!user) {
    return (
      <main className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-background h-[100dvh] w-full">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card/60 px-4 sm:px-6 shrink-0">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-foreground transition active:scale-95"
          >
            <ArrowLeft className="size-4" />
            <span>Back to Zenkai</span>
          </Link>
          <Logo size={32} textClassName="hidden sm:inline" />
        </header>
        <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
          <div className="rounded-3xl border border-border bg-card/70 p-8 text-center sm:p-14 shadow-2xl backdrop-blur-md max-w-lg w-full">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent/15 text-accent">
              <MessageSquare className="size-8" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold sm:text-3xl">Direct Messages & Inbox</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Sign in with your Google account to chat one-on-one with other otakus, share recommendations, and receive direct message notifications.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="inline-flex h-12 items-center gap-2.5 rounded-full bg-foreground px-6 text-sm font-bold text-background transition hover:opacity-90 active:scale-95 shadow-lg shadow-black/20"
              >
                <GoogleIcon className="size-5" />
                <span>Continue with Google</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.partnerDisplayName.toLowerCase().includes(q) ||
      c.partnerUsername.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q)
    )
  })

  return (
    <main className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-background h-[100dvh] w-full">
      <div className="relative flex-1 min-h-0 w-full overflow-hidden border-border bg-card/90 flex md:grid md:grid-cols-[22rem_minmax(0,1fr)]">
        {/* ================= LEFT PANE: Inbox & Conversations List ================= */}
        <aside
          className={cn(
            'flex flex-col border-r border-border bg-card-2/40 transition-all w-full md:w-auto',
            partnerHandle ? 'hidden md:flex' : 'flex'
          )}
        >
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-border shrink-0 bg-card/50">
            <div className="flex items-center gap-2.5">
              <Link
                to="/home"
                aria-label="Back to Zenkai home"
                className="grid size-9 place-items-center rounded-full border border-border bg-card/60 text-foreground transition hover:border-accent hover:text-accent active:scale-90 shrink-0"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <h1 className="font-display text-lg font-bold text-foreground">Messages</h1>
              {conversations.length > 0 && (
                <span className="rounded-full border border-border bg-card/60 px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {conversations.length}
                </span>
              )}
              <Logo size={34} showText={false} className="ml-auto" />
            </div>

            {/* Search Input */}
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats or @handle…"
                className="h-9 w-full rounded-xl border border-border bg-card pl-8 pr-8 text-xs font-medium outline-none transition focus-visible:border-accent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 overscroll-contain">
            {loadingConvs ? (
              <div className="p-8 text-center text-xs text-muted flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin text-accent" />
                <span>Loading your inbox…</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="mx-auto size-8 text-muted/40" />
                <p className="mt-3 text-xs font-semibold text-foreground">No conversations yet</p>
                <p className="mt-1 text-[11px] text-muted leading-relaxed">
                  Open any otaku’s public profile and tap <span className="text-accent font-semibold">Message</span> to start a direct chat!
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = activePartner?.username.toLowerCase() === c.partnerUsername.toLowerCase()
                return (
                  <button
                    key={c.partnerId}
                    type="button"
                    onClick={() => navigate(`/messages/${c.partnerUsername}`)}
                    className={cn(
                      'relative flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition active:scale-[0.98]',
                      isSelected
                        ? 'border border-accent/40 bg-accent/15 text-foreground shadow-sm'
                        : 'hover:bg-card-2/80 text-muted hover:text-foreground'
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        size={42}
                        name={c.partnerDisplayName}
                        src={c.partnerAvatar}
                        frame={c.partnerFrame}
                        animateFrame={false}
                      />
                      {c.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-fg shadow-sm animate-pulse">
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
                          {new Date(c.lastMessageAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="truncate text-xs text-muted/90">
                          {c.lastMessage}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="size-2 shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* ================= RIGHT PANE: Active Chat View ================= */}
        <section
          className={cn(
            'flex flex-col min-h-0 min-w-0 bg-card/40 w-full flex-1',
            !partnerHandle ? 'hidden md:flex' : 'flex'
          )}
        >
          {partnerNotFound ? (
            <div className="m-auto max-w-sm p-8 text-center">
              <UserX className="mx-auto size-12 text-muted/50" />
              <h2 className="mt-3 font-display text-lg font-bold">Otaku Not Found</h2>
              <p className="mt-1 text-xs text-muted">
                We couldn’t find an account matching @{partnerHandle}.
              </p>
              <button
                type="button"
                onClick={() => navigate('/messages')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:border-accent hover:text-accent transition active:scale-95"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Messages</span>
              </button>
            </div>
          ) : !activePartner ? (
            <div className="m-auto max-w-sm p-8 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-card-2 text-muted">
                <MessageSquare className="size-8" />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold">Select a Conversation</h2>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Choose an existing chat from the inbox, or visit any public profile and tap <span className="text-accent font-semibold">Message</span> to chat directly.
              </p>
            </div>
          ) : (
            <>
              {/* Partner Chat Header */}
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/70 px-3 py-2.5 backdrop-blur-xl sm:px-6 sm:py-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate('/messages')}
                    aria-label="Back to conversations"
                    className="md:hidden grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card/60 text-foreground hover:border-accent hover:text-accent active:scale-90 transition"
                  >
                    <ArrowLeft className="size-4" />
                  </button>

                  <Link
                    to={`/u/${activePartner.username}`}
                    title={`View @${activePartner.username}'s profile`}
                    className="group flex items-center gap-2.5 sm:gap-3 min-w-0 hover:opacity-85 transition"
                  >
                    <Avatar
                      size={38}
                      name={activePartner.displayName}
                      src={activePartner.avatarUrl}
                      frame={activePartner.frame}
                      animateFrame
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <h2 className="truncate font-display text-xs sm:text-sm font-bold group-hover:text-accent transition-colors">
                          {activePartner.displayName}
                        </h2>
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                          @{activePartner.username}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-muted flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        <span>Direct Message</span>
                      </p>
                    </div>
                  </Link>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!activePartner) return
                      let stream: MediaStream | undefined
                      try {
                        stream = await requestMicrophoneStream()
                      } catch (err: any) {
                        const msg = err?.message || ''
                        if (msg.includes('HTTPS')) {
                          toast(msg, 'error')
                          return
                        }
                      }
                      await startCall({
                        id: activePartner.id,
                        username: activePartner.username,
                        displayName: activePartner.displayName,
                        avatar: activePartner.avatarUrl,
                      }, stream)
                      navigate('/call')
                    }}
                    title={`Voice call @${activePartner.username}`}
                    aria-label="Voice call" className="grid size-9 place-items-center rounded-full border border-border bg-card/60 text-foreground transition hover:border-accent hover:text-accent active:scale-90"
                  >
                    <Phone className="size-4" />
                  </button>
                </div>
              </header>

              {/* Messages Stream: scroll is isolated to this container */}
              <div
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3 overscroll-contain"
              >
                {loadingMessages ? (
                  <div className="p-8 text-center text-xs text-muted flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin text-accent" />
                    <span>Loading conversation…</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="mx-auto my-10 max-w-xs text-center">
                    <Avatar
                      size={58}
                      name={activePartner.displayName}
                      src={activePartner.avatarUrl}
                      frame={activePartner.frame}
                      animateFrame
                      className="mx-auto"
                    />
                    <h3 className="mt-3 font-display text-sm font-bold">
                      Start of chat with {activePartner.displayName}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Say hi, talk about anime, or recommend favorite series!
                    </p>
                  </div>
                ) : (() => {
                  let lastCallIndex = -1
                  for (let i = messages.length - 1; i >= 0; i--) {
                    if (parseCallMessage(messages[i].content).isCall) {
                      lastCallIndex = i
                      break
                    }
                  }
                  return messages.map((m, idx) => {
                    const isMe = m.sender_id === user.id
                    const isTemp = m.id.startsWith('temp-')
                    const prev = messages[idx - 1]
                    const cm = parseCallMessage(m.content)
                    if (
                      cm.isCall &&
                      cm.status === 'started' &&
                      messages.slice(idx + 1).some((n) => {
                        const nextCm = parseCallMessage(n.content)
                        return nextCm.isCall && nextCm.status !== 'started'
                      })
                    )
                      return null
                    const showDay =
                      !prev ||
                      new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()

                    return (
                      <div key={keyOf.current.get(m.id) ?? m.id} className="space-y-3">
                        {showDay && (
                          <div className="my-3 flex items-center gap-3 text-[11px] font-medium text-muted">
                            <span className="h-px flex-1 bg-border/60" />
                            {dateDividerLabel(m.created_at)}
                            <span className="h-px flex-1 bg-border/60" />
                          </div>
                        )}

                        {(() => {
                          const callData = parseCallMessage(m.content)
                          if (callData.isCall) {
                            const isStarted = callData.status === 'started'
                            const isEnded = callData.status === 'ended'
                            const isDeclined = callData.status === 'declined'
                            const isMissed = callData.status === 'missed'

                            const isPartnerCall = Boolean(
                              activeCall &&
                              activeCall.status !== 'ended' &&
                              activePartner &&
                              activeCall.partner.id === activePartner.id
                            )

                            // ONLY the single latest call message can ever be the currently active call
                            const isThisMessageTheActiveCall = Boolean(
                              isPartnerCall &&
                              idx === lastCallIndex &&
                              (Date.now() - new Date(m.created_at).getTime() < 12 * 3600_000)
                            )

                            let cardTitle = 'Audio Call'
                            let cardSubtitle = `${timeLabel(m.created_at)}`
                            let isPositive = false

                            if (isEnded) {
                              isPositive = true
                              cardTitle = 'Audio Call'
                              cardSubtitle = callData.duration && callData.duration > 0
                                ? `Ended • ${formatCallDuration(callData.duration)}`
                                : `Call ended · ${timeLabel(m.created_at)}`
                            } else if (isDeclined) {
                              isPositive = false
                              cardTitle = isMe ? 'Call Declined' : 'Declined Audio Call'
                              cardSubtitle = `Declined · ${timeLabel(m.created_at)}`
                            } else if (isMissed) {
                              isPositive = false
                              cardTitle = isMe ? 'Unanswered Call' : 'Missed Audio Call'
                              cardSubtitle = `No answer · ${timeLabel(m.created_at)}`
                            } else if (isStarted) {
                              if (isThisMessageTheActiveCall && activeCall) {
                                isPositive = true
                                cardTitle = isMe ? 'Outgoing Audio Call' : 'Incoming Audio Call'
                                if (activeCall.status === 'calling') {
                                  cardSubtitle = 'Ringing…'
                                } else if (activeCall.status === 'connecting') {
                                  cardSubtitle = 'Connecting…'
                                } else if (activeCall.status === 'hold') {
                                  cardSubtitle = `On hold • ${formatCallTimer(liveCallSeconds)}`
                                } else {
                                  cardSubtitle = `In progress • ${formatCallTimer(liveCallSeconds)}`
                                }
                              } else {
                                // All older / past calls default cleanly to No Answer
                                isPositive = false
                                cardTitle = isMe ? 'Unanswered Call' : 'Missed Audio Call'
                                cardSubtitle = `No answer · ${timeLabel(m.created_at)}`
                              }
                            }

                            return (
                              <div className="my-2 flex w-full justify-center">
                                <div
                                  className={cn(
                                    'inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-xs font-medium backdrop-blur-md transition shadow-sm',
                                    isThisMessageTheActiveCall
                                      ? 'border-emerald-500/40 bg-zinc-950/80 text-emerald-400'
                                      : isPositive
                                      ? 'border-zinc-800/80 bg-zinc-900/60 text-zinc-300'
                                      : 'border-zinc-800/80 bg-zinc-900/60 text-zinc-400'
                                  )}
                                >
                                  {isThisMessageTheActiveCall ? (
                                    <span className="relative flex size-2 shrink-0">
                                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                                    </span>
                                  ) : isPositive ? (
                                    <PhoneCall className="size-3.5 text-zinc-400 shrink-0" />
                                  ) : (
                                    <PhoneOff className="size-3.5 text-zinc-500 shrink-0" />
                                  )}

                                  <span className="font-semibold text-zinc-200">{cardTitle}</span>
                                  <span className="text-zinc-600">•</span>
                                  <span className="text-[11px] text-zinc-400">{cardSubtitle}</span>

                                  {isThisMessageTheActiveCall ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate('/call')}
                                      className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 active:scale-95 transition"
                                    >
                                      <span>Open call</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!activePartner) return
                                        let stream: MediaStream | undefined
                                        try {
                                          stream = await requestMicrophoneStream()
                                        } catch (err: any) {
                                          const msg = err?.message || ''
                                          if (msg.includes('HTTPS')) {
                                            toast(msg, 'error')
                                            return
                                          }
                                        }
                                        await startCall({
                                          id: activePartner.id,
                                          username: activePartner.username,
                                          displayName: activePartner.displayName,
                                          avatar: activePartner.avatarUrl,
                                        }, stream)
                                        navigate('/call')
                                      }}
                                      className="ml-1 text-[11px] font-bold text-zinc-400 hover:text-white underline-offset-2 hover:underline transition"
                                    >
                                      Call back
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          }

                          return (
                            <motion.div
                              initial={seen.current.has(m.id) || keyOf.current.has(m.id) ? false : { opacity: 0, y: 14, scale: 0.92 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ type: 'spring', stiffness: 520, damping: 32 }}
                              style={{ transformOrigin: isMe ? 'bottom right' : 'bottom left' }}
                              className={cn(
                                'flex w-full',
                                isMe ? 'justify-end' : 'justify-start'
                              )}
                            >
                              <div
                                className={cn(
                                  'relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed shadow-sm',
                                  isMe
                                    ? 'bg-accent text-accent-fg rounded-br-sm shadow-accent/15'
                                    : 'border border-border bg-card-2 text-foreground rounded-bl-sm'
                                )}
                              >
                                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                <div
                                  className={cn(
                                    'mt-1 flex items-center justify-end gap-1 text-[9px] sm:text-[10px]',
                                    isMe ? 'text-accent-fg/80' : 'text-muted'
                                  )}
                                >
                                  <span>{timeLabel(m.created_at)}</span>
                                  {isMe && (
                                    isTemp ? (
                                      <Loader2 className="size-2.5 animate-spin" />
                                    ) : m.read ? (
                                      <CheckCheck className="size-3 text-emerald-300" />
                                    ) : (
                                      <Check className="size-3" />
                                    )
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )
                        })()}
                      </div>
                    )
                  })
                })()}
              </div>

              {/* Message Composer (pinned bottom, safe area on mobile) */}
              <div
                className="shrink-0 border-t border-border bg-card-2/60 p-2.5 sm:px-5 sm:py-3"
                style={{ paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))' }}
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleSend()
                  }}
                  className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 focus-within:border-accent transition"
                >
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message @${activePartner.username}…`}
                    className="max-h-24 flex-1 resize-none bg-transparent px-3 py-1.5 text-xs sm:text-sm text-foreground outline-none placeholder:text-muted"
                  />

                  <motion.button
                    type="submit"
                    disabled={!text.trim() || sending}
                    aria-label="Send message"
                    whileTap={{ scale: 0.85 }}
                    animate={{ scale: text.trim() ? 1 : 0.9, opacity: text.trim() ? 1 : 0.4 }}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-fg disabled:pointer-events-none"
                  >
                    <motion.span key={sendTick} initial={sendTick ? { x: -6, y: 6, opacity: 0 } : false} animate={{ x: 0, y: 0, opacity: 1 }} className="grid place-items-center">
                      <Send className="size-4" />
                    </motion.span>
                  </motion.button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
