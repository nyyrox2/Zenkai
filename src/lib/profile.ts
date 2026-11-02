import { useSyncExternalStore } from 'react'
import { cell } from './library'
import { supabase } from './supabase'

/** Local and cloud profile interface */
export interface Profile {
  name: string
  avatar: string | null
  banner: string | null
  frame: string | null
  bio?: string | null
}

export interface PublicUserData {
  id?: string
  username: string
  profile: Profile
  watchlistCount?: number
  historyCount?: number
  readingCount?: number
  createdAt?: string
  updatedAt?: string
}

const empty: Profile = { name: '', avatar: null, banner: null, frame: null, bio: '' }
const store = cell<Profile>('zk:profile', empty)

export const useProfile = () => useSyncExternalStore(store.subscribe, store.get)
export const getProfile = () => store.get()
export const resetProfileStore = () => store.set(empty)
export const setProfileStore = (p: Profile) => store.set(p)

/**
 * Save profile locally and asynchronously push changes to Supabase profiles & user_sync
 * if user is currently signed in.
 */
export const saveProfile = (p: Partial<Profile>) => {
  const current = store.get()
  const updated = { ...current, ...p }
  store.set(updated)

  // Asynchronously sync to Supabase if session exists
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user?.id) {
      void syncProfileToCloud(session.user.id, undefined, updated)
    }
  }).catch(() => {})
}

/**
 * Push profile details to Supabase `profiles` and `user_sync` tables.
 */
export async function syncProfileToCloud(userId: string, username?: string, p?: Partial<Profile>) {
  try {
    const current = { ...store.get(), ...p }
    const cleanUsername = username?.trim().toLowerCase().replace(/^@/, '')

    const payload: Record<string, any> = {
      id: userId,
      display_name: current.name || null,
      avatar_url: current.avatar || null,
      banner_url: current.banner || null,
      frame: current.frame || null,
      bio: current.bio ?? '',
      updated_at: new Date().toISOString(),
    }
    if (cleanUsername) {
      payload.username = cleanUsername
    }

    // 1. Update public.profiles
    await supabase.from('profiles').upsert(payload, { onConflict: 'id' })

    // 2. Keep user_sync profile field in sync
    const syncPayload: Record<string, any> = {
      user_id: userId,
      profile: current,
      updated_at: new Date().toISOString(),
    }
    if (cleanUsername) {
      syncPayload.username = cleanUsername
    }
    await supabase.from('user_sync').upsert(syncPayload, { onConflict: 'user_id' })
  } catch (err) {
    console.warn('[Profile] Cloud sync error:', err)
  }
}

/**
 * Pull profile from Supabase `profiles` for a user and update local cache.
 */
export async function pullProfileFromCloud(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null

    const remote: Profile = {
      name: data.display_name || '',
      avatar: data.avatar_url || null,
      banner: data.banner_url || null,
      frame: data.frame || null,
      bio: data.bio || '',
    }

    const current = store.get()
    // Prefer remote if populated, or preserve non-empty local fields
    const merged: Profile = {
      name: current.name || remote.name,
      avatar: current.avatar || remote.avatar,
      banner: current.banner || remote.banner,
      frame: current.frame || remote.frame,
      bio: current.bio || remote.bio,
    }

    store.set(merged)
    return merged
  } catch {
    return null
  }
}

/**
 * Fetch a public user profile from Supabase by username handle.
 * Queries `public.profiles` first, with graceful fallback to `user_sync`.
 */
export async function fetchPublicProfile(username: string): Promise<PublicUserData | null> {
  const clean = username.trim().toLowerCase().replace(/^@/, '')
  if (!clean) return null

  try {
    // 1. Check public.profiles table
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, banner_url, frame, bio, created_at, updated_at')
      .ilike('username', clean)
      .maybeSingle()

    let userId = profileRow?.id
    let displayName = profileRow?.display_name || profileRow?.username || clean
    let avatarUrl = profileRow?.avatar_url || null
    let bannerUrl = profileRow?.banner_url || null
    let frame = profileRow?.frame || null
    let bio = profileRow?.bio || ''
    let createdAt = profileRow?.created_at
    let updatedAt = profileRow?.updated_at

    // 2. Fallback to user_sync if not found in profiles table
    if (!profileRow) {
      const { data: syncRow } = await supabase
        .from('user_sync')
        .select('user_id, username, profile, updated_at')
        .ilike('username', clean)
        .maybeSingle()

      if (!syncRow) return null

      userId = syncRow.user_id
      const p = (syncRow.profile as Profile) || empty
      displayName = p.name || syncRow.username
      avatarUrl = p.avatar || null
      bannerUrl = p.banner || null
      frame = p.frame || null
      bio = p.bio || ''
      updatedAt = syncRow.updated_at
    }

    // 3. Query stats from user_sync
    let watchlistCount = 0
    let historyCount = 0
    let readingCount = 0

    if (userId) {
      const { data: stats } = await supabase
        .from('user_sync')
        .select('watchlist, history, reading')
        .eq('user_id', userId)
        .maybeSingle()

      if (stats) {
        watchlistCount = Array.isArray(stats.watchlist) ? stats.watchlist.length : 0
        historyCount = Array.isArray(stats.history) ? stats.history.length : 0
        readingCount = Array.isArray(stats.reading) ? stats.reading.length : 0
      }
    }

    return {
      id: userId,
      username: profileRow?.username || clean,
      profile: {
        name: displayName,
        avatar: avatarUrl,
        banner: bannerUrl,
        frame,
        bio,
      },
      watchlistCount,
      historyCount,
      readingCount,
      createdAt,
      updatedAt,
    }
  } catch (err) {
    console.error('[Profile] fetchPublicProfile error:', err)
    return null
  }
}

/** Crop-to-fill resize of an uploaded image into a compressed data: url, so it fits in localStorage. */
export async function readImage(file: File, w: number, h: number): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  if (file.size > 12 * 1048576) throw new Error('Image is too large (12 MB max).')
  const bmp = await createImageBitmap(file).catch(() => {
    throw new Error('Could not read that image.')
  })
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const k = Math.max(w / bmp.width, h / bmp.height)
  const dw = bmp.width * k
  const dh = bmp.height * k
  c.getContext('2d')!.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh)
  bmp.close()
  return c.toDataURL('image/jpeg', 0.85)
}
