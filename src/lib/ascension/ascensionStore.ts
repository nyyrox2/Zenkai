import { cell } from '../library'
import { supabase } from '../supabase'
import {
  calculateLevelFromXp,
  getHunterRank,
  DAILY_QUEST_TEMPLATES,
  WEEKLY_QUEST_TEMPLATES,
  ACHIEVEMENTS,
  PERK_UNLOCKS,
  type HunterRankTier,
  isFontUnlocked,
  isEffectUnlocked,
  isFrameUnlocked,
  isTitleUnlocked,
  isNameColorUnlocked,
} from './types'

export interface UserQuestProgress {
  questId: string
  progress: number
  target: number
  completed: boolean
  claimed: boolean
  periodKey: string
}

export interface LevelUpEvent {
  oldLevel: number
  newLevel: number
  oldRank: HunterRankTier
  newRank: HunterRankTier
  unlockedPerks: Array<{ title: string; description: string; badge: string }>
}

export interface AscensionState {
  totalXp: number
  level: number
  streak: number
  longestStreak: number
  lastLoginDate: string | null
  lastSyncedAt: number
  equippedTitle: string
  equippedTextEffect: string
  equippedFontStyle: string
  equippedNameColor: string
  equippedFrame: string | null
  quests: Record<string, UserQuestProgress>
  achievements: string[] // unlocked achievement IDs
  pendingLevelUp: LevelUpEvent | null
  soundEnabled: boolean
}

const STORAGE_KEY = 'zk:ascension:v2'
try {
  localStorage.removeItem('zk:ascension:v1')
} catch {}

/**
 * Returns YYYY-MM-DD in the user's LOCAL timezone.
 * Each user's streak day changes at their own local midnight (00:00 local time)
 * instead of a fixed global time for all (e.g. 12 AM IST / UTC).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getLocalYesterdayString(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
  return getLocalDateString(d)
}

const TODAY = () => getLocalDateString()
const CURRENT_WEEK = () => {
  const d = new Date()
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${weekNo}`
}

const defaultState: AscensionState = {
  totalXp: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  lastLoginDate: null,
  lastSyncedAt: 0,
  equippedTitle: 'Otaku',
  equippedTextEffect: 'none',
  equippedFontStyle: 'default',
  equippedNameColor: 'default',
  equippedFrame: null,
  quests: {},
  achievements: [],
  pendingLevelUp: null,
  soundEnabled: true,
}

export const ascensionCell = cell<AscensionState>(STORAGE_KEY, defaultState)

// ----------------------------------------------------------------------------
// Internal Helper: Check & Trigger Level Up
// ----------------------------------------------------------------------------

function checkLevelUp(oldXp: number, newXp: number, _state?: AscensionState): LevelUpEvent | null {
  const oldLevel = calculateLevelFromXp(oldXp)
  const newLevel = calculateLevelFromXp(newXp)
  if (newLevel <= oldLevel) return null

  const oldRank = getHunterRank(oldLevel).tier
  const newRank = getHunterRank(newLevel).tier

  // Compute newly unlocked perks between oldLevel and newLevel
  const newPerks = PERK_UNLOCKS.filter((p) => p.level > oldLevel && p.level <= newLevel).map((p) => ({
    title: p.title,
    description: p.description,
    badge: p.badge,
  }))

  return {
    oldLevel,
    newLevel,
    oldRank,
    newRank,
    unlockedPerks: newPerks,
  }
}

// ----------------------------------------------------------------------------
// Quest Lifecycle Initialization
// ----------------------------------------------------------------------------

export function ensureActiveQuests(state: AscensionState): AscensionState {
  const today = TODAY()
  const currentWeek = CURRENT_WEEK()
  let modified = false
  const updatedQuests = { ...state.quests }

  // Daily quests
  for (const q of DAILY_QUEST_TEMPLATES) {
    const existing = updatedQuests[q.id]
    if (!existing || existing.periodKey !== today) {
      updatedQuests[q.id] = {
        questId: q.id,
        progress: 0,
        target: q.target,
        completed: false,
        claimed: false,
        periodKey: today,
      }
      modified = true
    }
  }

  // Weekly quests
  for (const q of WEEKLY_QUEST_TEMPLATES) {
    const existing = updatedQuests[q.id]
    if (!existing || existing.periodKey !== currentWeek) {
      updatedQuests[q.id] = {
        questId: q.id,
        progress: 0,
        target: q.target,
        completed: false,
        claimed: false,
        periodKey: currentWeek,
      }
      modified = true
    }
  }

  if (modified) {
    const nextState = { ...state, quests: updatedQuests }
    ascensionCell.set(nextState)
    return nextState
  }

  return state
}

// ----------------------------------------------------------------------------
// Public API Methods
// ----------------------------------------------------------------------------

export function sanitizeCosmeticsForLevel(state: AscensionState): AscensionState {
  let changed = false
  const updated = { ...state }

  if (!isTitleUnlocked(updated.equippedTitle, updated.level)) {
    updated.equippedTitle = 'Otaku'
    changed = true
  }
  if (!isFontUnlocked(updated.equippedFontStyle, updated.level)) {
    updated.equippedFontStyle = 'default'
    changed = true
  }
  if (!isEffectUnlocked(updated.equippedTextEffect, updated.level)) {
    updated.equippedTextEffect = 'none'
    changed = true
  }
  if (updated.equippedFrame && !isFrameUnlocked(updated.equippedFrame, updated.level)) {
    updated.equippedFrame = null
    changed = true
  }
  if (!isNameColorUnlocked(updated.equippedNameColor, updated.level)) {
    updated.equippedNameColor = 'default'
    changed = true
  }

  if (changed) {
    ascensionCell.set(updated)
    return updated
  }
  return state
}

export function getAscensionState(): AscensionState {
  const current = ensureActiveQuests(ascensionCell.get())
  return sanitizeCosmeticsForLevel(current)
}

export function subscribeAscension(listener: () => void): () => void {
  return ascensionCell.subscribe(listener)
}

export function dismissLevelUp() {
  const current = ascensionCell.get()
  ascensionCell.set({ ...current, pendingLevelUp: null })
}

export function setAscensionSound(enabled: boolean) {
  const current = ascensionCell.get()
  ascensionCell.set({ ...current, soundEnabled: enabled })
}

/** Set when cosmetics were equipped locally and haven't been uploaded yet; cleared after a successful upload. */
export const COSMETICS_DIRTY_KEY = 'zk:cos_dirty'

