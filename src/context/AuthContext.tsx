import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { toast } from '../lib/toast'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  username?: string
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, username?: string) => Promise<{ error: Error | null; needsConfirm?: boolean }>
  updateUsername: (username: string) => Promise<{ error: Error | null }>
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (!error && s) {
        setSession(s)
        setUser(s.user)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      setSession(data.session)
      setUser(data.user)
      toast('Signed in successfully!')
      return { error: null }
    } catch (err: any) {
      const msg = err?.message || 'Failed to sign in'
      toast(msg)
      return { error: err }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, username?: string) => {
    try {
      const u = username?.trim()
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: u ? { data: { username: u } } : undefined,
      })
      if (error) throw error

      // If user signed up and session is active, also ensure user_sync has username
      if (data.user?.id && u) {
        try {
          await supabase.from('user_sync').upsert({
            user_id: data.user.id,
            username: u,
            updated_at: new Date().toISOString(),
          })
        } catch {
          // ignore background sync errors
        }
      }

      const needsConfirm = !data.session && !!data.user
      if (needsConfirm) {
        toast('Account created! Please check your email to confirm.')
      } else {
        setSession(data.session)
        setUser(data.user)
        toast('Account created and signed in!')
      }
      return { error: null, needsConfirm }
    } catch (err: any) {
      const msg = err?.message || 'Failed to sign up'
      toast(msg)
      return { error: err }
    }
  }, [])

  const updateUsername = useCallback(async (username: string) => {
    try {
      const u = username.trim()
      const { data, error } = await supabase.auth.updateUser({
        data: { username: u },
      })
      if (error) throw error
      setUser(data.user)
      if (data.user?.id) {
        try {
          await supabase.from('user_sync').upsert({
            user_id: data.user.id,
            username: u,
            updated_at: new Date().toISOString(),
          })
        } catch {
          // ignore
        }
      }
      toast('Username updated!')
      return { error: null }
    } catch (err: any) {
      const msg = err?.message || 'Failed to update username'
      toast(msg)
      return { error: err }
    }
  }, [])

  const signInWithOtp = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      })
      if (error) throw error
      toast('Magic link sent to your email!')
      return { error: null }
    } catch (err: any) {
      const msg = err?.message || 'Failed to send magic link'
      toast(msg)
      return { error: err }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      toast('Signed out')
    } catch (err: any) {
      toast(err?.message || 'Error signing out')
    }
  }, [])

  const username = user?.user_metadata?.username as string | undefined

  const value = useMemo(
    () => ({ user, session, loading, username, signIn, signUp, updateUsername, signInWithOtp, signOut }),
    [user, session, loading, username, signIn, signUp, updateUsername, signInWithOtp, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
