import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  ArrowLeft,
  ShieldCheck,
  Radio,
  AlertTriangle,
} from 'lucide-react'
import { useVoiceCall } from '../context/VoiceCallContext'
import { Avatar } from '../components/Avatar'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'

function formatSeconds(total: number) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
}

export default function CallPage() {
  const { activeCall, endCall, returnPath } = useVoiceCall()
  const navigate = useNavigate()

  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(activeCall?.isMuted || false)
  const [isDeafened, setIsDeafened] = useState(activeCall?.isDeafened || false)
  const [status, setStatus] = useState(activeCall?.status || 'idle')
  const [micBlocked, setMicBlocked] = useState(activeCall?.micPermissionDenied || false)
  const [retryingMic, setRetryingMic] = useState(false)

  // Redirect if no active call
  useEffect(() => {
    if (!activeCall) {
      navigate(returnPath || '/messages', { replace: true })
    } else {
      // Ensure microphone permission is requested if not already acquired
      void activeCall.acquireMicrophone().catch((err) => {
        console.warn('[CallPage] acquireMicrophone prompt:', err)
        setMicBlocked(true)
      })
    }
  }, [activeCall, navigate, returnPath])

  // Listen to call events
  useEffect(() => {
    if (!activeCall) return

    setStatus(activeCall.status)
    setIsMuted(activeCall.isMuted)
    setIsDeafened(activeCall.isDeafened)
    setMicBlocked(activeCall.micPermissionDenied)

    activeCall.setCallbacks({
      onStatusChange: (newStatus) => {
        setStatus(newStatus)
        if (newStatus === 'ended') {
          setTimeout(() => {
            navigate(returnPath || '/messages', { replace: true })
          }, 1200)
        }
      },
      onMicPermissionError: () => {
        setMicBlocked(true)
      },
    })
  }, [activeCall, navigate, returnPath])

  // Duration timer
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

  if (!activeCall) return null

  const handleToggleMute = async () => {
    try {
      const next = await activeCall.toggleMute()
      setIsMuted(next)
      setMicBlocked(false)
      toast(next ? 'Microphone muted' : 'Microphone unmuted', 'info')
    } catch {
      setMicBlocked(true)
      toast('Microphone access blocked. Please allow microphone in browser settings.', 'error')
    }
  }

  const handleToggleDeafen = () => {
    const next = activeCall.toggleDeafen()
    setIsDeafened(next)
    toast(next ? 'Speaker deafened' : 'Speaker undeafened', 'info')
  }

  const handleRetryMic = async () => {
    setRetryingMic(true)
    try {
      await activeCall.acquireMicrophone()
      setMicBlocked(false)
      setIsMuted(activeCall.isMuted)
      toast('Microphone access granted!', 'success')
    } catch {
      setMicBlocked(true)
      toast('Microphone still blocked. Check browser address bar permissions.', 'error')
    } finally {
      setRetryingMic(false)
    }
  }

  const handleHangUp = () => {
    endCall()
    navigate(returnPath || '/messages', { replace: true })
  }

  const handleMinimize = () => {
    navigate(returnPath || '/messages')
  }

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-foreground flex flex-col justify-between overflow-hidden select-none">
      {/* Dynamic ambient backdrop blur circles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 size-96 rounded-full bg-accent/15 blur-[120px]" />
        {status === 'connected' && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 size-80 rounded-full bg-emerald-500/10 blur-[100px] animate-pulse" />
        )}
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8 sm:py-6">
        <button
          type="button"
          onClick={handleMinimize}
          className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-3.5 py-2 text-xs font-bold text-foreground backdrop-blur-md transition hover:border-accent hover:text-accent active:scale-95 shadow-sm"
        >
          <ArrowLeft className="size-4" />
          <span>Minimize</span>
        </button>

        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400 backdrop-blur-md">
          <ShieldCheck className="size-3.5" />
          <span>P2P WebRTC HD</span>
        </div>
      </header>

      {/* Center Stage: Partner Profile & Audio Ripples */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
        {/* Animated Avatar with audio ripple rings */}
        <div className="relative mb-6">
          {status === 'connected' && !isDeafened && (
            <>
              <motion.div
                animate={{ scale: [1, 1.45, 1], opacity: [0.35, 0.05, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-8 rounded-full bg-emerald-500/20"
              />
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.15, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-4 rounded-full bg-emerald-500/30"
              />
            </>
          )}

          {status === 'calling' && (
            <div className="absolute -inset-5 rounded-full bg-accent/25 animate-ping opacity-60" />
          )}

          <div className="relative rounded-full ring-4 ring-card-2/80 shadow-2xl shadow-black/80">
            <Avatar
              size={108}
              name={activeCall.partner.displayName}
              src={activeCall.partner.avatar}
              animateFrame
            />
          </div>
        </div>

        {/* Partner Info */}
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {activeCall.partner.displayName}
        </h1>
        <p className="mt-1 text-sm font-semibold text-muted">@{activeCall.partner.username}</p>

        {/* Status indicator / Live Timer */}
        <div className="mt-4 flex flex-col items-center gap-2">
          {status === 'calling' && (
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-bold text-accent shadow-sm">
              <Radio className="size-3.5 animate-pulse" />
              <span>Ringing partner's device…</span>
            </div>
          )}

          {status === 'connected' && (
            <div className="space-y-2">
              <span className="font-mono text-2xl font-bold tracking-wider text-emerald-400 drop-shadow-sm">
                {formatSeconds(duration)}
              </span>

              {/* Real-time Oscillating Visualizer Wave Bars */}
              <div className="flex items-center justify-center gap-1 h-5">
                {[0.4, 0.7, 1.0, 0.6, 0.9, 0.5, 0.8, 0.3].map((height, i) => (
                  <motion.span
                    key={i}
                    animate={{
                      scaleY: isDeafened ? 0.2 : [height * 0.4, height * 1.2, height * 0.4],
                    }}
                    transition={{
                      duration: 0.8 + (i % 3) * 0.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className={cn(
                      'w-1 rounded-full',
                      isDeafened ? 'bg-zinc-700 h-2' : 'bg-emerald-400 h-4'
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {status === 'ended' && (
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-bold text-rose-400">
              <PhoneOff className="size-3.5" />
              <span>Call ended</span>
            </div>
          )}
        </div>

        {/* Microphone Permission Warning / Action Banner */}
        <AnimatePresence>
          {micBlocked && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="mt-6 max-w-sm rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 text-center shadow-lg backdrop-blur-md space-y-2"
            >
              <div className="flex items-center justify-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Microphone Access Blocked</span>
              </div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Your browser blocked microphone access. Tap below or allow microphone in your address bar to speak.
              </p>
              <button
                type="button"
                onClick={handleRetryMic}
                disabled={retryingMic}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-black transition hover:bg-amber-300 active:scale-95 disabled:opacity-50"
              >
                <Mic className="size-3.5" />
                <span>{retryingMic ? 'Requesting…' : 'Allow Microphone'}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Control Bar Dock */}
      <footer className="relative z-10 flex flex-col items-center pb-8 pt-4 px-4 sm:pb-12">
        <div className="flex items-center justify-center gap-5 sm:gap-8 rounded-3xl border border-border/70 bg-card/85 p-4 sm:p-5 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5">
          {/* Mute Mic Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMute}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={cn(
                'grid size-14 place-items-center rounded-2xl border transition active:scale-90 shadow-md',
                isMuted
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/20'
                  : 'border-border bg-card-2 text-foreground hover:border-accent hover:text-accent'
              )}
            >
              {isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {isMuted ? 'Muted' : 'Mute'}
            </span>
          </div>

          {/* End Call / Hang Up Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleHangUp}
              title="End call"
              className="grid size-16 place-items-center rounded-full bg-rose-600 text-white shadow-xl shadow-rose-600/35 transition hover:scale-105 active:scale-95 hover:brightness-110"
            >
              <PhoneOff className="size-7" />
            </button>
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
              End
            </span>
          </div>

          {/* Deafen Speaker Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleDeafen}
              title={isDeafened ? 'Undeafen speaker' : 'Deafen speaker'}
              className={cn(
                'grid size-14 place-items-center rounded-2xl border transition active:scale-90 shadow-md',
                isDeafened
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/20'
                  : 'border-border bg-card-2 text-foreground hover:border-accent hover:text-accent'
              )}
            >
              {isDeafened ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
            </button>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {isDeafened ? 'Deafened' : 'Speaker'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