export function equipCosmetic(
  type: 'title' | 'effect' | 'font' | 'frame' | 'color',
  value: string | null,
  /** Pass false to skip the cloud upload (the caller uploads once afterwards). */
  upload = true,
): boolean {
  const current = ascensionCell.get()
  const level = current.level

  // Validate unlock requirement against current level
  if (value && value !== 'none' && value !== 'default' && value !== 'Otaku') {
    if (type === 'font' && !isFontUnlocked(value, level)) return false
    if (type === 'effect' && !isEffectUnlocked(value, level)) return false
    if (type === 'frame' && !isFrameUnlocked(value, level)) return false
    if (type === 'title' && !isTitleUnlocked(value, level)) return false
    if (type === 'color' && !isNameColorUnlocked(value, level)) return false
  }

  const updated = { ...current }
  if (type === 'title') updated.equippedTitle = value || 'Otaku'
  if (type === 'effect') updated.equippedTextEffect = value || 'none'
  if (type === 'font') updated.equippedFontStyle = value || 'default'
  if (type === 'frame') updated.equippedFrame = value
  if (type === 'color') updated.equippedNameColor = value || 'default'

  ascensionCell.set(updated)

  try { localStorage.setItem(COSMETICS_DIRTY_KEY, '1') } catch {}

  if (upload) void pushAscensionToCloud(updated)

  return true
}

// ----------------------------------------------------------------------------
// Milestone Cloud Push (Level Up, Promotions, Major Milestones)
// ----------------------------------------------------------------------------

/**
 * Push authoritative ascension progress (total_xp, level, streak, cosmetics) to Supabase.
 * Routine actions (watching episodes, reading chapters, daily check-in) stay in local data.
 * Cloud push occurs ONLY when:
 * 1. User levels up (levelUp !== null or newLevel > oldLevel)
 * 2. Hunter Rank tier promotes (e.g. E-Rank -> D-Rank)
 * 3. Major streak milestone is reached (7d, 30d)
 * 4. An achievement is unlocked
 * 5. User manually triggers Cloud & Sync
 */
