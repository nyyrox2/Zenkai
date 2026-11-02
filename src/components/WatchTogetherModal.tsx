import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Copy,
  Check,
  Crown,
  Lock,
  Unlock,
  MonitorPlay,
  Plus,
  Send,
  X,
  LogOut,
  RotateCw,
  Film,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Avatar } from './Avatar'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { requestMicrophoneStream } from '../lib/microphone'
import type {
  WatchTogetherRoom,
  PeerMember,
  WatchChatMessage,
} from '../lib/webrtcWatchTogether'

const EMOJI_REACTIONS = ['🔥', '😱', '❤️', '😂', '👏', '⚡', '🍿', '⚔️']

export function WatchTogetherModal({
  open,
  onClose,
  room,
  peers,
  chatMessages,
  onSendChat,
  onSendReaction,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onForceSync,
  animeTitle,
  episode,
  isHost,
  onChangeShowClick,
}: {
  open: boolean
  onClose: () => void
  room: WatchTogetherRoom | null
  peers: PeerMember[]
  chatMessages: WatchChatMessage[]
  onSendChat: (text: string) => void
  onSendReaction: (emoji: string) => void
  onCreateRoom: () => void
  onJoinRoom: (code: string) => void
  onLeaveRoom: () => void
  onForceSync: () => void
  animeTitle: string
  episode: number
  isHost: boolean
  connectionStatus: 'connecting' | 'connected' | 'p2p' | 'disconnected'
  onChangeShowClick?: () => void
}) {
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [chatText, setChatText] = useState('')
  const [activeTab, setActiveTab] = useState<'chat' | 'peers'>('chat')
  const [isMicActive, setIsMicActive] = useState(room?.getIsMicActive() || false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!room) return
    setIsMicActive(room.getIsMicActive())
    room.onLocalMicChange((active) => setIsMicActive(active))
  }, [room])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleCopyLink = async () => {
    if (!room) return
    const url = `${window.location.origin}${window.location.pathname}?ep=${episode}&room=${room.roomId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast('Copied Watch Party invite link!')
      setTimeout(() => setCopied(false), 2200)
    } catch {
      toast('Failed to copy link', 'error')
    }
  }

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatText.trim()) return
    onSendChat(chatText)
    setChatText('')
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          className="relative flex h-[85vh] max-h-[640px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-2xl shadow-black/60"
          role="dialog"
          aria-modal="true"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted transition hover:bg-card-2 hover:text-foreground active:scale-90"
          >
            <X className="size-4" />
          </button>

          {!room ? (
            /* ================= VIEW 1: NOT IN ROOM ================= */
            <div className="flex flex-1 flex-col justify-between py-2">
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl border border-border bg-card-2 text-foreground">
                    <Users className="size-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold">Watch Together</h2>
                    <p className="text-xs text-muted">Watch in sync with friends</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-border bg-card-2/60 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Currently Playing
                  </span>
                  <h3 className="mt-1 font-display text-sm font-bold text-foreground truncate">
                    {animeTitle}
                  </h3>
                  <p className="text-xs text-muted">Episode {episode}</p>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Play, pause and seek stay in sync for everyone in the room.
                </p>
              </div>

              <div className="space-y-4 pt-4">
                {/* Create party button */}
                <button
                  type="button"
                  onClick={onCreateRoom}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground font-display text-sm font-bold text-background transition hover:opacity-90 active:scale-95"
                >
                  <Plus className="size-4" />
                  <span>Start New Watch Party</span>
                </button>

                {/* Join party section */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                    <span className="bg-card px-3 text-muted">Or join with code</span>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (joinCode.trim()) onJoinRoom(joinCode.trim())
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="Enter code (e.g. zk-xxxxxx)"
                    className="h-11 flex-1 rounded-xl border border-border bg-card-2 px-3.5 text-xs font-bold text-foreground outline-none transition focus-visible:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={joinCode.trim().length < 3}
                    className="h-11 rounded-xl bg-card-2 border border-border px-5 text-xs font-bold text-foreground transition hover:border-accent hover:text-accent disabled:opacity-40 active:scale-95"
                  >
                    Join
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* ================= VIEW 2: ACTIVE ROOM ================= */
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
              {/* Header */}
              <div className="border-b border-border pb-3 shrink-0">
                <div className="flex items-center justify-between pr-9">
                  <div className="flex items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-xl border border-border bg-card-2 text-foreground">
                      <MonitorPlay className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display whitespace-nowrap text-sm font-bold">Room {room.roomId}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold text-muted">
                          <span className="size-1.5 rounded-full bg-emerald-400" />
                          Synced
                        </span>
                      </div>
                      <p className="text-[11px] text-muted truncate max-w-[220px]">
                        {animeTitle} · Ep {episode}
                      </p>
                    </div>
                  </div>
                </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {/* Voice Chat Mic Toggle */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!room) return
                        let preacquired: MediaStream | undefined
                        if (!isMicActive) {
                          try {
                            preacquired = await requestMicrophoneStream()
                          } catch (err: any) {
                            const msg = err?.message || ''
                            if (msg.includes('HTTPS')) {
                              toast(msg, 'error')
                              return
                            }
                            const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
                            toast(
                              isDenied
                                ? 'Microphone permission denied. Allow microphone in browser settings to speak.'
                                : 'Could not access microphone',
                              'error'
                            )
                            return
                          }
                        }
                        try {
                          const active = await room.toggleMic(preacquired)
                          setIsMicActive(active)
                          toast(active ? 'Microphone unmuted - voice active' : 'Microphone muted', active ? 'success' : 'info')
                        } catch {
                          setIsMicActive(false)
                        }
                      }}
                      title={isMicActive ? 'Mute Microphone' : 'Enable Microphone'}
                      className={cn(
                        'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition active:scale-95',
                        isMicActive
                          ? 'bg-foreground text-background'
                          : 'border border-border bg-card-2 text-muted hover:text-foreground hover:border-accent'
                      )}
                    >
                      {isMicActive ? (
                        <Mic className="size-3.5" />
                      ) : (
                        <MicOff className="size-3.5" />
                      )}
                      <span>{isMicActive ? 'Mic On' : 'Mic'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      title="Copy invite link"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card-2 px-3 text-xs font-semibold text-foreground transition hover:border-accent active:scale-95"
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span>{copied ? 'Copied' : 'Invite'}</span>
                    </button>
                  </div>

                {/* Sub-tabs */}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 rounded-xl py-1 text-xs font-bold transition ${
                      activeTab === 'chat'
                        ? 'bg-foreground text-background'
                        : 'bg-card-2 text-muted hover:text-foreground'
                    }`}
                  >
                    Live Chat & Reactions
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('peers')}
                    className={`flex-1 rounded-xl py-1 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      activeTab === 'peers'
                        ? 'bg-foreground text-background'
                        : 'bg-card-2 text-muted hover:text-foreground'
                    }`}
                  >
                    <span>Members</span>
                    <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px]">
                      {peers.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Live Chat & Reactions */}
              {activeTab === 'chat' && (
                <div className="flex flex-1 flex-col overflow-hidden min-h-0 pt-2">
                  {/* Chat messages */}
                  <div className="flex-1 overflow-y-auto space-y-2 p-1 text-xs overscroll-contain">
                    {chatMessages.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted">
                        No messages yet. Send a message or react with emojis!
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg.id} className="flex items-start gap-2">
                          <Avatar size={24} name={msg.senderName} src={msg.avatar} />
                          <div className="min-w-0 flex-1 rounded-2xl bg-card-2/80 px-3 py-1.5 border border-border/50">
                            <span className="font-bold text-[11px] text-muted">
                              {msg.senderName}
                            </span>
                            <p className="text-foreground break-words">{msg.text}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Reaction bar */}
                  <div className="flex items-center gap-1 overflow-x-auto py-1.5 border-t border-border/40 shrink-0">
                    {EMOJI_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onSendReaction(emoji)}
                        className="grid size-8 shrink-0 place-items-center rounded-xl bg-card-2 hover:bg-accent/20 text-lg transition active:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Chat composer */}
                  <form onSubmit={handleChatSubmit} className="flex gap-2 pt-1 shrink-0">
                    <input
                      type="text"
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder="Chat in room…"
                      className="h-10 flex-1 rounded-xl border border-border bg-card-2 px-3 text-xs text-foreground outline-none transition focus-visible:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={!chatText.trim()}
                      className="grid size-10 place-items-center rounded-xl bg-foreground text-background transition hover:opacity-90 active:scale-90 disabled:opacity-40"
                    >
                      <Send className="size-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* Tab 2: Members & Host Settings */}
              {activeTab === 'peers' && (
                <div className="flex flex-1 flex-col overflow-y-auto space-y-3 pt-3 min-h-0">
                  {/* Host controls toggle */}
                  {isHost && (
                    <div className="rounded-2xl border border-border bg-card-2/70 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          {room.hostOnlyControl ? (
                            <Lock className="size-3.5 text-muted" />
                          ) : (
                            <Unlock className="size-3.5 text-muted" />
                          )}
                          <span>Control Mode</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => room.setHostOnlyControl(!room.hostOnlyControl)}
                          className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold text-foreground hover:border-accent transition"
                        >
                          {room.hostOnlyControl ? 'Host Only' : 'Free for All'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={onForceSync}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-1.5 text-xs font-semibold text-muted hover:text-foreground transition active:scale-95"
                      >
                        <RotateCw className="size-3.5" />
                        <span>Force Sync All Peers</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          onChangeShowClick?.()
                        }}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-foreground hover:border-accent transition active:scale-95"
                      >
                        <Film className="size-3.5" />
                        <span>Switch Anime / Show</span>
                      </button>
                    </div>
                  )}

                  {/* Peers list */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Connected ({peers.length})
                    </span>
                    {peers.map((p) => {
                      const isSelf = p.peerId === room.peerId
                      return (
                        <div
                          key={p.peerId}
                          className="flex items-center justify-between rounded-2xl border border-border/60 bg-card-2/50 p-2.5 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative">
                              <Avatar size={34} name={p.displayName} src={p.avatar} />
                              {p.isMicActive && (
                                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 border-2 border-card ring-2 ring-emerald-500/30 animate-pulse" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-bold text-foreground">
                                  {p.displayName}
                                </span>
                                {isSelf && (
                                  <span className="rounded-full border border-border px-1.5 text-[9px] font-semibold text-muted">
                                    You
                                  </span>
                                )}
                                {p.isHost && (
                                  <span title="Host">
                                    <Crown className="size-3 text-foreground shrink-0" />
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted">
                                <span>@{p.username}</span>
                                {p.isMicActive ? (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-400 font-medium">
                                    <Mic className="size-2.5" />
                                    <span>Mic on</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-muted/60">
                                    <MicOff className="size-2.5" />
                                    <span>Muted</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Individual mute/unmute control for other peers */}
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => {
                                  const isMuted = room.toggleMutePeer(p.peerId)
                                  toast(
                                    isMuted ? `Muted @${p.username} for you` : `Unmuted @${p.username}`,
                                    'info'
                                  )
                                }}
                                title={p.isLocallyMuted ? `Unmute @${p.username}` : `Mute @${p.username} for you`}
                                className={cn(
                                  'grid size-8 place-items-center rounded-xl border transition active:scale-90',
                                  p.isLocallyMuted
                                    ? 'border-rose-500/40 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
                                    : 'border-border bg-card text-muted hover:text-foreground hover:border-accent'
                                )}
                              >
                                {p.isLocallyMuted ? (
                                  <VolumeX className="size-3.5" />
                                ) : (
                                  <Volume2 className="size-3.5" />
                                )}
                              </button>
                            )}

                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-400" />
                              <span>{p.p2pConnected ? 'Online' : 'Joining'}</span>
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Leave room footer */}
              <div className="pt-3 border-t border-border mt-auto shrink-0">
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-border text-xs font-semibold text-muted hover:border-rose-500/40 hover:text-rose-400 transition active:scale-95"
                >
                  <LogOut className="size-3.5" />
                  <span>Leave Watch Party</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
