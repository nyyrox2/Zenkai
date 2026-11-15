import { supabase } from './supabase'

export interface WatchRoomRecord {
  id: string
  host_id: string
  host_username: string
  host_display_name: string
  host_avatar: string | null
  anime_id: number
  anime_title: string
  episode: number
  server: string
  audio: string
  host_only_control: boolean
  created_at: string
  updated_at: string
}

const STORAGE_CLIENT_KEY = 'zk:client_session_id'

/** Get a persistent client session ID for this browser tab/device */
export function getClientSessionId(): string {
  if (typeof window === 'undefined') return 'server_client'
  let id = localStorage.getItem(STORAGE_CLIENT_KEY)
  if (!id) {
    id = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem(STORAGE_CLIENT_KEY, id)
  }
  return id
}

/** Get the authoritative host identifier for current user (auth user ID or client session ID) */
export function getMyHostIdentifier(userId?: string): string {
  return userId || getClientSessionId()
}

/** Check if current user is the host of a room */
export function isUserRoomHost(room: WatchRoomRecord | null, userId?: string): boolean {
  if (!room) return false
  const myId = getMyHostIdentifier(userId)
  return room.host_id === myId
}

/** Save newly created watch party room to Supabase */
export async function createWatchRoom(data: {
  roomId: string
  hostId: string
  hostUsername: string
  hostDisplayName: string
  hostAvatar: string | null
  animeId: number
  animeTitle: string
  episode: number
  server: string
  audio: string
  hostOnlyControl?: boolean
}): Promise<WatchRoomRecord | null> {
  try {
    // Delete any stale rooms older than 30 mins
    void cleanExpiredWatchRooms()

    const payload = {
      id: data.roomId,
      host_id: data.hostId,
      host_username: data.hostUsername,
      host_display_name: data.hostDisplayName,
      host_avatar: data.hostAvatar,
      anime_id: data.animeId,
      anime_title: data.animeTitle,
      episode: data.episode,
      server: data.server,
      audio: data.audio,
      host_only_control: data.hostOnlyControl ?? true,
      updated_at: new Date().toISOString(),
    }

    const { data: record, error } = await supabase
      .from('watch_rooms')
      .upsert(payload)
      .select()
      .single()

    if (error) {
      console.warn('[watchRooms] createWatchRoom error:', error)
      return null
    }

    return record as WatchRoomRecord
  } catch (err) {
    console.warn('[watchRooms] createWatchRoom exception:', err)
    return null
  }
}

/** Fetch watch room from Supabase. Returns null if expired (>30 mins inactive) or not found */
export async function getWatchRoom(roomId: string): Promise<WatchRoomRecord | null> {
  const cleanId = roomId.trim().toLowerCase()
  if (!cleanId) return null

  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('watch_rooms')
      .select('*')
      .eq('id', cleanId)
      .gt('updated_at', cutoff)
      .maybeSingle()

    if (error || !data) return null
    return data as WatchRoomRecord
  } catch {
    return null
  }
}

/** Update watch room state (episode, server, audio, show, host controls) and refresh 30-min window */
export async function updateWatchRoom(
  roomId: string,
  patch: Partial<{
    episode: number
    anime_id: number
    anime_title: string
    server: string
    audio: string
    host_only_control: boolean
  }>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('watch_rooms')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', roomId)

    return !error
  } catch {
    return false
  }
}

/** Keep room alive with heartbeat, resetting 30-min inactivity countdown */
export async function touchWatchRoom(roomId: string): Promise<void> {
  try {
    await supabase
      .from('watch_rooms')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', roomId)
  } catch {
    // ignore
  }
}

/** Clean up rooms inactive for 30 minutes */
export async function cleanExpiredWatchRooms(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    await supabase.from('watch_rooms').delete().lt('updated_at', cutoff)
  } catch {
    // ignore
  }
}

/** Delete room when host leaves or disbands */
export async function deleteWatchRoom(roomId: string): Promise<void> {
  try {
    await supabase.from('watch_rooms').delete().eq('id', roomId)
  } catch {
    // ignore
  }
}