export async function pushAscensionToCloud(customState?: AscensionState) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return

    const state = customState || ascensionCell.get()
    const { error } = await supabase
      .from('profiles')
      .update({
        total_xp: state.totalXp,
        level: state.level,
        login_streak: state.streak,
        last_login_date: state.lastLoginDate,
        equipped_title: state.equippedTitle,
        equipped_text_effect: state.equippedTextEffect,
        equipped_frame: state.equippedFrame,
        name_color: state.equippedNameColor,
      })
      .eq('id', session.user.id)
    if (!error) {
      try { localStorage.removeItem(COSMETICS_DIRTY_KEY) } catch {}
    }
  } catch (err) {
    console.warn('[Ascension] Cloud sync error:', err)
  }
}

// ----------------------------------------------------------------------------
// Core Activity Awarder
// ----------------------------------------------------------------------------

export async function recordProgressionActivity({
  action,
  xp,
  refId,
  periodKey,
}: {
  action: 'watch_episode' | 'read_manga_chapter' | 'read_novel_chapter' | 'daily_login' | 'streak_milestone'
  xp: number
  refId: string
  periodKey?: string
}): Promise<{ success: boolean; xpAwarded: number; leveledUp: boolean }> {
  let state = ensureActiveQuests(ascensionCell.get())
  const effectivePeriod = periodKey || (action === 'daily_login' ? TODAY() : 'permanent')
  const idempotencyKey = `zk:act:${action}:${refId}:${effectivePeriod}`

  // Check client idempotency to prevent spam
  if (sessionStorage.getItem(idempotencyKey) || localStorage.getItem(idempotencyKey)) {
    return { success: false, xpAwarded: 0, leveledUp: false }
  }

  // 1. Mark idempotency key locally
  try {
    localStorage.setItem(idempotencyKey, '1')
  } catch {}

  const oldXp = state.totalXp
  const newXp = oldXp + xp
  const levelUp = checkLevelUp(oldXp, newXp, state)
  const newLevel = calculateLevelFromXp(newXp)

  // 2. Advance relevant quests
  const updatedQuests = { ...state.quests }
  const advanceQuest = (questId: string, amount: number = 1) => {
    const q = updatedQuests[questId]
    if (q && !q.completed) {
      const newProgress = Math.min(q.target, q.progress + amount)
      updatedQuests[questId] = {
        ...q,
        progress: newProgress,
        completed: newProgress >= q.target,
      }
    }
  }

  if (action === 'watch_episode') {
    advanceQuest('daily_watch', 1)
    advanceQuest('weekly_watch_10', 1)
  } else if (action === 'read_manga_chapter') {
    advanceQuest('daily_manga', 1)
    advanceQuest('weekly_manga_10', 1)
  } else if (action === 'read_novel_chapter') {
    advanceQuest('daily_novel', 1)
    advanceQuest('weekly_novel_5', 1)
  } else if (action === 'daily_login') {
    advanceQuest('daily_login', 1)
  }

  // 3. Update state in local reactive storage (instant zero-latency UX)
  const nextState: AscensionState = {
    ...state,
    totalXp: newXp,
    level: newLevel,
    quests: updatedQuests,
    pendingLevelUp: levelUp || state.pendingLevelUp,
  }

  ascensionCell.set(nextState)

  // 4. Check for newly unlocked achievements
  void checkAchievements(nextState)

  // 5. Keep in localdata; ONLY push to Supabase when a Level Up or big thing happens:
  // - Level Up (newLevel > state.level or levelUp !== null)
  // - Hunter Rank promotion (tier change)
  // - Major streak milestone (7-day, 30-day streak)
  const isMajorEvent =
    levelUp !== null ||
    newLevel > state.level ||
    action === 'streak_milestone' ||
    getHunterRank(newLevel).tier !== getHunterRank(state.level).tier

  if (isMajorEvent) {
    void pushAscensionToCloud(nextState)
  }

  return {
    success: true,
    xpAwarded: xp,
    leveledUp: !!levelUp,
  }
}

// ----------------------------------------------------------------------------
// Quest Claiming
// ----------------------------------------------------------------------------

