import { supabase } from './supabase'
import type { HistoryItem, ListItem } from './library'
import type { ReadingItem } from './reading'
import { getProfile, saveProfile, syncProfileToCloud, type Profile } from './profile'

export const LAST_SYNC_KEY = 'zk:cloud:last_sync'
const ONE_DAY_MS = 24 * 60 * 60 * 1000 // 24 hours (once a day)

/** Turn Supabase/network failures into something actionable. */
function explain(e: any): string {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return 'Cloud is not configured: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing from this build.'
  const t = `${e?.code ?? ''} ${e?.message ?? ''}`
  if (/42P01|PGRST205|does not exist|schema cache/i.test(t)) return 'The user_sync table is missing in Supabase. Run the setup SQL, then try again.'
  if (/42501|row-level security|permission denied/i.test(t)) return 'Supabase refused access: check the row-level security policies on user_sync.'
  if (/failed to fetch|networkerror|load failed/i.test(t)) return 'Could not reach the cloud. Check your connection.'
  return e?.message || 'Sync failed'
}

/** Safely parse JSON from localStorage */
function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** Get the last sync timestamp in ms */
export function getLastSyncTime(): number | null {
  try {
    const v = localStorage.getItem(LAST_SYNC_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

/** Format last sync time into a human readable string */
export function formatLastSync(t: number | null): string {
  if (!t) return 'Never synced'
  const diff = Date.now() - t
  if (diff < 60_000) return 'Just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 24 * 3600_000) {
    const date = new Date(t)
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  const date = new Date(t)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * PUSH local watch history, watchlist, reading & profile to Supabase.
 * Updates local cache timestamp and only makes 1 request.
 */
export async function pushWatchHistory(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!userId) throw new Error('Not logged in')

    const history = readStorage<HistoryItem[]>('zk:history', [])
    const watchlist = readStorage<ListItem[]>('zk:list', [])
    const custom_lists = readStorage<any[]>('zk:custom_lists', [])
    const reading = readStorage<ReadingItem[]>('zk:reading:v1', [])
    const profile = getProfile()

    const { error } = await supabase.from('user_sync').upsert(
      { user_id: userId, history, watchlist, custom_lists, reading, profile, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

    if (error) throw error

    // Also sync to public.profiles table
    void syncProfileToCloud(userId, undefined, profile)

    const now = Date.now()
    localStorage.setItem(LAST_SYNC_KEY, String(now))
    window.dispatchEvent(new CustomEvent('zk:sync', { detail: { type: 'push', time: now } }))

    return { success: true, count: history.length }
  } catch (err: any) {
    console.error('[Sync] Push error:', err)
    return { success: false, count: 0, error: explain(err) }
  }
}

/**
 * PULL watch history from Supabase and merge it with local storage.
 * Local storage remains main; newer items take priority.
 */
export async function pullWatchHistory(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!userId) throw new Error('Not logged in')

    const { data, error } = await supabase
      .from('user_sync')
      .select('history, watchlist, custom_lists, reading, profile, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    if (!data) return { success: true, count: 0 } // first sync from this account: nothing to merge yet

    // Merge profile if returned
    if (data.profile && typeof data.profile === 'object') {
      const p = data.profile as Profile
      const local = getProfile()
      saveProfile({
        name: local.name || p.name || '',
        avatar: local.avatar || p.avatar || null,
        banner: local.banner || p.banner || null,
        frame: local.frame || p.frame || null,
        bio: (local.bio !== undefined && local.bio !== '') ? local.bio : (p.bio || ''),
      })
    }

    const remoteHistory = Array.isArray(data.history) ? (data.history as HistoryItem[]) : []
    const remoteList = Array.isArray(data.watchlist) ? (data.watchlist as ListItem[]) : []
    const remoteReading = Array.isArray(data.reading) ? (data.reading as ReadingItem[]) : []
    const remoteCustomLists = Array.isArray(data.custom_lists) ? data.custom_lists : []

    // 0. Merge Custom Lists
    if (remoteCustomLists.length > 0) {
      const localCl = readStorage<any[]>('zk:custom_lists', [])
      const clMap = new Map<string, any>()
      for (const cl of localCl) if (cl?.id) clMap.set(cl.id, cl)
      for (const rcl of remoteCustomLists) if (rcl?.id && !clMap.has(rcl.id)) clMap.set(rcl.id, rcl)
      localStorage.setItem('zk:custom_lists', JSON.stringify(Array.from(clMap.values())))
    }

    // 1. Merge History (Continue Watching)
    const localHistory = readStorage<HistoryItem[]>('zk:history', [])
    const historyMap = new Map<number, HistoryItem>()
    for (const h of localHistory) {
      if (h && h.id) historyMap.set(Number(h.id), h)
    }
    for (const rh of remoteHistory) {
      if (!rh || !rh.id) continue
      const nid = Number(rh.id)
      const existing = historyMap.get(nid)
      if (!existing || (rh.t || 0) > (existing.t || 0)) {
        historyMap.set(nid, rh)
      }
    }
    const mergedHistory = Array.from(historyMap.values())
      .sort((a, b) => (Number(b.t) || 0) - (Number(a.t) || 0))
      .slice(0, 100)

    localStorage.setItem('zk:history', JSON.stringify(mergedHistory))

    // 2. Merge Watchlist
    const localList = readStorage<ListItem[]>('zk:list', [])
    const listMap = new Map<number, ListItem>()
    for (const item of localList) {
      if (item && item.id) listMap.set(Number(item.id), item)
    }
    for (const ri of remoteList) {
      if (!ri || !ri.id) continue
      const nid = Number(ri.id)
      const existing = listMap.get(nid)
      if (!existing) {
        listMap.set(nid, ri)
      } else {
        const remoteTime = Number(ri.updatedAt ?? ri.addedAt) || 0
        const localTime = Number(existing.updatedAt ?? existing.addedAt) || 0
        if (remoteTime > localTime || (ri.progress || 0) > (existing.progress || 0)) {
          listMap.set(nid, { ...existing, ...ri })
        }
      }
    }
    const mergedList = Array.from(listMap.values())
    localStorage.setItem('zk:list', JSON.stringify(mergedList))

    // 3. Merge Reading (Novels / Manga)
    const localReading = readStorage<ReadingItem[]>('zk:reading:v1', [])
    const readingMap = new Map<string, ReadingItem>()
    for (const r of localReading) {
      if (r && r.id) readingMap.set(`${r.kind}:${r.id}`, r)
    }
    for (const rr of remoteReading) {
      if (!rr || !rr.id) continue
      const key = `${rr.kind}:${rr.id}`
      const existing = readingMap.get(key)
      if (!existing || (rr.t || 0) > (existing.t || 0)) {
        readingMap.set(key, rr)
      }
    }
    const mergedReading = Array.from(readingMap.values())
      .sort((a, b) => (Number(b.t) || 0) - (Number(a.t) || 0))
      .slice(0, 50)
    localStorage.setItem('zk:reading:v1', JSON.stringify(mergedReading))

    // 4. Update sync timestamp and notify listeners
    const now = Date.now()
    localStorage.setItem(LAST_SYNC_KEY, String(now))

    // Notify all cells (zk:history, zk:list, zk:reading:v1, zk:profile) across the app to reload
    window.dispatchEvent(new StorageEvent('storage', { key: 'zk:history' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'zk:list' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'zk:reading:v1' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'zk:profile' }))
    window.dispatchEvent(new CustomEvent('zk:sync', { detail: { type: 'pull', time: now } }))

    return { success: true, count: mergedHistory.length }
  } catch (err: any) {
    console.error('[Sync] Pull error:', err)
    return { success: false, count: 0, error: explain(err) }
  }
}

/** Two-way sync: merge the cloud into this device first, then upload the merged result (never overwrites the cloud with a stale device). */
export async function syncNow(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
  const pulled = await pullWatchHistory(userId)
  return pulled.success ? pushWatchHistory(userId) : pulled
}

/**
 * Checks if the daily sync is due (>= 24h since last sync).
 * If due and user is signed in, pushes current local state to cloud.
 * Returns true if a sync request was made, false otherwise.
 */
export async function checkDailySync(userId?: string): Promise<boolean> {
  if (!userId) return false

  const lastSync = getLastSyncTime()
  const now = Date.now()

  // If synced within the last 24h, skip! 0 network requests made.
  if (lastSync && now - lastSync < ONE_DAY_MS) {
    return false
  }

  return (await syncNow(userId)).success
}

let autoSyncTimeout: any = null
export function autoSyncWatchlist() {
  clearTimeout(autoSyncTimeout)
  autoSyncTimeout = setTimeout(async () => {
    try {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) {
        await pushWatchHistory(data.user.id)
      }
    } catch (err) {
      console.warn('[Sync] Auto-sync background error:', err)
    }
  }, 600)
}
