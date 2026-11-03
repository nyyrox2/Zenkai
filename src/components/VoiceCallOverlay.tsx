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

  // Call timer linked directly to call.getDuration()
  useEffect(() => {
    if (!call || (status !== 'connected' && status !== 'hold')) {
      if (status !== 'connected' && status !== 'hold') setDuration(0)
      return
    }

    setDuration(call.getDuration())
    const interval = window.setInterval(() => {
      setDuration(call.getDuration())
    }, 1000)

    return () => clearInterval(interval)
  }, [call, status])

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
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {})
      }
    } catch {}
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
      {/* ================= 1. MOBILE-OPTIMIZED FULL-SCREEN INCOMING CALL SHEET (Monochrome & Crimson) ================= */}
      {status === 'incoming' && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-between bg-[#070709]/95 text-white p-6 sm:p-10 backdrop-blur-2xl text-center select-none">
          {/* Top Header */}
          <div className="flex flex-col items-center pt-4 sm:pt-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 text-xs font-bold text-rose-300 shadow-sm animate-pulse">
              <Radio className="size-3.5 text-accent" />
              <span>Incoming Voice Call</span>
            </span>
          </div>

          {/* Center: Large Avatar & Caller Info */}
          <div className="flex flex-col items-center my-auto">
            <div className="relative mb-6">
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.25, 0.05, 0.25] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-8 rounded-full border border-white/10 bg-white/[0.04]"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-4 rounded-full border border-rose-500/30 bg-rose-500/10"
              />
              <div className="relative rounded-full ring-2 ring-zinc-800 shadow-2xl shadow-black">
                <Avatar
                  size={96}
                  name={call.partner.displayName}
                  src={call.partner.avatar}
                  animateFrame
                />
              </div>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {call.partner.displayName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-zinc-400">@{call.partner.username}</p>
            <p className="mt-3 text-xs font-semibold text-zinc-400 flex items-center justify-center gap-1.5">
              <span className="size-1.5 rounded-full bg-accent animate-ping" />
              <span>Zenkai Audio Call Ringing…</span>
            </p>
          </div>

          {/* Bottom Action Controls */}
          <div className="flex items-center justify-around max-w-sm mx-auto w-full pb-8 sm:pb-12">
            {/* Decline button */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleDecline}
                className="flex size-16 sm:size-18 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 shadow-xl transition hover:border-zinc-700 hover:text-white active:scale-95"
                title="Decline Call"
                aria-label="Decline Call"
              >
                <PhoneOff className="size-7 sm:size-8 text-rose-400" />
              </button>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Decline
              </span>
            </div>

            {/* Accept button */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleAccept}
                className="flex size-16 sm:size-18 items-center justify-center rounded-full bg-[#e8294c] hover:bg-[#ff2d55] text-white shadow-xl shadow-rose-950/60 transition hover:scale-105 active:scale-95 animate-pulse"
                title="Accept Call"
                aria-label="Accept Call"
              >
                <PhoneCall className="size-7 sm:size-8" />
              </button>
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Accept
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. ACTIVE CALL FLOATING BAR (Minimal Dark UI) ================= */}
      {status !== 'incoming' && !isOnCallPage && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          onClick={() => navigate('/call')}
          className="fixed top-18 sm:top-20 inset-x-3 sm:inset-x-auto sm:right-6 z-[160] sm:w-96 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl shadow-black backdrop-blur-2xl ring-1 ring-white/10 cursor-pointer transition hover:border-zinc-700"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <Avatar size={36} name={call.partner.displayName} src={call.partner.avatar} />
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-zinc-950',
                    status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  )}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-bold text-white">
                    {call.partner.displayName}
                  </span>
                  <span className="rounded-full border border-zinc-800 bg-zinc-900 px-1.5 py-0.2 text-[9px] font-semibold text-zinc-400">
                    Voice
                  </span>
                </div>
                <p className="text-[11px] font-mono font-semibold text-zinc-300">
                  {status === 'calling'
                    ? 'Ringing…'
                    : status === 'connecting'
                    ? 'Connecting…'
                    : status === 'hold'
                    ? `Hold • ${formatSeconds(duration)}`
                    : formatSeconds(duration)}
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
                className="grid size-8 place-items-center rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:border-zinc-700 hover:text-white transition active:scale-90"
              >
                <Maximize2 className="size-3.5" />
              </button>

              {/* Mic Mute/Unmute - Dark UI */}
              <button
                type="button"
                onClick={handleToggleMute}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={cn(
                  'grid size-8 place-items-center rounded-xl border transition active:scale-90',
                  isMuted
                    ? 'border-zinc-700 bg-zinc-800 text-white'
                    : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:border-zinc-700 hover:text-white'
                )}
              >
                {isMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
              </button>

              {/* Deafen Mute Speaker - Dark UI */}
              <button
                type="button"
                onClick={handleToggleDeafen}
                title={isDeafened ? 'Undeafen' : 'Deafen'}
                className={cn(
                  'grid size-8 place-items-center rounded-xl border transition active:scale-90',
                  isDeafened
                    ? 'border-zinc-700 bg-zinc-800 text-white'
                    : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:border-zinc-700 hover:text-white'
                )}
              >
                {isDeafened ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
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
                className="grid size-8 place-items-center rounded-xl bg-[#e8294c] hover:bg-[#ff2d55] text-white shadow-md shadow-rose-950/50 transition active:scale-90"
              >
                <PhoneOff className="size-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
