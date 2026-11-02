import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Radio,
} from 'lucide-react'
import { Avatar } from './Avatar'
import type { DirectVoiceCall, CallStatus } from '../lib/webrtcVoiceCall'
import { cn } from '../lib/utils'
import { requestMicrophoneStream } from '../lib/microphone'
import { toast } from '../lib/toast'

function formatSeconds(total: number) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
}

export function VoiceCallOverlay({
  call,
  onEndCall,
}: {
  call: DirectVoiceCall | null
  onEndCall: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const isOnCallPage = location.pathname === '/call'

  const [status, setStatus] = useState<CallStatus>(call?.status || 'idle')
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(call?.isMuted || false)
  const [isDeafened, setIsDeafened] = useState(call?.isDeafened || false)

  useEffect(() => {
    if (!call) return

    setStatus(call.status)
    setIsMuted(call.isMuted)
    setIsDeafened(call.isDeafened)

    call.setCallbacks({
      onStatusChange: (newStatus) => {
        setStatus(newStatus)
        if (newStatus === 'ended') {
          setTimeout(onEndCall, 800)
        }
      },
    })
  }, [call, onEndCall])

  // Call timer when connected
  useEffect(() => {
    if (status !== 'connected') {
      setDuration(0)
      return
    }

    const interval = window.setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [status])

  if (!call || status === 'idle' || status === 'ended') return null

  const handleToggleMute = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = await call.toggleMute()
    setIsMuted(next)
  }

  const handleToggleDeafen = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = call.toggleDeafen()
    setIsDeafened(next)
  }

  const handleAccept = async () => {
    let stream: MediaStream | undefined
    try {
      stream = await requestMicrophoneStream()
    } catch (err: any) {
      console.warn('[VoiceCall] Callee mic prompt error:', err)
      const msg = err?.message || ''
      if (msg.includes('HTTPS')) {
        toast(msg, 'error')
      }
    }
    navigate('/call')
    await call.acceptCall(stream)
  }

  const handleDecline = () => {
    call.endCall(true, 'declined')
    onEndCall()
  }

  return (
    <AnimatePresence>
      {/* ================= 1. MOBILE-OPTIMIZED FULL-SCREEN INCOMING CALL SHEET ================= */}
      {status === 'incoming' && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-between bg-background/95 p-6 sm:p-10 backdrop-blur-xl text-center select-none">
          {/* Top Header */}
          <div className="flex flex-col items-center pt-4 sm:pt-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-400 shadow-sm animate-pulse">
              <Radio className="size-3.5" />
              <span>Incoming Voice Call</span>
            </span>
          </div>

          {/* Center: Large Avatar & Caller Info */}
          <div className="flex flex-col items-center my-auto">
            <div className="relative mb-6">
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.05, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-8 rounded-full bg-accent/25"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.15, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-4 rounded-full bg-accent/35"
              />
              <div className="relative rounded-full ring-4 ring-card-2/80 shadow-2xl shadow-black/80">
                <Avatar
                  size={96}
                  name={call.partner.displayName}
                  src={call.partner.avatar}
                  animateFrame
                />
              </div>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {call.partner.displayName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted">@{call.partner.username}</p>
            <p className="mt-3 text-xs font-semibold text-emerald-400 animate-pulse">
              Zenkai Audio Call Ringing…
            </p>
          </div>

          {/* Bottom Action Controls (Large touch targets for mobile) */}
          <div className="flex items-center justify-around max-w-sm mx-auto w-full pb-8 sm:pb-12">
            {/* Decline button */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleDecline}
                className="flex size-16 sm:size-18 items-center justify-center rounded-full bg-rose-600 text-white shadow-xl shadow-rose-600/40 transition hover:scale-105 active:scale-95"
                title="Decline Call"
                aria-label="Decline Call"
              >
                <PhoneOff className="size-7 sm:size-8" />
              </button>
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Decline
              </span>
            </div>

            {/* Accept button */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleAccept}
                className="flex size-16 sm:size-18 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/40 transition hover:scale-105 active:scale-95 animate-bounce"
                title="Accept Call"
                aria-label="Accept Call"
              >
                <PhoneCall className="size-7 sm:size-8" />
              </button>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Accept
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. CONNECTED ACTIVE CALL FLOATING BAR (WHEN NOT ON /call PAGE) ================= */}
      {status === 'connected' && !isOnCallPage && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          onClick={() => navigate('/call')}
          className="fixed top-18 sm:top-20 inset-x-3 sm:inset-x-auto sm:right-6 z-[160] sm:w-96 rounded-3xl border border-emerald-500/40 bg-card/95 p-3.5 shadow-2xl shadow-black/80 backdrop-blur-2xl ring-2 ring-emerald-500/20 cursor-pointer transition hover:border-emerald-400/60"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <Avatar size={38} name={call.partner.displayName} src={call.partner.avatar} />
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-bold text-foreground">
                    {call.partner.displayName}
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400">
                    Voice
                  </span>
                </div>
                <p className="text-[11px] font-mono font-semibold text-emerald-400">
                  {formatSeconds(duration)}
                </p>
              </div>
            </div>

            {/* In-Call Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Maximize to full Call Page */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('/call')
                }}
                title="Open full call page"
                className="grid size-9 place-items-center rounded-2xl border border-border bg-card-2 text-foreground hover:border-accent hover:text-accent transition active:scale-90"
              >
                <Maximize2 className="size-4" />
              </button>

              {/* Mic Mute/Unmute */}
              <button
                type="button"
                onClick={handleToggleMute}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={cn(
                  'grid size-9 place-items-center rounded-2xl border transition active:scale-90',
                  isMuted
                    ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                    : 'border-border bg-card-2 text-foreground hover:border-accent'
                )}
              >
                {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </button>

              {/* Deafen Mute Speaker */}
              <button
                type="button"
                onClick={handleToggleDeafen}
                title={isDeafened ? 'Undeafen' : 'Deafen'}
                className={cn(
                  'grid size-9 place-items-center rounded-2xl border transition active:scale-90',
                  isDeafened
                    ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                    : 'border-border bg-card-2 text-foreground hover:border-accent'
                )}
              >
                {isDeafened ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>

              {/* End Call */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  call.endCall()
                  onEndCall()
                }}
                title="End Call"
                className="grid size-9 place-items-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-600/30 transition hover:brightness-110 active:scale-90"
              >
                <PhoneOff className="size-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