export async function claimQuestReward(questId: string): Promise<boolean> {
  const state = ensureActiveQuests(ascensionCell.get())
  const quest = state.quests[questId]
  if (!quest || !quest.completed || quest.claimed) return false

  // Find quest template for XP reward
  const template = [...DAILY_QUEST_TEMPLATES, ...WEEKLY_QUEST_TEMPLATES].find((q) => q.id === questId)
  const xpReward = template?.xpReward || 25

  const oldXp = state.totalXp
  const newXp = oldXp + xpReward
  const levelUp = checkLevelUp(oldXp, newXp, state)
  const newLevel = calculateLevelFromXp(newXp)

  const updatedQuests = {
    ...state.quests,
    [questId]: {
      ...quest,
      claimed: true,
    },
  }

  // If daily quest was claimed, increment weekly mission counter
  if (template?.type === 'daily') {
    const weeklyMissions = updatedQuests['weekly_quests_10']
    if (weeklyMissions && !weeklyMissions.completed) {
      const nextProgress = Math.min(weeklyMissions.target, weeklyMissions.progress + 1)
      updatedQuests['weekly_quests_10'] = {
        ...weeklyMissions,
        progress: nextProgress,
        completed: nextProgress >= weeklyMissions.target,
      }
    }
  }

  const nextState: AscensionState = {
    ...state,
    totalXp: newXp,
    level: newLevel,
    quests: updatedQuests,
    pendingLevelUp: levelUp || state.pendingLevelUp,
  }

  ascensionCell.set(nextState)

  // Keep in localdata; ONLY push to cloud if claiming this quest caused a Level Up
  if (levelUp !== null || newLevel > state.level) {
    void pushAscensionToCloud(nextState)
  }

  return true
}

// ----------------------------------------------------------------------------
// Check & Unlock Permanent Achievements
// ----------------------------------------------------------------------------

export async function checkAchievements(customState?: AscensionState) {
  const state = customState || ascensionCell.get()
  const unlocked = new Set(state.achievements)
  let newlyUnlockedXp = 0
  const newlyUnlockedIds: string[] = []

  // Check conditions
  const check = (achId: string, condition: boolean) => {
    if (condition && !unlocked.has(achId)) {
      const ach = ACHIEVEMENTS.find((a) => a.id === achId)
      if (ach) {
        unlocked.add(achId)
        newlyUnlockedIds.push(achId)
        newlyUnlockedXp += ach.xpReward
      }
    }
  }

  // Level milestones
  check('ach_rank_c', state.level >= 10)
  check('ach_rank_a', state.level >= 30)
  check('ach_rank_ss', state.level >= 50)
  check('ach_streak_7', state.streak >= 7)
  check('ach_streak_30', state.streak >= 30)

  // Check total watch count from localStorage
  try {
    const historyRaw = localStorage.getItem('zk:watch-history')
    if (historyRaw) {
      const history = JSON.parse(historyRaw)
      const count = Array.isArray(history) ? history.length : 0
      check('ach_first_watch', count >= 1)
      check('ach_episodes_25', count >= 25)
      check('ach_episodes_100', count >= 100)
      check('ach_episodes_500', count >= 500)
    }

    const readingRaw = localStorage.getItem('zk:reading')
    if (readingRaw) {
      const reading = JSON.parse(readingRaw)
      const count = Object.keys(reading || {}).length
      check('ach_first_manga', count >= 1)
      check('ach_manga_100', count >= 100)
    }
  } catch {}

  if (newlyUnlockedIds.length > 0) {
    const oldXp = state.totalXp
    const newXp = oldXp + newlyUnlockedXp
    const levelUp = checkLevelUp(oldXp, newXp, state)
    const newLevel = calculateLevelFromXp(newXp)

    const nextState: AscensionState = {
      ...state,
      totalXp: newXp,
      level: newLevel,
      achievements: Array.from(unlocked),
      pendingLevelUp: levelUp || state.pendingLevelUp,
    }

    ascensionCell.set(nextState)

    // Unlocking achievements is a big milestone: push authoritative state to Supabase
    void pushAscensionToCloud(nextState)

    // Sync to Supabase user_achievements table
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        const rows = newlyUnlockedIds.map((aId) => ({
          user_id: session.user.id,
          achievement_id: aId,
        }))
        void supabase.from('user_achievements').upsert(rows, { onConflict: 'user_id,achievement_id' })
      }
    }).catch(() => {})
  }
}

