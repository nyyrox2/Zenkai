import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface RankedUser {
  id: string
  username: string
  name: string
  avatar: string | null
  frame: string | null
  level: number
  totalXp: number
}

// ponytail: in-memory cache with TTL, shared by every leaderboard on screen; upgrade to a DB view/RPC if the table gets huge
const TTL = 5 * 60_000
let cache: { at: number; rows: RankedUser[] } | null = null
let inflight: Promise<RankedUser[]> | null = null

export function fetchLeaderboard(): Promise<RankedUser[]> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.rows)
  inflight ??= Promise.resolve(
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, frame, level, total_xp')
      .not('username', 'is', null)
      .gt('total_xp', 0)
      .order('total_xp', { ascending: false })
      .limit(50),
  )
    .then(({ data, error }) => {
      if (error) throw error
      const rows = (data || []).map((r: any) => ({
        id: r.id,
        username: r.username,
        name: r.display_name || r.username,
        avatar: r.avatar_url || null,
        frame: r.frame || null,
        level: Number(r.level) || 1,
        totalXp: Number(r.total_xp) || 0,
      }))
      cache = { at: Date.now(), rows }
      return rows
    })
    .finally(() => { inflight = null })
  return inflight
}

export function useLeaderboard() {
  const [rows, setRows] = useState<RankedUser[] | null>(cache?.rows ?? null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    fetchLeaderboard().then((r) => live && setRows(r)).catch(() => live && setFailed(true))
    return () => { live = false }
  }, [])
  return { rows, loading: !rows && !failed, failed }
}
