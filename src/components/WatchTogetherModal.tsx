import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Share2,
  Download,
  ChevronRight,
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
import { partyShareUrl } from '../lib/share'
import { shareCard, saveShareCard, type ShareCardOpts } from '../lib/shareCard'
import type { WatchTogetherRoom, PeerMember } from '../lib/webrtcWatchTogether'

const EMOJI_REACTIONS = ['🔥', '😱', '❤️', '😂', '👏', '⚡', '🍿', '⚔️']

export function WatchTogetherModal({
  open,
  onClose,
  room,
  peers,
  onSendReaction,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onForceSync,
  animeTitle,
  animeId,
  image,
  episode,
  isHost,
  onChangeShowClick,
}: {
  open: boolean
  onClose: () => void
  room: WatchTogetherRoom | null
  peers: PeerMember[]
  onSendReaction: (emoji: string) => void
  onCreateRoom: () => void
  onJoinRoom: (code: string) => void
  onLeaveRoom: () => void
  onForceSync: () => void
  animeTitle: string
  animeId: number
  /** banner / backdrop of the current show, used as the card background */
  image?: string | null
  episode: number
  isHost: boolean
  connectionStatus: 'connecting' | 'connected' | 'p2p' | 'disconnected'
  onChangeShowClick?: () => void
}) {
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [isMicActive, setIsMicActive] = useState(room?.getIsMicActive() || false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!room) return
    setIsMicActive(room.getIsMicActive())
    room.onLocalMicChange((active) => setIsMicActive(active))
  }, [room])

  const me = room ? peers.find((p) => p.peerId === room.peerId) : undefined
  const selfName = me?.displayName || 'A friend'
  const inviteUrl = room ? partyShareUrl(animeId, episode, room.roomId, selfName, animeTitle, me?.avatar) : ''
  const card: ShareCardOpts | null = room
    ? {
        kind: 'party',
        eyebrow: `${selfName} is inviting you`,
        title: animeTitle,
        subtitle: `Episode ${episode} · Watch together`,
        image,
        avatar: me?.avatar,
        initial: selfName,
        code: room.roomId,
      }
    : null

  // Pre-render and sync the invite card image to Supabase public storage for rich social preview cards
  useEffect(() => {
    if (!room || !card) return
    let cancelled = false
    void (async () => {
      try {
        const { safeRenderShareCard } = await import('../lib/shareCard')
        const blob = await safeRenderShareCard(card)
        if (cancelled) return
        const { supabase } = await import('../lib/supabase')
        await supabase.storage.from('share-cards').upload(`${room.roomId}.png`, blob, {
          contentType: 'image/png',
          upsert: true,
        })
      } catch (e) {
        console.warn('[WatchTogether] Card upload deferred:', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [room?.roomId, animeTitle, episode, image, me?.avatar, selfName])

  const copy = async (what: 'code' | 'link') => {
    if (!room) return
    try {
      await navigator.clipboard.writeText(what === 'code' ? room.roomId : inviteUrl)
      setCopied(what)
      toast(what === 'code' ? `Party code ${room.roomId} copied` : 'Invite link copied')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast('Failed to copy', 'error')
    }
  }

  /** Open a member's profile. The party id is remembered so coming back reopens this panel and rejoins the room. */
  const openProfile = (p: PeerMember) => {
    if (!room || !p.userId || !p.username) return
    try {
      sessionStorage.setItem('zk:party-return', room.roomId)
    } catch {
      /* storage unavailable */
    }
    onClose()
    navigate(`/u/${encodeURIComponent(p.username)}`)
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          className="relative flex h-[88vh] max-h-[760px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-2xl shadow-black/60"
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
            <div className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 pb-1">
              {/* Header */}
              <div className="flex items-center gap-2.5 pr-9">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-card-2 text-foreground">
                  <MonitorPlay className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold">Watch Party</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold text-muted">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Synced
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted">{animeTitle} · Ep {episode}</p>
                </div>
              </div>

              {/* Invite card: same design as the image that gets shared */}
              <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 text-white shadow-xl">
                {image ? (
                  <img src={image} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full scale-110 object-cover blur-md" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/60 via-fuchsia-700/30 to-indigo-900/60" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/45 to-black/85" />
                <div className="relative flex flex-col items-center px-4 pb-4 pt-5 text-center">
                  <Avatar size={64} name={selfName} src={me?.avatar} className="ring-2 ring-white/80 rounded-full" />
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">{selfName} is inviting you</p>
                  <h3 className="mt-1 line-clamp-2 font-display text-lg font-extrabold leading-tight">{animeTitle}</h3>
                  <p className="mt-0.5 text-xs text-white/70">Episode {episode} · Watch together</p>

                  <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Party code</p>
                  <button
                    type="button"
                    onClick={() => copy('code')}
                    aria-label={`Copy party code ${room.roomId}`}
                    className="mt-1.5 flex max-w-full flex-wrap justify-center gap-1 rounded-2xl border border-dashed border-white/40 bg-white/10 px-3 py-2 backdrop-blur transition active:scale-95"
                  >
                    {room.roomId.toUpperCase().split('').map((c, i) => (
                      <span key={i} className={cn('grid h-9 min-w-6 place-items-center rounded-lg font-display text-lg font-extrabold', c === '-' ? 'text-white/50' : 'bg-white/15')}>
                        {c}
                      </span>
                    ))}
                  </button>
                </div>
              </div>

              {/* Share / copy options */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => copy('code')}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card-2 px-3 text-xs font-semibold text-foreground transition hover:border-accent active:scale-95"
                >
                  {copied === 'code' ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copied === 'code' ? 'Code copied' : 'Copy code'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copy('link')}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card-2 px-3 text-xs font-semibold text-foreground transition hover:border-accent active:scale-95"
                >
                  {copied === 'link' ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copied === 'link' ? 'Link copied' : 'Copy link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => card && void shareCard(card, inviteUrl, `${selfName} is inviting you to watch ${animeTitle} together on Zenkai · code ${room.roomId}`)}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-foreground px-3 text-xs font-bold text-background transition hover:opacity-90 active:scale-95"
                >
                  <Share2 className="size-3.5" />
                  <span>Share card</span>
                </button>
                <button
                  type="button"
                  onClick={() => card && void saveShareCard(card)}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card-2 px-3 text-xs font-semibold text-foreground transition hover:border-accent active:scale-95"
                >
                  <Download className="size-3.5" />
                  <span>Save image</span>
                </button>
              </div>

              {/* Mic + reactions */}
              <div className="mt-3 flex items-center gap-2">
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
                      preacquired?.getTracks().forEach((t) => t.stop())
                      setIsMicActive(false)
                    }
                  }}
                  title={isMicActive ? 'Mute Microphone' : 'Enable Microphone'}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition active:scale-95',
                    isMicActive ? 'bg-foreground text-background' : 'border border-border bg-card-2 text-muted hover:border-accent hover:text-foreground'
                  )}
                >
                  {isMicActive ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
                  <span>{isMicActive ? 'Mic On' : 'Mic'}</span>
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                  {EMOJI_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onSendReaction(emoji)}
                      className="grid size-8 shrink-0 place-items-center rounded-xl bg-card-2 text-base transition hover:bg-accent/20 active:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Host controls */}
              {isHost && (
                <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card-2/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      {room.hostOnlyControl ? <Lock className="size-3.5 text-muted" /> : <Unlock className="size-3.5 text-muted" />}
                      <span>Control Mode</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => room.setHostOnlyControl(!room.hostOnlyControl)}
                      className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold text-foreground transition hover:border-accent"
                    >
                      {room.hostOnlyControl ? 'Host Only' : 'Free for All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onForceSync}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-muted transition hover:text-foreground active:scale-95"
                    >
                      <RotateCw className="size-3.5" />
                      <span>Force sync</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onChangeShowClick?.()
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-foreground transition hover:border-accent active:scale-95"
                    >
                      <Film className="size-3.5" />
                      <span>Switch show</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Members */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Members ({peers.length})</span>
                  <span className="text-[10px] text-muted">Tap a member to open their profile</span>
                </div>
                <div className="space-y-1.5">
                  {peers.map((p) => {
                    const isSelf = p.peerId === room.peerId
                    const canOpen = Boolean(p.userId && p.username)
                    return (
                      <div key={p.peerId} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card-2/50 p-2">
                        <button
                          type="button"
                          disabled={!canOpen}
                          onClick={() => openProfile(p)}
                          aria-label={canOpen ? `Open @${p.username}'s profile` : p.displayName}
                          className={cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-0.5 text-left transition', canOpen && 'hover:bg-card active:scale-[0.98]')}
                        >
                          <div className="relative shrink-0">
                            <Avatar size={36} name={p.displayName} src={p.avatar} />
                            {p.isMicActive && (
                              <span className="absolute -bottom-0.5 -right-0.5 size-3 animate-pulse rounded-full border-2 border-card bg-emerald-500 ring-2 ring-emerald-500/30" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-bold text-foreground">{p.displayName}</span>
                              {isSelf && <span className="rounded-full border border-border px-1.5 text-[9px] font-semibold text-muted">You</span>}
                              {p.isHost && (
                                <span title="Host">
                                  <Crown className="size-3 shrink-0 text-foreground" />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted">
                              <span className="truncate">{canOpen ? `@${p.username}` : 'Guest'}</span>
                              {p.isMicActive ? (
                                <span className="inline-flex items-center gap-0.5 font-medium text-emerald-400"><Mic className="size-2.5" />Mic on</span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-muted/60"><MicOff className="size-2.5" />Muted</span>
                              )}
                            </div>
                          </div>
                          {canOpen && <ChevronRight className="size-4 shrink-0 text-muted" />}
                        </button>

                        <div className="flex shrink-0 items-center gap-2">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                const isMuted = room.toggleMutePeer(p.peerId)
                                toast(isMuted ? `Muted ${p.displayName} for you` : `Unmuted ${p.displayName}`, 'info')
                              }}
                              title={p.isLocallyMuted ? `Unmute ${p.displayName}` : `Mute ${p.displayName} for you`}
                              className={cn(
                                'grid size-8 place-items-center rounded-xl border transition active:scale-90',
                                p.isLocallyMuted
                                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
                                  : 'border-border bg-card text-muted hover:border-accent hover:text-foreground'
                              )}
                            >
                              {p.isLocallyMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                            </button>
                          )}
                          <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold', p.p2pConnected ? 'text-emerald-400' : 'text-amber-400')}>
                            <span className={cn('size-1.5 rounded-full', p.p2pConnected ? 'bg-emerald-400' : 'bg-amber-400')} />
                            <span>{p.p2pConnected ? 'Online' : 'Joining'}</span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Leave */}
              <div className="mt-4 shrink-0 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-border text-xs font-semibold text-muted transition hover:border-rose-500/40 hover:text-rose-400 active:scale-95"
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
