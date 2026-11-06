import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { setProfileStore, resetProfileStore } from '../lib/profile'
import { toast } from '../lib/toast'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  username?: string
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, username?: string) => Promise<{ error: Error | null; needsConfirm?: boolean }>
  updateUsername: (username: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileUsername, setProfileUsername] = useState<string | null>(null)

  // Sync Supabase `profiles` into state and local store whenever user signs in
  const syncProfile = useCallback(async (u: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .maybeSingle()

      const userOAuthName = u.user_metadata?.full_name || u.user_metadata?.name || ''
      const userOAuthAvatar = u.user_metadata?.avatar_url || u.user_metadata?.picture || null
      const fallbackHandle =
        (u.user_metadata?.username as string) ||
        (u.email ? u.email.split('@')[0] : `user_${u.id.slice(0, 6)}`)
      const cleanHandle = fallbackHandle.toLowerCase().replace(/[^a-z0-9_-]/g, '')

      if (!error && data) {
        const assignedHandle = data.username || cleanHandle
        setProfileUsername(assignedHandle)
        setProfileStore({
          name: data.display_name || userOAuthName || assignedHandle,
          avatar: data.avatar_url || userOAuthAvatar,
          banner: data.banner_url || null,
          frame: data.frame || null,
          bio: data.bio || '',
        })
      } else {
        // First login for this account: initialize with this account's credentials
        setProfileUsername(cleanHandle)
        const initialProfile = {
          name: userOAuthName || cleanHandle,
          avatar: userOAuthAvatar,
          banner: null,
          frame: null,
          bio: '',
        }
        setProfileStore(initialProfile)

        await supabase.from('profiles').upsert(
          {
            id: u.id,
            username: cleanHandle,
            display_name: initialProfile.name,
            avatar_url: initialProfile.avatar,
            banner_url: null,
            frame: null,
            bio: '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
      }
    } catch (err) {
      console.warn('[AuthContext] syncProfile failed:', err)
    }
  }, [])

  useEffect(() => {
    // 1. Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: s }, error }) => {
        if (error) {
          // If stored refresh token was revoked or invalid, cleanly purge local storage
          if (error.message?.includes('Refresh Token') || (error as any).status === 400) {
            void supabase.auth.signOut({ scope: 'local' }).catch(() => {})
          }
        } else if (s) {
          setSession(s)
          setUser(s.user)
          void syncProfile(s.user)
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })

    // 2. Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        void syncProfile(s.user)
      } else {
        setProfileUsername(null)
        resetProfileStore()
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [syncProfile])

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        setSession(data.session)
        setUser(data.user)
        if (data.user) void syncProfile(data.user)
        toast('Signed in successfully!')
        return { error: null }
      } catch (err: any) {
        const msg = err?.message || 'Failed to sign in'
        toast(msg)
        return { error: err }
      }
    },
    [syncProfile]
  )

  const signUp = useCallback(
    async (email: string, password: string, username?: string) => {
      try {
        const u = username?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: u ? { data: { username: u, username_chosen: true } } : undefined,
        })
        if (error) throw error

        if (data.user?.id && u) {
          try {
            localStorage.setItem(`zk:username_chosen:${data.user.id}`, 'true')
            await supabase.from('profiles').upsert(
              {
                id: data.user.id,
                username: u,
                display_name: u,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            )
            await supabase.from('user_sync').upsert({
              user_id: data.user.id,
              username: u,
              updated_at: new Date().toISOString(),
            })
          } catch {
            // ignore
          }
        }

        const needsConfirm = !data.session && !!data.user
        if (needsConfirm) {
          toast('Account created! Please check your email to confirm.')
        } else {
          setSession(data.session)
          setUser(data.user)
          if (data.user) void syncProfile(data.user)
          toast('Account created and signed in!')
        }
        return { error: null, needsConfirm }
      } catch (err: any) {
        const msg = err?.message || 'Failed to sign up'
        toast(msg)
        return { error: err }
      }
    },
    [syncProfile]
  )

  const updateUsername = useCallback(async (newUsername: string) => {
    try {
      const u = newUsername.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
      if (u.length < 3) {
        throw new Error('Username must be at least 3 characters')
      }

      const { data, error } = await supabase.auth.updateUser({
        data: { username: u, username_chosen: true },
      })
      if (error) throw error
      if (data.user) {
        setUser(data.user)
        try {
          localStorage.setItem(`zk:username_chosen:${data.user.id}`, 'true')
        } catch {}
      }
      setProfileUsername(u)

      if (data.user?.id) {
        try {
          await supabase
            .from('profiles')
            .upsert({ id: data.user.id, username: u, updated_at: new Date().toISOString() }, { onConflict: 'id' })
          await supabase
            .from('user_sync')
            .upsert({ user_id: data.user.id, username: u, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        } catch {
          // ignore
        }
      }
      toast(`Username updated to @${u}!`)
      return { error: null }
    } catch (err: any) {
      const msg = err?.message || 'Failed to update username'
      toast(msg, 'error')
      return { error: err }
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/profile`,
        },
      })
      if (error) throw error
      return { error: null }
    } catch (err: any) {
      const msg = err?.message || 'Failed to initialize Google login'
      toast(msg, 'error')
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
      toast(msg, 'error')
      return { error: err }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      if (user?.id) {
        try {
          localStorage.removeItem(`zk:username_chosen:${user.id}`)
        } catch {}
      }
      localStorage.removeItem('zk_my_sent_msgs')
      resetProfileStore()
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setProfileUsername(null)
      toast('Signed out')
    } catch (err: any) {
      toast(err?.message || 'Error signing out', 'error')
    }
  }, [user?.id])

  const username =
    profileUsername ||
    (user?.user_metadata?.username as string | undefined) ||
    (user?.email ? user.email.split('@')[0] : undefined)

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      username,
      signIn,
      signUp,
      updateUsername,
      signInWithGoogle,
      signInWithOtp,
      signOut,
    }),
    [user, session, loading, username, signIn, signUp, updateUsername, signInWithGoogle, signInWithOtp, signOut]
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
