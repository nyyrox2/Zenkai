import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, History, Lock, LogOut, Mail, RefreshCw, Smartphone, BookOpen, CloudCheck, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { syncNow, getLastSyncTime, formatLastSync } from '../lib/sync'
import { useHistory, useList } from '../lib/library'
import { useReading } from '../lib/reading'
import { Logo } from './Logo'
import { cn } from '../lib/utils'

const input = 'h-11 w-full rounded-xl border border-border bg-card-2 pl-10 text-base text-foreground outline-none transition placeholder:text-muted focus:border-foreground sm:text-sm'

const PERKS = [
  { icon: Smartphone, title: 'Resume on any device', text: 'Start on your phone, finish on your laptop.' },
  { icon: History, title: 'History and watchlist', text: 'Continue watching and your list stay in step.' },
  { icon: BookOpen, title: 'Manga and novels too', text: 'Your reading progress comes along.' },
]

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

/** Full sign-in / create-account panel shown to guests on the profile page. */
export function AuthPanel() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (tab === 'signup') {
      if (username.trim().length < 3) return setError('Username must be at least 3 characters.')
      if (password.length < 6) return setError('Use at least 6 characters for your password.')
    }
    setBusy(true)
    try {
      if (tab === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      } else {
        const { error, needsConfirm } = await signUp(email, password, username)
        if (error) setError(error.message)
        else if (needsConfirm) setNotice('Check your inbox and confirm your email, then sign in.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Sign in" className="grid overflow-hidden rounded-3xl border border-border bg-card/60 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-6 border-b border-border bg-card-2/50 p-6 sm:p-8 lg:border-b-0 lg:border-r">
        <Logo />
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Your library, everywhere</h1>
          <p className="mt-2 text-sm text-muted">An account is optional. Zenkai works fully without one; signing in just backs up your watch history to the cloud.</p>
        </div>
        <ul className="space-y-4">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-card">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-6 sm:p-8">
        <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-border bg-card-2/80 p-1">
          {(['signin', 'signup'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => (setTab(t), setError(null), setNotice(null))} className={cn('h-9 rounded-full text-sm font-semibold transition', tab === t ? 'bg-foreground text-background' : 'text-muted hover:text-foreground')}>
              {t === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* Google OAuth Login */}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setError(null)
            setBusy(true)
            const { error } = await signInWithGoogle()
            if (error) setError(error.message)
            setBusy(false)
          }}
          className="mb-4 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card/80 px-4 text-sm font-semibold transition hover:bg-card hover:border-accent active:scale-[0.99] disabled:opacity-60"
        >
          <GoogleIcon className="size-4" />
          <span>Continue with Google</span>
        </button>

        <div className="relative mb-5 flex items-center justify-center">
          <span className="w-full border-t border-border" />
          <span className="absolute bg-card px-3 text-[10px] font-bold uppercase tracking-wider text-muted">
            or with email
          </span>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate={false}>
          {tab === 'signup' && (
            <div>
              <label htmlFor="auth-username" className="mb-1.5 block text-xs font-semibold text-muted">Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  id="auth-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. shadow_ninja"
                  autoComplete="username"
                  className={cn(input, 'pr-4')}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-xs font-semibold text-muted">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input id="auth-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className={cn(input, 'pr-4')} />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-xs font-semibold text-muted">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input id="auth-password" type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min. 6 characters)" autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} className={cn(input, 'pr-11')} />
              <button type="button" onClick={() => setShow((p) => !p)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:text-foreground">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle className="mt-px size-4 shrink-0" /> {error}
            </p>
          )}
          {notice && (
            <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-400">
              <CheckCircle2 className="mt-px size-4 shrink-0" /> {notice}
            </p>
          )}

          <button type="submit" disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-bold text-background transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60">
            {busy ? <RefreshCw className="size-4 animate-spin" /> : <>{tab === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight className="size-4" /></>}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted">
          Just browsing?{' '}
          <button type="button" onClick={() => document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth' })} className="font-semibold text-foreground underline underline-offset-2">
            Skip to settings
          </button>
        </p>
      </div>
    </section>
  )
}

/** Account + cloud sync status for signed-in users. */
export function AccountPanel() {
  const { user, username: authUsername, signOut } = useAuth()
  const counts = [
    { label: 'Watch history', n: useHistory().length },
    { label: 'Watchlist', n: useList().length },
    { label: 'Reading', n: useReading('novel').length + useReading('manga').length },
  ]
  const [last, setLast] = useState(getLastSyncTime)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const on = () => setLast(getLastSyncTime())
    window.addEventListener('zk:sync', on)
    return () => window.removeEventListener('zk:sync', on)
  }, [])

  if (!user) return null

  const sync = async () => {
    if (busy) return
    setBusy(true)
    setResult(null)
    try {
      const r = await syncNow(user.id)
      setResult(r.success ? { ok: true, text: 'Everything is up to date.' } : { ok: false, text: r.error ?? 'Sync failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Account and sync" className="rounded-3xl border border-border bg-card/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-card-2">
            <CloudCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold truncate">
                {authUsername ? `@${authUsername}` : 'Account and sync'}
              </h2>
              {authUsername && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                  SYNCED
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
        </div>
        <button type="button" onClick={signOut} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-xs font-semibold text-muted transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 active:scale-95">
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2.5">
        {counts.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card-2/60 p-3.5">
            <dd className="font-display text-xl font-bold">{c.n}</dd>
            <dt className="text-[11px] text-muted">{c.label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Last synced: {formatLastSync(last)}</p>
          <p className="text-xs text-muted">Syncs when you sign in and once a day. Newest progress wins on every device.</p>
        </div>
        <button type="button" onClick={sync} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background transition hover:opacity-90 active:scale-95 disabled:opacity-60">
          <RefreshCw className={cn('size-4', busy && 'animate-spin')} /> {busy ? 'Syncing' : 'Sync now'}
        </button>
      </div>

      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={cn('mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs', result.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-red-500/25 bg-red-500/10 text-red-400')}>
          {result.ok ? <CheckCircle2 className="mt-px size-4 shrink-0" /> : <AlertCircle className="mt-px size-4 shrink-0" />} {result.text}
        </p>
      )}
    </section>
  )
}
