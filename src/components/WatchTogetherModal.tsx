import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Crown, Lock, Unlock, Plus, Share2, X, LogOut, RotateCw, Film, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { Avatar } from './Avatar'
import { useNameStyles } from '../lib/nameStyles'
import { TextEffectRenderer } from './ascension/TextEffectRenderer'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { useMedia } from '../hooks/useMedia'
import { requestMicrophoneStream } from '../lib/microphone'
import { partyShareUrl } from '../lib/share'
import { shareCard, type ShareCardOpts } from '../lib/shareCard'
import type { WatchTogetherRoom, PeerMember } from '../lib/webrtcWatchTogether'

const EMOJI_REACTIONS = ['🔥', '😱', '❤️', '😂', '👏', '⚡', '🍿', '⚔️']
const EASE = [0.22, 1, 0.36, 1] as const
const btn = 'inline-flex h-9 items-center justify-center gap-1.5 border border-white/10 px-3 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:text-white active:scale-95'

/** Watch Together: a docked panel beside the player (desktop) or a bottom sheet (phones). Room + Chat tabs. */
export function WatchTogetherModal({
  open, onClose, room, peers, onSendReaction, onCreateRoom, onJoinRoom, onLeaveRoom, onForceSync,
  animeTitle, animeId, image, episode, isHost, onChangeShowClick, shareUrl,
  tab, onTab, unread = 0, chat, inline = false,
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
  image?: string | null
  episode: number
  isHost: boolean
  connectionStatus: 'connecting' | 'connected' | 'p2p' | 'disconnected'
  onChangeShowClick?: () => void
  shareUrl?: string
  tab: 'room' | 'chat'
  onTab: (t: 'room' | 'chat') => void
  unread?: number
  chat: ReactNode
  /** fill the parent (the page's right rail) instead of docking / sheeting itself */
  inline?: boolean
}) {
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [isMicActive, setIsMicActive] = useState(room?.getIsMicActive() || false)
  const navigate = useNavigate()
  const lg = useMedia('(min-width: 1024px)')

  useEffect(() => {
    if (!room) return
    setIsMicActive(room.getIsMicActive())
    room.onLocalMicChange((active) => setIsMicActive(active))
  }, [room])

  const me = room ? peers.find((p) => p.peerId === room.peerId) : undefined
  const styles = useNameStyles(peers.map((p) => p.userId))
  const selfName = me?.displayName || 'A friend'
  const inviteUrl = room ? (shareUrl ?? partyShareUrl(animeId, episode, room.roomId, selfName, animeTitle, me?.avatar)) : ''
  const card: ShareCardOpts | null = room
    ? { kind: 'party', eyebrow: `${selfName} is inviting you`, title: animeTitle, subtitle: `Episode ${episode} · Watch together`, image, avatar: me?.avatar, initial: selfName, code: room.roomId }
    : null

  // pre-render the invite card to public storage so shared links get a rich preview
  useEffect(() => {
    if (!room || !card) return
    let cancelled = false
    void (async () => {
      try {
        const { safeRenderShareCard } = await import('../lib/shareCard')
        const blob = await safeRenderShareCard(card)
        if (cancelled) return
        const { supabase } = await import('../lib/supabase')
        await supabase.storage.from('share-cards').upload(`${room.roomId}.png`, blob, { contentType: 'image/png', upsert: true })
      } catch (e) {
        console.warn('[WatchTogether] Card upload deferred:', e)
      }
    })()
    return () => { cancelled = true }
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

  const openProfile = (p: PeerMember) => {
    if (!room || !p.userId || !p.username) return
    try { sessionStorage.setItem('zk:party-return', room.roomId) } catch { /* storage unavailable */ }
    onClose()
    navigate(`/u/${encodeURIComponent(p.username)}`)
  }

  const toggleMic = async () => {
    if (!room) return
    let pre: MediaStream | undefined
    if (!isMicActive) {
      try {
        pre = await requestMicrophoneStream()
      } catch (err: any) {
        const msg = err?.message || ''
        if (msg.includes('HTTPS')) return toast(msg, 'error')
        const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
        return toast(denied ? 'Microphone permission denied. Allow microphone in browser settings to speak.' : 'Could not access microphone', 'error')
      }
    }
    try {
      const active = await room.toggleMic(pre)
      setIsMicActive(active)
      toast(active ? 'Microphone unmuted - voice active' : 'Microphone muted', active ? 'success' : 'info')
    } catch {
      pre?.getTracks().forEach((t) => t.stop())
      setIsMicActive(false)
    }
  }

  const tabBtn = (t: 'room' | 'chat', label: string) => (
    <button
      type="button"
      onClick={() => onTab(t)}
      className={cn('relative flex-1 py-2.5 text-xs font-semibold transition', tab === t ? 'text-white' : 'text-white/45 hover:text-white/80')}
    >
      {label}
      {t === 'chat' && unread > 0 && tab !== 'chat' && <span className="ml-1.5 text-[10px] font-bold text-accent">{unread > 9 ? '9+' : unread}</span>}
      {tab === t && <motion.span layoutId="wt-tab" className="absolute inset-x-0 bottom-0 h-px bg-white" />}
    </button>
  )

  const body = (
    <div className="flex h-full min-h-0 flex-col border border-white/10 bg-black text-white">
      <header className="flex shrink-0 items-center gap-2 px-3.5 pt-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">Watch Together</span>
        {room && <span className="text-[10px] text-white/45">{peers.length} watching</span>}
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid size-7 place-items-center text-white/60 transition hover:text-white active:scale-90">
          <X className="size-4" />
        </button>
      </header>

      {room && (
        <nav className="mt-1 flex shrink-0 border-b border-white/10 px-1.5">
          {tabBtn('room', 'Room')}
          {tabBtn('chat', 'Chat')}
        </nav>
      )}

      {room && tab === 'chat' ? (
        <div className="min-h-0 flex-1">{chat}</div>
      ) : !room ? (
        <div className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto p-3.5">
          <div>
            <h2 className="mt-2 font-display text-lg font-bold">Watch in sync</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/55">Play, pause and seek stay in sync for everyone in the room.</p>
            <div className="mt-4 border border-white/10 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Now playing</span>
              <p className="mt-1 truncate text-sm font-semibold">{animeTitle}</p>
              <p className="text-xs text-white/55">Episode {episode}</p>
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <button type="button" onClick={onCreateRoom} className="flex h-11 w-full items-center justify-center gap-2 bg-white text-sm font-bold text-black transition hover:bg-white/90 active:scale-95">
              <Plus className="size-4" />
              Start party
            </button>
            <p className="text-center text-[10px] uppercase tracking-wider text-white/35">or join with code</p>
            <form onSubmit={(e) => { e.preventDefault(); if (joinCode.trim()) onJoinRoom(joinCode.trim()) }} className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="zk-xxxxxx"
                className="h-10 min-w-0 flex-1 border border-white/10 bg-transparent px-3 text-xs font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-white/40"
              />
              <button type="submit" disabled={joinCode.trim().length < 3} className={cn(btn, 'h-10 px-4 disabled:opacity-40')}>Join</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3.5">
          <div>
            <p className="truncate text-xs text-white/55">{animeTitle} · Ep {episode}</p>
            <button
              type="button"
              onClick={() => copy('code')}
              aria-label={`Copy party code ${room.roomId}`}
              className="mt-2 flex w-full items-center justify-between border border-dashed border-white/25 px-3 py-2.5 text-left transition hover:border-white/50 active:scale-[0.99]"
            >
              <span className="font-display text-base font-bold tracking-[0.18em]">{room.roomId.toUpperCase()}</span>
              {copied === 'code' ? <Check className="size-4" /> : <Copy className="size-4 text-white/50" />}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copy('link')} className={btn}>
                {copied === 'link' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={() => card && void shareCard(card, inviteUrl, `${selfName} is inviting you to watch ${animeTitle} together on Zenkai · code ${room.roomId}`)}
                className={btn}
              >
                <Share2 className="size-3.5" />
                Share
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleMic} title={isMicActive ? 'Mute microphone' : 'Enable microphone'} className={cn(btn, 'shrink-0', isMicActive && 'border-white bg-white text-black hover:text-black')}>
              {isMicActive ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
              {isMicActive ? 'Mic on' : 'Mic'}
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
              {EMOJI_REACTIONS.map((e) => (
                <button key={e} type="button" onClick={() => onSendReaction(e)} className="grid size-8 shrink-0 place-items-center border border-white/10 text-base transition hover:border-white/30 active:scale-125">
                  {e}
                </button>
              ))}
            </div>
          </div>

          {isHost && (
            <div className="space-y-2 border border-white/10 p-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  {room.hostOnlyControl ? <Lock className="size-3.5 text-white/50" /> : <Unlock className="size-3.5 text-white/50" />}
                  Control
                </span>
                <button type="button" onClick={() => room.setHostOnlyControl(!room.hostOnlyControl)} className="border border-white/15 px-2.5 py-0.5 text-[11px] transition hover:border-white/40">
                  {room.hostOnlyControl ? 'Host only' : 'Everyone'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={onForceSync} className={btn}><RotateCw className="size-3.5" />Force sync</button>
                <button type="button" onClick={() => { onClose(); onChangeShowClick?.() }} className={btn}><Film className="size-3.5" />Switch show</button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">Members ({peers.length})</p>
            <ul className="divide-y divide-white/5 border border-white/10">
              {peers.map((p) => {
                const isSelf = p.peerId === room.peerId
                const canOpen = Boolean(p.userId && p.username)
                return (
                  <li key={p.peerId} className="flex items-center gap-2 p-2">
                    <button type="button" disabled={!canOpen} onClick={() => openProfile(p)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <div className="relative shrink-0">
                        <Avatar size={32} name={p.displayName} src={p.avatar} />
                        {p.isMicActive && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 animate-pulse rounded-full border-2 border-black bg-white" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="-mx-2 -my-1 min-w-0 truncate px-2 py-1 text-xs font-semibold">{p.userId && styles[p.userId] ? <TextEffectRenderer text={p.displayName} effectId={styles[p.userId].effect} fontId={styles[p.userId].font} colorId={styles[p.userId].color ?? 'default'} /> : p.displayName}</span>
                          {isSelf && <span className="text-[9px] text-white/45">you</span>}
                          {p.isHost && <Crown className="size-3 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-white/45">{p.p2pConnected ? (canOpen ? `@${p.username}` : 'Guest') : 'Joining…'}</span>
                      </div>
                    </button>
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => {
                          const m = room.toggleMutePeer(p.peerId)
                          toast(m ? `Muted ${p.displayName} for you` : `Unmuted ${p.displayName}`, 'info')
                        }}
                        title={p.isLocallyMuted ? `Unmute ${p.displayName}` : `Mute ${p.displayName} for you`}
                        className={cn('grid size-8 place-items-center border border-white/10 transition active:scale-90', p.isLocallyMuted ? 'text-white' : 'text-white/45 hover:text-white')}
                      >
                        {p.isLocallyMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          <button type="button" onClick={onLeaveRoom} className={cn(btn, 'h-10 w-full text-white/55 hover:text-white')}>
            <LogOut className="size-3.5" />
            Leave party
          </button>
        </div>
      )}
    </div>
  )

  if (inline) return body

  return (
    <AnimatePresence initial={false}>
      {open && lg && (
        <motion.aside
          key="dock"
          initial={{ width: '0%', opacity: 0 }}
          animate={{ width: '32%', opacity: 1 }}
          exit={{ width: '0%', opacity: 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="relative shrink-0 overflow-hidden"
          aria-label="Watch Together"
        >
          <div className="absolute inset-y-0 right-0 w-full min-w-[300px] pl-3">{body}</div>
        </motion.aside>
      )}
      {open && !lg && (
        <motion.div
          key="sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.34, ease: EASE }}
          className="fixed inset-x-0 bottom-0 z-40 h-[72svh]"
          role="dialog"
          aria-label="Watch Together"
        >
          {body}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
