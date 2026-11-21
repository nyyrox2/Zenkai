import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Flame,
  Users,
  Check,
  Lock,
  Palette,
  Share2
} from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { TextEffectRenderer } from '../components/ascension/TextEffectRenderer'
import { WatchlistPanel, type WatchItem } from '../components/WatchlistPanel'
import { ProfileEditor, type SectionKey } from '../components/ProfileCustomizer'
import { fetchPublicProfile, type PublicUserData, useProfile, saveProfile } from '../lib/profile'
import {
  getAscensionState,
  ascensionCell,
  claimQuestReward,
  equipCosmetic,
  checkAchievements,
  type AscensionState
} from '../lib/ascension/ascensionStore'
import {
  getLevelProgress,
  getHunterRank,
  DAILY_QUEST_TEMPLATES,
  WEEKLY_QUEST_TEMPLATES,
  ACHIEVEMENTS,
  TEXT_EFFECTS,
  FONT_STYLES,
  NAME_COLORS,
  HUNTER_TITLES,
  isEffectUnlocked,
  isFontUnlocked,
  isNameColorUnlocked,
  isFrameUnlocked
} from '../lib/ascension/types'
import { FRAMES, FRAME_GROUPS, frameGroup } from '../lib/frames'
import { useAuth } from '../context/AuthContext'
import { useList } from '../lib/library'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'

