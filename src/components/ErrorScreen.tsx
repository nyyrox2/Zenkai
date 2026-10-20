import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, RefreshCw, Undo2 } from 'lucide-react'
import { AuroraBackground } from './AuroraBackground'
import { GhostBuddy } from './GhostBuddy'
import { ShimmerButton } from './ShimmerButton'
import { cn } from '../lib/utils'

export type ErrorKind = 'notfound' | 'server' | 'offline' | 'crash' | 'empty'

const COPY: Record<ErrorKind, { digits?: [string, string]; title: string; text: string; lines: string[] }> = {
  notfound: {
    digits: ['4', '4'],
    title: 'Nothing here.',
    text: 'This page wandered off into another isekai.',
    lines: ['Boo! Nothing here...', 'I looked everywhere.', 'Try the home page?', 'Wrong turn, huh?', 'Still nothing. Promise.'],
  },
  server: {
    digits: ['5', '0'],
    title: 'Server error',
    text: 'Our server tripped over a cable. Give it a moment and try again.',
    lines: ['Server hiccup...', 'I unplugged it. Oops.', 'Try again in a sec!', 'Not you, it is us.', 'Have you tried a retry?'],
  },
  offline: {
    title: 'No signal',
    text: 'You seem to be offline. Check your connection and try again.',
    lines: ['Hello? Anyone there?', 'The wifi ghosted us.', 'Check your connection!'],
  },
  empty: {
    title: 'Nothing to show yet',
    text: 'No images turned up for this one.',
    lines: ['Pretty empty in here...', 'I checked every corner.', 'Maybe check back later?', 'Not a single picture. Rude.'],
  },
  crash: {
    title: 'Something broke',
    text: 'This page hit an unexpected error. A reload usually fixes it.',
    lines: ['Well, that was not meant to happen.', 'Reload and I will behave.', 'My bad!'],
  },
}

/** One place that decides which face an error gets: used by every ErrorState, the router fallback and the boundary. */
export function classify(message = ''): ErrorKind {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'
  if (/not found|doesn.t exist|does not exist|\b404\b/i.test(message)) return 'notfound'
  if (/dynamically imported|chunk|loading module/i.test(message)) return 'crash'
  return 'server'
}

export function ErrorScreen({
  kind,
  message,
  onRetry,
  compact,
  className,
}: {
  kind: ErrorKind
  message?: string
  onRetry?: () => void
  compact?: boolean
  className?: string
}) {
  const navigate = useNavigate()
  const c = COPY[kind]
  useEffect(() => {
    if (!compact) document.title = `${c.title} — Zenkai`
  }, [compact, c.title])

  const ghost = <GhostBuddy lines={c.lines} className={compact ? 'size-24' : 'size-32 sm:size-44'} />
  const retry = onRetry && (
    <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform active:scale-95">
      <RefreshCw className="size-4" /> Try again
    </button>
  )

  if (compact)
    return (
      <div role="alert" className={cn('mx-auto flex max-w-md flex-col items-center gap-2 rounded-3xl border border-border bg-card/60 px-8 pb-8 pt-14 text-center', className)}>
        {ghost}
        <p className="mt-1 font-display text-lg font-bold">{c.title}</p>
        <p className="text-sm text-muted">{kind === 'notfound' || kind === 'crash' ? (message ?? c.text) : c.text}</p>
        {kind === 'server' && message && message !== c.text && <p className="text-xs text-muted/70">{message}</p>}
        <div className="mt-2">{retry}</div>
      </div>
    )

  return (
    <main role="alert" className={cn('relative grid min-h-[80svh] place-items-center overflow-hidden px-4 pt-24 text-center', className)}>
      <AuroraBackground />
      <div className="relative">
        <div className="flex items-center justify-center gap-1 pt-14 font-display font-black leading-none tracking-tight sm:gap-3">
          {c.digits && <span className="text-7xl sm:text-9xl">{c.digits[0]}</span>}
          {ghost}
          {c.digits && <span className="text-7xl sm:text-9xl">{c.digits[1]}</span>}
        </div>
        <h1 className="mt-6 font-display text-3xl font-black tracking-tight sm:text-4xl">{c.title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-muted">{c.text}</p>
        {message && kind !== 'notfound' && <p className="mx-auto mt-1 max-w-sm text-xs text-muted/70">{message}</p>}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {retry}
          <ShimmerButton to="/home" icon={<Home className="size-4" />} variant={retry ? 'ghost' : 'solid'}>
            Back to home
          </ShimmerButton>
          <ShimmerButton onClick={() => navigate(-1)} icon={<Undo2 className="size-4" />} variant="ghost">
            Go back
          </ShimmerButton>
        </div>
        <p className="mt-10 text-[11px] text-muted/60">
          Poke the ghost. Art by{' '}
          <a href="https://openmoji.org" target="_blank" rel="noreferrer" className="underline">OpenMoji</a> (CC BY-SA 4.0)
        </p>
      </div>
    </main>
  )
}
