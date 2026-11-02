import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Sparkles, AlertCircle, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function ChooseUsernameModal() {
  const { user, username: currentUsername, updateUsername } = useAuth()
  const [handle, setHandle] = useState('')
  const [checking, setChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [closed, setClosed] = useState(false)

  // Check if handle was already chosen / confirmed on this account or device
  const isLocallyChosen = user?.id
    ? typeof window !== 'undefined' && localStorage.getItem(`zk:username_chosen:${user.id}`) === 'true'
    : false
  const alreadyChosen = Boolean(user?.user_metadata?.username_chosen) || isLocallyChosen

  // Check if user already has an existing username in Supabase profiles
  useEffect(() => {
    if (!user?.id || alreadyChosen) return
    let alive = true
    void (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()
        if (!alive) return
        if (data?.username) {
          try {
            localStorage.setItem(`zk:username_chosen:${user.id}`, 'true')
          } catch {}
          setClosed(true)
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      alive = false
    }
  }, [user?.id, alreadyChosen])

  // Default suggested handle from current username or email prefix
  useEffect(() => {
    if (!alreadyChosen && !handle) {
      const initial = currentUsername || user?.email?.split('@')[0] || ''
      if (initial) {
        setHandle(initial.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20))
      }
    }
  }, [alreadyChosen, currentUsername, user?.email, handle])

  // Validate and check availability in Supabase profiles table
  useEffect(() => {
    const clean = handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (clean.length < 3) {
      setIsAvailable(null)
      setStatusMsg(clean.length > 0 ? 'Minimum 3 characters required' : '')
      return
    }

    let alive = true
    setChecking(true)
    const t = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', clean)
          .maybeSingle()

        if (!alive) return
        setChecking(false)

        if (error) {
          setIsAvailable(true)
          setStatusMsg('')
          return
        }

        if (data && data.id !== user?.id) {
          setIsAvailable(false)
          setStatusMsg(`@${clean} is already taken`)
        } else {
          setIsAvailable(true)
          setStatusMsg(`@${clean} is available!`)
        }
      } catch {
        if (alive) {
          setChecking(false)
          setIsAvailable(true)
        }
      }
    }, 250)

    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [handle, user?.id])

  if (closed || !user || alreadyChosen) return null

  const clean = handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  const isValid = clean.length >= 3 && isAvailable === true && !checking

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || saving) return
    setSaving(true)
    try {
      if (user?.id) {
        try {
          await supabase
            .from('profiles')
            .upsert({ id: user.id, username: clean, updated_at: new Date().toISOString() }, { onConflict: 'id' })
          await supabase
            .from('user_sync')
            .upsert({ user_id: user.id, username: clean, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          localStorage.setItem(`zk:username_chosen:${user.id}`, 'true')
        } catch {}
      }
      await updateUsername(clean)
      setClosed(true)
    } catch (err) {
      console.error('[ChooseUsernameModal] error:', err)
      if (user?.id) {
        try {
          localStorage.setItem(`zk:username_chosen:${user.id}`, 'true')
        } catch {}
      }
      setClosed(true)
    } finally {
      setSaving(false)
    }
  }

  const handleDismissCurrent = () => {
    if (user?.id) {
      try {
        localStorage.setItem(`zk:username_chosen:${user.id}`, 'true')
      } catch {}
    }
    setClosed(true)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] grid place-items-center bg-black/85 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl shadow-black/60"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={handleDismissCurrent}
            aria-label="Close dialog"
            className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted transition hover:bg-card-2 hover:text-foreground active:scale-90"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-accent/20 text-accent">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Choose Your Handle</h2>
              <p className="text-xs text-muted">Compulsory profile setup</p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            Welcome to Zenkai! Every member has a unique <span className="font-semibold text-foreground">@username</span> handle for their public profile and community chat. Pick yours to continue:
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Pick Your @Username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-accent">
                  @
                </span>
                <input
                  type="text"
                  autoFocus
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  maxLength={20}
                  placeholder="your_handle"
                  className="h-12 w-full rounded-2xl border border-border bg-card-2 pl-8 pr-12 text-sm font-bold text-foreground outline-none transition focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  {checking ? (
                    <Loader2 className="size-4 animate-spin text-muted" />
                  ) : isAvailable === true ? (
                    <Check className="size-4 text-emerald-400" />
                  ) : isAvailable === false ? (
                    <AlertCircle className="size-4 text-rose-400" />
                  ) : (
                    <span className="text-xs text-muted">{handle.length}/20</span>
                  )}
                </div>
              </div>

              {statusMsg && (
                <p className={`mt-2 text-xs font-semibold ${isAvailable ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {statusMsg}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isValid || saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent font-display text-sm font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Activating handle…</span>
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  <span>Confirm & Set @{clean || 'username'}</span>
                </>
              )}
            </button>

            {currentUsername ? (
              <button
                type="button"
                onClick={handleDismissCurrent}
                className="w-full text-center text-xs text-muted hover:text-foreground transition underline pt-1"
              >
                Keep @{currentUsername} and continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDismissCurrent}
                className="w-full text-center text-xs text-muted hover:text-foreground transition underline pt-1"
              >
                Skip for now and continue
              </button>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
