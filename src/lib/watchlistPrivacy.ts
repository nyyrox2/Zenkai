import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { toast } from './toast'

const KEY = 'zk:watchlist_private'
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Your own watchlist-privacy setting. Stored in `profiles.watchlist_private`; the server then withholds the data from visitors. */
export function useWatchlistPrivacy(userId: string | undefined) {
  const [priv, setPriv] = useState(read)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!userId) return
    let alive = true
    supabase
      .from('profiles')
      .select('watchlist_private')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive || error || !data) return
        const v = !!(data as { watchlist_private?: boolean }).watchlist_private
        setPriv(v)
        try { localStorage.setItem(KEY, v ? '1' : '0') } catch {}
      })
    return () => {
      alive = false
    }
  }, [userId])

  const set = useCallback(
    async (next: boolean) => {
      if (!userId || busy) return
      setBusy(true)
      const prev = priv
      setPriv(next)
      let { error } = await supabase.from('profiles').update({ watchlist_private: next }).eq('id', userId)
      if (error) {
        const res2 = await supabase.from('profiles').update({ is_watchlist_private: next }).eq('id', userId)
        error = res2.error
      }
      if (error) {
        setPriv(prev)
        toast('Could not save that setting. Run supabase/watchlist_privacy.sql first.', 'error')
      } else {
        try { localStorage.setItem(KEY, next ? '1' : '0') } catch {}
        toast(next ? 'Your watchlist is now private' : 'Your watchlist is now public', 'info')
      }
      setBusy(false)
    },
    [userId, busy, priv],
  )

  return { priv, busy, set }
}
