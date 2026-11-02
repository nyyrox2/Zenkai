import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, History, Lock, LogOut, Mail, RefreshCw, Smartphone, BookOpen, CloudCheck } from 'lucide-react'
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

/** Full sign-in / create-account panel shown to guests at the top of the profile page. */
export function AuthPanel() {
  const { signIn, signUp } = useAuth()
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (tab === 'signup' && password.length < 6) return setError('Use at least 6 characters for your password.')
    setBusy(true)
    try {
      if (tab === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      } else {
        const { error, needsConfirm } = await signUp(email, password)
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
          <p className="mt-2 text-sm text-muted">An account is optional. Zenkai works fully without one; signing in just backs up your progress.</p>
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
        <div role="tablist" className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-border bg-card-2/80 p-1">
          {(['signin', 'signup'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => (setTab(t), setError(null), setNotice(null))} className={cn('h-9 rounded-full text-sm font-semibold transition', tab === t ? 'bg-foreground text-background' : 'text-muted hover:text-foreground')}>
              {t === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate={false}>
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
              <input id="auth-password" type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} className={cn(input, 'pr-11')} />
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
  const { user, signOut } = useAuth()
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
            <h2 className="font-display text-lg font-bold">Account and sync</h2>
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
