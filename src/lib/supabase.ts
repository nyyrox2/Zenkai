import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set; community and reports are disabled.')
}

export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_ANON_KEY || 'placeholder')

export interface CommunityPost {
  id: string
  created_at: string
  user_id?: string | null
  username: string
  avatar_url: string | null
  frame?: string | null
  title: string
  content: string
  category: string
  anime_title: string | null
  anime_id: string | null
  anime_image?: string | null
  likes: number
  pinned: boolean
  edited?: boolean
}

export interface StreamReport {
  id?: string
  created_at?: string
  anime_id?: string | null
  anime_title: string
  episode: string
  server?: string
  audio_type?: string
  issue_type: string
  details?: string
  playback_time?: string
  status?: string
}

export async function getCommunityPosts(category?: string, limit = 150): Promise<CommunityPost[]> {
  try {
    let query = supabase
      .from('community_posts')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (category && category !== 'All') {
      query = query.eq('category', category)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.warn('[Supabase] Failed to fetch community posts:', err)
    return []
  }
}

export async function createCommunityPost(post: {
  title: string
  content: string
  user_id?: string | null
  username?: string
  avatar_url?: string | null
  frame?: string | null
  category?: string
  anime_title?: string
  anime_id?: string
  anime_image?: string
}): Promise<CommunityPost | null> {
  try {
    let resolvedUserId = post.user_id || null
    if (!resolvedUserId) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          resolvedUserId = session.user.id
        }
      } catch {
        // guest or anon
      }
    }

    const { data, error } = await supabase
      .from('community_posts')
      .insert([
        {
          user_id: resolvedUserId,
          title: post.title.trim(),
          content: post.content.trim(),
          username: post.username?.trim() || 'Otaku',
          avatar_url: post.avatar_url || null,
          frame: post.frame || null,
          category: post.category || 'General',
          anime_title: post.anime_title?.trim() || null,
          anime_id: post.anime_id || null,
          anime_image: post.anime_image || null,
          likes: 0,
          pinned: false,
          edited: false,
        },
      ])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('[Supabase] Error creating community post:', err)
    throw err
  }
}

export async function updateCommunityPost(id: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('community_posts')
      .update({ content: content.trim(), edited: true })
      .eq('id', id)

    if (error) throw error
    return true
  } catch (err) {
    console.error('[Supabase] Error updating post:', err)
    return false
  }
}

export async function deleteCommunityPost(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  } catch (err) {
    console.error('[Supabase] Error deleting post:', err)
    return false
  }
}

export async function likeCommunityPost(id: string, currentLikes: number): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('like_community_post', { target_post_id: id })
    if (error) throw error
    return typeof data === 'number' ? data : currentLikes + 1
  } catch (err) {
    console.error('[Supabase] Error liking post:', err)
    return currentLikes
  }
}

export async function submitStreamReport(report: StreamReport): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('reports')
      .insert([
        {
          anime_id: report.anime_id || null,
          anime_title: report.anime_title,
          episode: String(report.episode),
          server: report.server || 'Auto',
          audio_type: report.audio_type || 'sub',
          issue_type: report.issue_type,
          details: report.details || null,
          playback_time: report.playback_time || null,
          status: 'pending',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
      ])
      .select('id')
      .single()

    if (error) throw error
    return { success: true, id: data?.id }
  } catch (err: any) {
    console.error('[Supabase] Error submitting stream report:', err)
    return { success: false, error: err?.message || 'Failed to submit report' }
  }
}
