import { supabase } from './supabase'

export interface DirectMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  created_at: string
}

export interface CallLogPayload {
  isCall: boolean
  status?: 'started' | 'ended' | 'missed' | 'declined'
  duration?: number
  timestamp?: number
}

export function parseCallMessage(content: string): CallLogPayload {
  if (!content) return { isCall: false }
  const match = content.match(/^\[CALL:(started|ended|missed|declined)(?::(\d+))?\]$/)
  if (match) {
    const status = match[1] as 'started' | 'ended' | 'missed' | 'declined'
    const num = match[2] ? Number(match[2]) : undefined
    return {
      isCall: true,
      status,
      duration: status === 'ended' ? num : undefined,
      timestamp: status === 'started' ? num : undefined,
    }
  }
  return { isCall: false }
}

export function formatCallDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

export function formatCallSummary(content: string, createdAt?: string): string {
  const parsed = parseCallMessage(content)
  if (!parsed.isCall) return content
  if (parsed.status === 'started') {
    const isOld = createdAt ? Date.now() - new Date(createdAt).getTime() > 120_000 : false
    return isOld ? '📞 Audio call' : '📞 Outgoing audio call'
  }
  if (parsed.status === 'ended') {
    return parsed.duration && parsed.duration > 0
      ? `📞 Audio call (${formatCallDuration(parsed.duration)})`
      : '📞 Audio call'
  }
  if (parsed.status === 'missed') {
    return '📞 Missed audio call'
  }
  if (parsed.status === 'declined') {
    return '📞 Declined call'
  }
  return '📞 Audio call'
}

export interface ConversationSummary {
  partnerId: string
  partnerUsername: string
  partnerDisplayName: string
  partnerAvatar: string | null
  partnerFrame: string | null
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
}

export interface PartnerProfile {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  frame: string | null
  bio?: string | null
}

/** Find a user's profile by username handle */
export async function findUserByHandle(handle: string): Promise<PartnerProfile | null> {
  const clean = handle.trim().toLowerCase().replace(/^@/, '')
  if (!clean) return null

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, frame, bio')
      .ilike('username', clean)
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name || data.username,
      avatarUrl: data.avatar_url || null,
      frame: data.frame || null,
      bio: data.bio || null,
    }
  } catch (err) {
    console.error('[Messages] findUserByHandle error:', err)
    return null
  }
}

/** Find a user's profile by uuid */
export async function findUserById(id: string): Promise<PartnerProfile | null> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, frame, bio')
      .eq('id', id)
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name || data.username,
      avatarUrl: data.avatar_url || null,
      frame: data.frame || null,
      bio: data.bio || null,
    }
  } catch {
    return null
  }
}

/** Fetch all active conversations and summaries for the logged-in user */
export async function fetchConversations(myUserId: string): Promise<ConversationSummary[]> {
  try {
    const { data: messages, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${myUserId},receiver_id.eq.${myUserId}`)
      .order('created_at', { ascending: false })
      .limit(300)

    if (error || !messages || messages.length === 0) return []

    // Map by partner ID
    const partnerMap = new Map<string, { lastMsg: DirectMessage; unread: number }>()

    for (const m of messages as DirectMessage[]) {
      const partnerId = m.sender_id === myUserId ? m.receiver_id : m.sender_id
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, {
          lastMsg: m,
          unread: m.receiver_id === myUserId && !m.read ? 1 : 0,
        })
      } else {
        const item = partnerMap.get(partnerId)!
        if (m.receiver_id === myUserId && !m.read) {
          item.unread += 1
        }
      }
    }

    const partnerIds = Array.from(partnerMap.keys())
    if (partnerIds.length === 0) return []

    // Fetch partner profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, frame')
      .in('id', partnerIds)

    const profileLookup = new Map<string, any>()
    if (profiles) {
      for (const p of profiles) {
        profileLookup.set(p.id, p)
      }
    }

    const results: ConversationSummary[] = []
    for (const [partnerId, info] of partnerMap.entries()) {
      const p = profileLookup.get(partnerId)
      const username = p?.username || `user_${partnerId.slice(0, 6)}`
      const displayName = p?.display_name || username
      results.push({
        partnerId,
        partnerUsername: username,
        partnerDisplayName: displayName,
        partnerAvatar: p?.avatar_url || null,
        partnerFrame: p?.frame || null,
        lastMessage: formatCallSummary(info.lastMsg.content, info.lastMsg.created_at),
        lastMessageAt: info.lastMsg.created_at,
        unreadCount: info.unread,
      })
    }

    return results
  } catch (err) {
    console.error('[Messages] fetchConversations error:', err)
    return []
  }
}

/** Mark all unread messages from a partner as read */
export async function markConversationAsRead(myUserId: string, partnerId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('direct_messages')
      .update({ read: true })
      .eq('sender_id', partnerId)
      .eq('receiver_id', myUserId)
      .eq('read', false)

    if (error) {
      console.error('[Messages] markConversationAsRead error:', error)
      return false
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zk:dm_read', { detail: { partnerId } }))
    }
    return true
  } catch (err) {
    console.error('[Messages] markConversationAsRead exception:', err)
    return false
  }
}

/** Mark all incoming unread messages as read */
export async function markAllMessagesAsRead(myUserId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('direct_messages')
      .update({ read: true })
      .eq('receiver_id', myUserId)
      .eq('read', false)

    if (error) {
      console.error('[Messages] markAllMessagesAsRead error:', error)
      return false
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zk:dm_read', { detail: { all: true } }))
    }
    return true
  } catch (err) {
    console.error('[Messages] markAllMessagesAsRead exception:', err)
    return false
  }
}

/** Fetch direct message stream between two users */
export async function fetchMessagesWith(myUserId: string, partnerId: string): Promise<DirectMessage[]> {
  try {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${myUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myUserId})`
      )
      .order('created_at', { ascending: true })

    if (error) throw error

    // Immediately mark incoming messages from this partner as read
    void markConversationAsRead(myUserId, partnerId)

    return (data as DirectMessage[]) || []
  } catch (err) {
    console.error('[Messages] fetchMessagesWith error:', err)
    return []
  }
}

/** Send a direct message to a partner */
export async function sendDirectMessage(
  senderId: string,
  receiverId: string,
  content: string
): Promise<DirectMessage | null> {
  const text = content.trim()
  if (!text) return null

  try {
    const { data, error } = await supabase
      .from('direct_messages')
      .insert([
        {
          sender_id: senderId,
          receiver_id: receiverId,
          content: text,
          read: false,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return data as DirectMessage
  } catch (err) {
    console.error('[Messages] sendDirectMessage error:', err)
    throw err
  }
}

/** Get total unread count for current user */
export async function getUnreadDmCount(myUserId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', myUserId)
      .eq('read', false)

    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}