export default function EmbedProfilePage() {
  const { username: paramUsername } = useParams<{ username?: string }>()
  const [searchParams] = useSearchParams()
  const { username: authUsername } = useAuth()
  const localProfile = useProfile()
  const localList = useList()

  const [activeTab, setActiveTab] = useState<'watchlist' | 'quests' | 'armory'>('watchlist')
  const [armoryCategory, setArmoryCategory] = useState<'frames' | 'effects' | 'fonts' | 'colors' | 'titles'>('frames')
  const [frameGroupFilter, setFrameGroupFilter] = useState<string>('All')
  const [searchFrame, setSearchFrame] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editorTab, setEditorTab] = useState<SectionKey>('identity')

  const [ascensionState, setAscensionState] = useState<AscensionState>(getAscensionState())
  const [remoteData, setRemoteData] = useState<PublicUserData | null>(null)
  const [injectedData, setInjectedData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Listen to local ascension store changes
  useEffect(() => {
    void checkAchievements()
    return ascensionCell.subscribe(() => {
      setAscensionState(getAscensionState())
    })
  }, [])

  // Expose bridge updater for Android host
  useEffect(() => {
    const handleUpdate = (data: any) => {
      if (!data) return
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        setInjectedData(parsed)
      } catch (err) {
        console.error('[EmbedProfile] updateProfileData error:', err)
      }
    }
    ;(window as any).updateProfileData = handleUpdate
    ;(window as any).updateUserData = handleUpdate
  }, [])

  // Resolve target username (defaults to authenticated username or 'guest')
  const targetUsername = useMemo(() => {
    const raw = paramUsername || searchParams.get('u') || searchParams.get('username')
    if (raw && raw !== 'me' && raw !== 'self') return raw
    return authUsername || 'guest'
  }, [paramUsername, searchParams, authUsername])

  const isSelf = useMemo(() => {
    if (injectedData?.isSelf !== undefined) return Boolean(injectedData.isSelf)
    if (injectedData?.id === 'guest' || targetUsername === 'guest') return false
    if (targetUsername === 'me' || targetUsername === 'self') return true
    if (authUsername && authUsername.toLowerCase() === targetUsername.toLowerCase()) return true
    if (injectedData?.username && injectedData.username.toLowerCase() === targetUsername.toLowerCase()) return true
    return false
  }, [targetUsername, authUsername, injectedData])

  // Fetch remote public profile if viewing another hunter
  useEffect(() => {
    if (!targetUsername || isSelf) {
      setRemoteData(null)
      return
    }

    let alive = true
    setLoading(true)
    fetchPublicProfile(targetUsername)
      .then((data) => {
        if (alive) setRemoteData(data)
      })
      .catch((err) => {
        console.warn('[EmbedProfile] fetchPublicProfile failed:', err)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [targetUsername, isSelf])

  // Computed Profile Data
  const displayName = injectedData?.displayName || injectedData?.name || (isSelf ? (localProfile.name || authUsername || 'Otaku') : (remoteData?.profile?.name || remoteData?.username || targetUsername))
  const handle = injectedData?.username || (isSelf ? (authUsername || 'otaku') : (remoteData?.username || targetUsername))
  const avatarUrl = injectedData?.avatarUrl || (isSelf ? localProfile.avatar : remoteData?.profile?.avatar) || null
  const bannerUrl = injectedData?.bannerUrl || (isSelf ? localProfile.banner : remoteData?.profile?.banner) || null
  const frameId = injectedData?.frame || injectedData?.equippedFrame || (isSelf ? (localProfile.frame || ascensionState.equippedFrame) : remoteData?.profile?.frame) || 'none'
  const bio = injectedData?.bio || (isSelf ? localProfile.bio : remoteData?.profile?.bio) || 'Sign in to backup history and sync Ascension XP'

  const userLevel = injectedData?.level || (isSelf ? ascensionState.level : (remoteData?.level || 1))
  const userTotalXp = injectedData?.totalXp !== undefined ? injectedData.totalXp : (isSelf ? ascensionState.totalXp : (remoteData?.totalXp || 0))
  const userStreak = injectedData?.streak || (isSelf ? ascensionState.streak : (remoteData?.streak || 1))
  
  const equippedEffect = injectedData?.equippedTextEffect || (isSelf ? ascensionState.equippedTextEffect : (remoteData?.equippedTextEffect || 'none'))
  const equippedFont = injectedData?.equippedFontStyle || (isSelf ? ascensionState.equippedFontStyle : (remoteData?.equippedFontStyle || 'default'))
  const nameColor = injectedData?.nameColor || (isSelf ? (localProfile.nameColor || ascensionState.equippedNameColor) : (remoteData?.nameColor || null))
  const userTitle = injectedData?.equippedTitle || (isSelf ? ascensionState.equippedTitle : (remoteData?.equippedTitle || 'Otaku'))

  const progress = getLevelProgress(userTotalXp)
  const rank = getHunterRank(userLevel)

  // Watchlist items
  const watchlistItems: WatchItem[] = useMemo(() => {
    if (isSelf && localList.length > 0) {
      return localList.map((i: any) => ({
        id: i.id,
        title: i.title,
        image: i.image,
        score: i.score,
        status: i.status,
        progress: i.progress,
        episodes: i.episodes,
        favorite: i.favorite,
        addedAt: i.addedAt
      }))
    }
    if (remoteData?.watchlist && remoteData.watchlist.length > 0) {
      return remoteData.watchlist
    }
    // High quality demo fallback items
    return [
      { id: '1', title: "Hell's Paradise", image: 'https://image.tmdb.org/t/p/w500/xU7dK2y8t6R6xWw5yFqP3MhB2R6.jpg', score: 80, status: 'watching', progress: 3, episodes: 13 },
      { id: '2', title: 'As a Reincarnated Aristocrat', image: 'https://image.tmdb.org/t/p/w500/d5iIlFnGhx2qFqP3MhB2R6Gz4K2.jpg', score: 68, status: 'watching', progress: 1, episodes: 12 },
      { id: '3', title: 'PSYREN', image: 'https://image.tmdb.org/t/p/w500/y6wG4JgV9i7H7jLwH7V6R9wX0H4.jpg', score: 70, status: 'watching', progress: 4, episodes: 24 },
      { id: '4', title: 'A Silent Voice', image: 'https://image.tmdb.org/t/p/w500/6qQzMJG27XOJsyAEEIisoJB45j2.jpg', score: 88, status: 'completed', progress: 1, episodes: 1 },
      { id: '5', title: 'Jujutsu Kaisen', image: 'https://image.tmdb.org/t/p/w500/t9p8f7w8A4uKowwT6rN6xWw5yFq.jpg', score: 86, status: 'watching', progress: 18, episodes: 24 },
      { id: '6', title: 'Solo Leveling', image: 'https://image.tmdb.org/t/p/w500/nyhBueT07zQS7wWLYFDNO8LdO3N.jpg', score: 90, status: 'completed', progress: 12, episodes: 12 }
    ]
  }, [isSelf, localList, remoteData])

  const completedCount = watchlistItems.filter((i) => i.status === 'completed').length
  const watchingCount = watchlistItems.filter((i) => i.status === 'watching').length
  const planningCount = watchlistItems.filter((i) => i.status === 'planning' || (i as any).status === 'plan_to_watch').length

  const handleBack = () => {
    if ((window as any).AndroidBridge?.goBack) {
      ;(window as any).AndroidBridge.goBack()
    } else if (window.history.length > 1) {
      window.history.back()
    }
  }

  const handleClaimQuest = async (questId: string, xpReward: number) => {
    if (!isSelf) {
      toast('Security: Only the authorized account owner can claim quests.')
      return
    }
    const success = await claimQuestReward(questId)
    if (success) {
      toast(`Claimed +${xpReward} XP!`)
      if ((window as any).AndroidBridge?.onQuestClaimed) {
        ;(window as any).AndroidBridge.onQuestClaimed(questId, xpReward)
      }
    } else {
      toast('Quest already claimed today or not completed yet.')
    }
  }

  const handleEquipCosmetic = (type: 'color' | 'font' | 'effect' | 'frame' | 'title', id: string) => {
    if (!isSelf) {
      toast('Security: Only the authorized account owner can equip cosmetics.')
      return
    }
    equipCosmetic(type, id)
    if (type === 'frame') {
      saveProfile({ frame: id })
    } else if (type === 'color') {
      saveProfile({ nameColor: id })
    }
    toast(`Equipped ${id}!`)
    if ((window as any).AndroidBridge?.onCosmeticEquipped) {
      ;(window as any).AndroidBridge.onCosmeticEquipped(type, id)
    }
  }

  // Filtered frames
  const filteredFrames = useMemo(() => {
    return FRAMES.filter((f) => {
      if (frameGroupFilter !== 'All' && frameGroup(f) !== frameGroupFilter) return false
      if (searchFrame.trim() && !f.name.toLowerCase().includes(searchFrame.toLowerCase().trim())) return false
      return true
    })
  }, [frameGroupFilter, searchFrame])

  return (
    <div className="min-h-screen w-full bg-[#0C0C0C] text-[#F4F4F5] pb-20 select-none">
      {/* Top Header Bar with Back Button */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1E222D] bg-[#111318]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="grid size-8 place-items-center rounded-full border border-[#282C37] bg-[#1A1D26] text-[#F4F4F5] transition active:scale-95"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#E11D48]">Otaku Profile</p>
            <h2 className="font-display text-sm font-black text-white">{displayName}</h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: `${displayName} on Zenkai`, url: window.location.href }).catch(() => {})
            } else {
              toast('Profile link copied!')
            }
          }}
          className="grid size-8 place-items-center rounded-full border border-[#282C37] bg-[#1A1D26] text-[#9298A4] transition active:scale-95"
        >
          <Share2 className="size-3.5" />
        </button>
      </div>

      {loading && <div className="h-0.5 w-full bg-[#E11D48] animate-pulse" />}

      {/* Hero Banner */}
      <div className="relative h-40 w-full overflow-hidden bg-[#151821]">
        {bannerUrl ? (
          <img src={bannerUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-[#1E222D] to-[#0C0C0C]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0C0C0C]/50 to-[#0C0C0C]" />
      </div>

      {/* Main Profile Showcase Card */}
      <div className="relative z-10 -mt-12 px-4 space-y-4">
        <div className="flex items-end gap-4">
          {/* Avatar with Animated Frame + Level Badge */}
          <div className="relative shrink-0">
            <Avatar
              size={92}
              src={avatarUrl}
              frame={frameId}
              name={displayName}
              animateFrame
              className="rounded-full bg-[#111318] ring-4 ring-[#111318] shadow-2xl"
            />
            {/* Centered Bottom Level Badge */}
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex min-w-[38px] flex-col items-center justify-center rounded-lg border border-[#242730] bg-[#0B0C0F] px-2 py-0.5 shadow-xl">
              <span className="font-mono text-[7px] font-bold leading-none tracking-widest text-[#9298A4] uppercase">LV</span>
              <span className="font-display text-xs font-black leading-tight text-[#F4F4F5]">{userLevel}</span>
            </div>
          </div>

          {/* Identity info */}
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate font-display text-2xl font-black tracking-tight text-[#F4F4F5]">
              <TextEffectRenderer
                text={displayName}
                effectId={equippedEffect}
                fontId={equippedFont}
                colorId={nameColor}
                fallbackClass="text-foreground"
              />
            </h1>
            <p className="font-mono text-xs text-[#9298A4]">@{handle}</p>
          </div>
        </div>

        {/* Bio */}
        {bio ? (
          <p className="text-xs text-[#F4F4F5]/85 leading-relaxed">{bio}</p>
        ) : null}

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-[#9298A4]">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3 text-[#9298A4]/70" />
            <span>Joined Nov 2, 2026</span>
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-amber-500">
            <Flame className="size-3 text-amber-500" />
            <span>{userStreak}d streak</span>
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 text-[#F4F4F5]">
            <Users className="size-3 text-[#9298A4]/70" />
            <span>{rank.name} ({userTitle})</span>
          </span>
        </div>

        {/* XP Progress HUD */}
        <div className="rounded-xl border border-[#1E222D] bg-[#111318] p-3 space-y-1.5">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-[#F4F4F5] uppercase tracking-wide text-[11px]">LEVEL {userLevel}</span>
            <span className="text-[#9298A4] text-[11px]">
              <strong className="text-[#F4F4F5]">{progress.xpIntoCurrentLevel.toLocaleString()}</strong> / {progress.xpNeededForThisLevel.toLocaleString()} XP
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#E11D48] via-[#F43F5E] to-[#FBBF24] transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        {/* Stats 3-Col Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-[#1E222D] bg-[#111318] p-2.5 text-center">
            <div className="font-display text-2xl font-black text-[#F4F4F5]">{completedCount}</div>
            <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#9298A4]">Completed</div>
          </div>
          <div className="rounded-xl border border-[#1E222D] bg-[#111318] p-2.5 text-center">
            <div className="font-display text-2xl font-black text-[#F4F4F5]">{watchingCount}</div>
            <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#9298A4]">Watching</div>
          </div>
          <div className="rounded-xl border border-[#1E222D] bg-[#111318] p-2.5 text-center">
            <div className="font-display text-2xl font-black text-[#F4F4F5]">{planningCount}</div>
            <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#9298A4]">Planning</div>
          </div>
        </div>

        {/* Action Buttons: Edit Profile (Self only) & Share Profile */}
        <div className="flex items-center gap-2">
          {isSelf ? (
            <button
              type="button"
              onClick={() => {
                setEditorTab('identity')
                setShowEditor(true)
              }}
              className="inline-flex h-8.5 flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-xs font-bold text-black shadow-md transition hover:bg-white/90 active:scale-95"
            >
              <Palette className="size-3.5" />
              <span>Edit Profile</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href)
                toast('Profile link copied to clipboard!')
              }
            }}
            className={cn(
              'inline-flex h-8.5 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-semibold text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white active:scale-95',
              isSelf ? 'flex-1' : 'w-full'
            )}
          >
            <Share2 className="size-3.5" />
            <span>Share Profile</span>
          </button>
        </div>

        {/* Tab Selector: Watchlist | Quests | Armory */}
        <div className="flex items-center gap-1 rounded-full border border-[#1E222D] bg-[#111318] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('watchlist')}
            className={cn(
              'flex-1 rounded-full py-1.5 text-center text-xs font-bold transition active:scale-95',
              activeTab === 'watchlist' ? 'bg-[#F4F4F5] text-[#0C0C0C] shadow' : 'text-[#8C92A4] hover:text-white'
            )}
          >
            Watchlist
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quests')}
            className={cn(
              'flex-1 rounded-full py-1.5 text-center text-xs font-bold transition active:scale-95',
              activeTab === 'quests' ? 'bg-[#E11D48] text-white shadow' : 'text-[#8C92A4] hover:text-white'
            )}
          >
            Quests & XP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('armory')}
            className={cn(
              'flex-1 rounded-full py-1.5 text-center text-xs font-bold transition active:scale-95',
              activeTab === 'armory' ? 'bg-[#F4F4F5] text-[#0C0C0C] shadow' : 'text-[#8C92A4] hover:text-white'
            )}
          >
            Armory
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: WATCHLIST                                          */}
        {/* ========================================================= */}
        {activeTab === 'watchlist' && (
          <section className="space-y-4 pt-2">
            <WatchlistPanel
              items={watchlistItems}
              emptyTitle="No anime saved in this list yet"
              emptyHint="Search or browse titles to start your list."
            />
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 2: QUESTS & XP CLAIMING                               */}
        {/* ========================================================= */}
        {activeTab === 'quests' && (
          <section className="space-y-4 pt-2">
            {/* Daily Quests */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#E11D48]">Daily Missions (Claim Once Per Day)</h3>
                <span className="font-mono text-[10px] text-[#9298A4]">Resets 00:00 UTC</span>
              </div>
              <div className="space-y-2">
                {DAILY_QUEST_TEMPLATES.map((q) => {
                  const userQuest = ascensionState.quests[q.id]
                  const isClaimed = !!userQuest?.claimed
                  const isCompleted = (userQuest?.progress || 0) >= q.target || q.id === 'daily_login'

                  return (
                    <div key={q.id} className="flex items-center justify-between rounded-xl border border-[#1E222D] bg-[#111318] p-3">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{q.title}</span>
                          <span className="rounded bg-[#E11D48]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#E11D48]">+{q.xpReward} XP</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#8C92A4]">{q.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleClaimQuest(q.id, q.xpReward)}
                        disabled={isClaimed}
                        className={cn(
                          'shrink-0 rounded-full px-3.5 py-1 text-xs font-bold transition active:scale-95',
                          isClaimed
                            ? 'bg-[#181B22] text-[#6C7284] cursor-not-allowed border border-[#222632]'
                            : isCompleted
                            ? 'bg-[#E11D48] text-white hover:bg-[#BE123C] shadow-lg shadow-[#E11D48]/30'
                            : 'bg-[#1F232F] text-[#9298A4] hover:text-white'
                        )}
                      >
                        {isClaimed ? (
                          <span className="flex items-center gap-1"><Check className="size-3 text-[#6C7284]" /> Claimed</span>
                        ) : isCompleted ? (
                          'Claim'
                        ) : (
                          `${userQuest?.progress || 0}/${q.target}`
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Weekly Expeditions */}
            <div className="space-y-2.5 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9298A4]">Weekly Expeditions</h3>
              <div className="space-y-2">
                {WEEKLY_QUEST_TEMPLATES.map((q) => {
                  const userQuest = ascensionState.quests[q.id]
                  const isClaimed = !!userQuest?.claimed
                  const isCompleted = (userQuest?.progress || 0) >= q.target

                  return (
                    <div key={q.id} className="flex items-center justify-between rounded-xl border border-[#1E222D] bg-[#111318] p-3">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{q.title}</span>
                          <span className="rounded bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#F59E0B]">+{q.xpReward} XP</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#8C92A4]">{q.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleClaimQuest(q.id, q.xpReward)}
                        disabled={isClaimed}
                        className={cn(
                          'shrink-0 rounded-full px-3.5 py-1 text-xs font-bold transition active:scale-95',
                          isClaimed
                            ? 'bg-[#181B22] text-[#6C7284] cursor-not-allowed border border-[#222632]'
                            : isCompleted
                            ? 'bg-[#F59E0B] text-black hover:bg-[#D97706]'
                            : 'bg-[#1F232F] text-[#9298A4]'
                        )}
                      >
                        {isClaimed ? 'Claimed' : isCompleted ? 'Claim' : `${userQuest?.progress || 0}/${q.target}`}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Permanent Achievements */}
            <div className="space-y-2.5 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9298A4]">Permanent Achievements</h3>
              <div className="space-y-2">
                {ACHIEVEMENTS.map((a) => {
                  const unlocked = ascensionState.achievements.includes(a.id)

                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border border-[#1E222D] bg-[#111318] p-3">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{a.title}</span>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/90">+{a.xpReward} XP</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#8C92A4]">{a.description}</p>
                      </div>

                      <div className="shrink-0">
                        {unlocked ? (
                          <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                            <Check className="size-3" /> Unlocked
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full border border-[#222632] bg-[#181B22] px-2.5 py-0.5 text-[10px] font-bold text-[#6C7284]">
                            <Lock className="size-3" /> Locked
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 3: ARMORY & CUSTOMIZATION                             */}
        {/* ========================================================= */}
        {activeTab === 'armory' && (
          <section className="space-y-4 pt-2">
            {/* Category selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setArmoryCategory('frames')}
                className={cn('rounded-full px-3 py-1 text-xs font-bold shrink-0 transition', armoryCategory === 'frames' ? 'bg-[#E11D48] text-white' : 'bg-[#181B24] text-[#8C92A4]')}
              >
                Avatar Frames (67)
              </button>
              <button
                type="button"
                onClick={() => setArmoryCategory('effects')}
                className={cn('rounded-full px-3 py-1 text-xs font-bold shrink-0 transition', armoryCategory === 'effects' ? 'bg-[#E11D48] text-white' : 'bg-[#181B24] text-[#8C92A4]')}
              >
                Text Shaders (28)
              </button>
              <button
                type="button"
                onClick={() => setArmoryCategory('fonts')}
                className={cn('rounded-full px-3 py-1 text-xs font-bold shrink-0 transition', armoryCategory === 'fonts' ? 'bg-[#E11D48] text-white' : 'bg-[#181B24] text-[#8C92A4]')}
              >
                Fonts (21)
              </button>
              <button
                type="button"
                onClick={() => setArmoryCategory('colors')}
                className={cn('rounded-full px-3 py-1 text-xs font-bold shrink-0 transition', armoryCategory === 'colors' ? 'bg-[#E11D48] text-white' : 'bg-[#181B24] text-[#8C92A4]')}
              >
                Name Colors
              </button>
              <button
                type="button"
                onClick={() => setArmoryCategory('titles')}
                className={cn('rounded-full px-3 py-1 text-xs font-bold shrink-0 transition', armoryCategory === 'titles' ? 'bg-[#E11D48] text-white' : 'bg-[#181B24] text-[#8C92A4]')}
              >
                Titles
              </button>
            </div>

            {/* Frames Sub-View */}
            {armoryCategory === 'frames' && (
              <div className="space-y-3">
                {/* Frame search input */}
                <input
                  type="text"
                  placeholder="Search frames..."
                  value={searchFrame}
                  onChange={(e) => setSearchFrame(e.target.value)}
                  className="w-full rounded-xl border border-[#222632] bg-[#14171F] px-3 py-1.5 text-xs text-white placeholder-[#717789] outline-none focus:border-[#E11D48]"
                />

                {/* Frame group filter pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {['All', ...Object.values(FRAME_GROUPS)].map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setFrameGroupFilter(grp)}
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition',
                        frameGroupFilter === grp ? 'bg-white text-black' : 'border border-[#222632] bg-[#14171F] text-[#8C92A4]'
                      )}
                    >
                      {grp}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {filteredFrames.map((f) => {
                    const isEquipped = frameId === f.id
                    const unlocked = isFrameUnlocked(f.id, userLevel)

                    return (
                      <div
                        key={f.id}
                        onClick={() => unlocked && handleEquipCosmetic('frame', f.id)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl border p-2.5 transition cursor-pointer',
                          isEquipped ? 'border-[#E11D48] bg-[#E11D48]/10' : 'border-[#1E222D] bg-[#111318] hover:border-white/20'
                        )}
                      >
                        <Avatar size={40} src={avatarUrl} frame={f.id} name={displayName} animateFrame />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-white">{f.name}</p>
                          <p className="text-[10px] text-[#717789]">{unlocked ? (isEquipped ? 'Equipped' : 'Tap to equip') : 'Locked'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Effects Sub-View */}
            {armoryCategory === 'effects' && (
              <div className="space-y-2">
                {TEXT_EFFECTS.map((eff) => {
                  const isEquipped = equippedEffect === eff.id
                  const unlocked = isEffectUnlocked(eff.id, userLevel)

                  return (
                    <div
                      key={eff.id}
                      onClick={() => unlocked && handleEquipCosmetic('effect', eff.id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border p-3 transition cursor-pointer',
                        isEquipped ? 'border-[#E11D48] bg-[#E11D48]/10' : 'border-[#1E222D] bg-[#111318] hover:border-white/20'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-sm font-black">
                          <TextEffectRenderer text={eff.name} effectId={eff.id} fontId={equippedFont} colorId={nameColor} fallbackClass="text-white" />
                        </div>
                        <p className="text-[11px] text-[#717789] mt-0.5">{eff.description}</p>
                      </div>

                      <div className="shrink-0 pl-2">
                        {isEquipped ? (
                          <span className="rounded-full bg-[#E11D48] px-2.5 py-0.5 text-[10px] font-bold text-white">Equipped</span>
                        ) : unlocked ? (
                          <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-white/90">Equip</span>
                        ) : (
                          <span className="rounded-full border border-[#222632] bg-[#181B22] px-2 py-0.5 text-[10px] text-[#6C7284]">Lv {eff.minLevel}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Fonts Sub-View */}
            {armoryCategory === 'fonts' && (
              <div className="space-y-2">
                {FONT_STYLES.map((f) => {
                  const isEquipped = equippedFont === f.id
                  const unlocked = isFontUnlocked(f.id, userLevel)

                  return (
                    <div
                      key={f.id}
                      onClick={() => unlocked && handleEquipCosmetic('font', f.id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border p-3 transition cursor-pointer',
                        isEquipped ? 'border-[#E11D48] bg-[#E11D48]/10' : 'border-[#1E222D] bg-[#111318] hover:border-white/20'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold" style={{ fontFamily: f.fontFamily }}>
                          {f.name}
                        </div>
                        <p className="text-[11px] text-[#717789] mt-0.5">{f.description}</p>
                      </div>

                      <div className="shrink-0 pl-2">
                        {isEquipped ? (
                          <span className="rounded-full bg-[#E11D48] px-2.5 py-0.5 text-[10px] font-bold text-white">Equipped</span>
                        ) : unlocked ? (
                          <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-white/90">Equip</span>
                        ) : (
                          <span className="rounded-full border border-[#222632] bg-[#181B22] px-2 py-0.5 text-[10px] text-[#6C7284]">Lv {f.minLevel}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Name Colors Sub-View */}
            {armoryCategory === 'colors' && (
              <div className="grid grid-cols-2 gap-2">
                {NAME_COLORS.map((c) => {
                  const isEquipped = nameColor === c.id
                  const unlocked = isNameColorUnlocked(c.id, userLevel)

                  return (
                    <div
                      key={c.id}
                      onClick={() => unlocked && handleEquipCosmetic('color', c.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border p-2.5 transition cursor-pointer',
                        isEquipped ? 'border-[#E11D48] bg-[#E11D48]/10' : 'border-[#1E222D] bg-[#111318] hover:border-white/20'
                      )}
                    >
                      <div className="size-5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: c.colorHex }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white">{c.name}</p>
                        <p className="text-[10px] text-[#717789]">{unlocked ? (isEquipped ? 'Active' : 'Equip') : `Lv ${c.minLevel}`}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Titles Sub-View */}
            {armoryCategory === 'titles' && (
              <div className="space-y-2">
                {HUNTER_TITLES.map((t) => {
                  const isEquipped = userTitle === t.title
                  const unlocked = userLevel >= t.minLevel

                  return (
                    <div
                      key={t.title}
                      onClick={() => unlocked && handleEquipCosmetic('title', t.title)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border p-2.5 transition cursor-pointer',
                        isEquipped ? 'border-[#E11D48] bg-[#E11D48]/10' : 'border-[#1E222D] bg-[#111318] hover:border-white/20'
                      )}
                    >
                      <span className="text-xs font-bold text-white">{t.title}</span>
                      <span className="text-[10px] text-[#717789]">{unlocked ? (isEquipped ? 'Equipped' : 'Equip') : `Lv ${t.minLevel}`}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Full Profile & Cosmetic Customizer (Avatar, Banner, Bio, Armory) */}
      {showEditor && (
        <ProfileEditor
          me={localProfile}
          initialTab={editorTab}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