// ----------------------------------------------------------------------------
// Daily Login Streak Evaluator
// ----------------------------------------------------------------------------

export async function evaluateDailyLoginStreak() {
  const state = ensureActiveQuests(ascensionCell.get())
  const today = TODAY()
  if (state.lastLoginDate === today) return // already checked in today

  // 1. Authoritative Backend Check via Supabase RPC if signed in
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      const { data: serverResult, error } = await supabase.rpc('check_daily_login_streak', {
        p_client_date: today,
      })

      if (!error && serverResult && serverResult.success) {
        const nextStreak = Number(serverResult.streak) || 1
        const updatedState: AscensionState = {
          ...state,
          streak: nextStreak,
          longestStreak: Math.max(state.longestStreak || 0, nextStreak),
          lastLoginDate: serverResult.last_login_date || today,
          totalXp: serverResult.new_total_xp ? Number(serverResult.new_total_xp) : state.totalXp,
          level: serverResult.new_level ? Number(serverResult.new_level) : state.level,
        }
        ascensionCell.set(updatedState)
        return
      }
    }
  } catch (err) {
    console.warn('[Ascension] Backend streak check fallback:', err)
  }

  // 2. Client-side fallback if offline or guest
  const yesterday = getLocalYesterdayString()
  let newStreak = 1
  if (state.lastLoginDate === yesterday) {
    newStreak = (state.streak || 0) + 1
  }

  const newLongest = Math.max(state.longestStreak || 0, newStreak)

  // Update state with streak
  const updatedState: AscensionState = {
    ...state,
    streak: newStreak,
    longestStreak: newLongest,
    lastLoginDate: today,
  }
  ascensionCell.set(updatedState)

  // Award daily login XP (+20 XP)
  void recordProgressionActivity({
    action: 'daily_login',
    xp: 20,
    refId: today,
    periodKey: today,
  })

  // Streak milestone bonuses
  if (newStreak === 7) {
    void recordProgressionActivity({
      action: 'streak_milestone',
      xp: 100,
      refId: 'streak_7',
    })
  } else if (newStreak === 30) {
    void recordProgressionActivity({
      action: 'streak_milestone',
      xp: 500,
      refId: 'streak_30',
    })
  }

  // Push updated streak to cloud
  void pushAscensionToCloud(updatedState)
}

// ----------------------------------------------------------------------------
// Cloud Synchronization on Auth Login
// ----------------------------------------------------------------------------

export async function syncAscensionWithCloud(userId: string, force: boolean = false) {
  try {
    const state = ascensionCell.get()
    const now = Date.now()
    const THROTTLE_MS = 30 * 1000

    // Short 30s throttle to avoid duplicate calls within the same render cycle unless forced
    if (!force && state.lastSyncedAt > 0 && now - state.lastSyncedAt < THROTTLE_MS) {
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('total_xp, level, login_streak, last_login_date, equipped_title, equipped_text_effect, equipped_frame, name_color')
      .eq('id', userId)
      .maybeSingle()

    if (profile) {
      const cloudXp = Number(profile.total_xp) || 0
      const calculatedLevel = calculateLevelFromXp(cloudXp)

      const merged: AscensionState = sanitizeCosmeticsForLevel({
        ...state,
        totalXp: cloudXp,
        level: calculatedLevel,
        streak: Number(profile.login_streak) || 0,
        lastLoginDate: profile.last_login_date || state.lastLoginDate,
        lastSyncedAt: now,
        equippedTitle:
          profile.equipped_title && profile.equipped_title !== 'Novice Hunter'
            ? profile.equipped_title
            : 'Otaku',
        equippedTextEffect:
          profile.equipped_text_effect && profile.equipped_text_effect !== 'none'
            ? profile.equipped_text_effect
            : 'none',
        equippedNameColor: profile.name_color || 'default',
        equippedFrame: profile.equipped_frame || null,
      })

      ascensionCell.set(merged)
      evaluateDailyLoginStreak()
    }
  } catch (err) {
    console.warn('[Ascension] Cloud sync error:', err)
  }
}

export function clearAscensionCache() {
  ascensionCell.set(defaultState)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}
