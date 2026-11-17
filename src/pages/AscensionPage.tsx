import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Flame,
  ChevronsUp,
  Trophy,
  Shield,
  Palette,
  Check,
  Clock,
  Lock,
  Search,
  X,
} from 'lucide-react'
import {
  ascensionCell,
  getAscensionState,
  checkAchievements,
  claimQuestReward,
  equipCosmetic,
  type AscensionState,
} from '../lib/ascension/ascensionStore'
import {
  getHunterRank,
  getLevelProgress,
  HUNTER_RANKS,
  DAILY_QUEST_TEMPLATES,
  WEEKLY_QUEST_TEMPLATES,
  ACHIEVEMENTS,
  PERK_UNLOCKS,
  TEXT_EFFECTS,
  FONT_STYLES,
  NAME_COLORS,
  FRAME_LEVEL_REQUIREMENTS,
  isFrameUnlocked,
  isEffectUnlocked,
  isFontUnlocked,
  isTitleUnlocked,
  isNameColorUnlocked,
  HUNTER_TITLES,
} from '../lib/ascension/types'
import { HunterRankBadge } from '../components/ascension/HunterRankBadge'
import { HunterRankInsignia } from '../components/ascension/HunterRankInsignia'
import { TextEffectRenderer } from '../components/ascension/TextEffectRenderer'
import { Avatar } from '../components/Avatar'
import { FRAMES, FRAME_GROUPS, frameGroup, frameUrl } from '../lib/frames'
import { useAuth } from '../context/AuthContext'
import { useProfile, saveProfile } from '../lib/profile'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'

export const AscensionPage: React.FC = () => {
  const { username } = useAuth()
  const profile = useProfile()
  const [state, setState] = useState<AscensionState>(getAscensionState())
  const [activeTab, setActiveTab] = useState<'overview' | 'quests' | 'achievements' | 'armory'>('overview')
  const [armoryTab, setArmoryTab] = useState<'colors' | 'fonts' | 'effects' | 'frames' | 'titles'>('colors')
  const [claimLoading, setClaimLoading] = useState<string | null>(null)
  const [timeUntilReset, setTimeUntilReset] = useState<string>('')
  const [frameCategory, setFrameCategory] = useState<string>('')
  const [frameSearch, setFrameSearch] = useState<string>('')

  // Subscribe to ascension store (and unlock anything already earned)
  useEffect(() => {
    void checkAchievements()
    return ascensionCell.subscribe(() => {
      setState(getAscensionState())
    })
  }, [])

  // UTC Midnight Countdown
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
      const diff = Math.max(0, utcMidnight.getTime() - now.getTime())
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeUntilReset(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      )
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [])

  const level = state.level
  const rank = getHunterRank(level)
  const progress = getLevelProgress(state.totalXp)
  const nextPerk = PERK_UNLOCKS.find((p) => p.level > level)

  const filteredFrames = useMemo(() => {
    return FRAMES.filter((f) => {
      if (frameCategory && frameGroup(f) !== frameCategory) return false
      if (frameSearch.trim() && !f.name.toLowerCase().includes(frameSearch.toLowerCase().trim())) return false
      return true
    })
  }, [frameCategory, frameSearch])

  const handleClaim = async (questId: string) => {
    setClaimLoading(questId)
    const success = await claimQuestReward(questId)
    setClaimLoading(null)
    if (success) {
      toast('Reward claimed! XP added.')
    }
  }

  const displayName = profile.name || username || 'Otaku'

  const TABS = [
    { id: 'overview' as const, label: 'Hunter Rank Ladder', icon: Shield },
    { id: 'quests' as const, label: 'Commissions & Quests', icon: ChevronsUp },
    { id: 'achievements' as const, label: 'Achievements', icon: Trophy },
    { id: 'armory' as const, label: 'Cosmetic Armory', icon: Palette },
  ]

  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pt-10">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card-2/60 px-4 py-2 text-xs font-bold text-foreground transition hover:border-accent hover:text-accent active:scale-95"
        >
          <ArrowLeft className="size-3.5" />
          <span>Profile</span>
        </Link>

        <div className="text-center sm:text-left">
          <h1 className="font-display text-xl font-black flex items-center gap-2">
            <span>ZENKAI ASCENSION</span>
            <span className="text-accent">//</span>
            <span className="font-mono text-xs font-semibold text-muted">Hunter System</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {state.streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-mono font-bold text-amber-500">
              <Flame className="size-3.5" />
              <span>{state.streak}d streak</span>
            </span>
          )}
          <HunterRankBadge levelOrTier={level} size="sm" showIcon={true} />
        </div>
      </div>

      {/* Hunter Status Showcase */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-card/80 to-card/40 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <Avatar
                size={88}
                src={profile.avatar}
                frame={profile.frame || state.equippedFrame}
                name={displayName}
                animateFrame
                className="relative rounded-full ring-4 ring-card shadow-2xl"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  <TextEffectRenderer
                    text={displayName}
                    effectId={state.equippedTextEffect}
                    fontId={state.equippedFontStyle}
                    colorId={profile.nameColor || state.equippedNameColor}
                    fallbackClass="text-foreground"
                  />
                </h2>
                {username && (
                  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
                    @{username}
                  </span>
                )}
              </div>

              {/* Bio shown directly here instead of Novice Hunter */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <HunterRankBadge levelOrTier={level} size="xs" />
                <span className="text-xs font-mono font-bold text-accent">
                  {state.equippedTitle && state.equippedTitle !== 'Novice Hunter' ? state.equippedTitle : 'Otaku'}
                </span>
                {profile.bio ? (
                  <>
                    <span className="text-muted/60">•</span>
                    <span className="text-xs text-foreground/85 leading-relaxed italic line-clamp-1">
                      “{profile.bio}”
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-baseline sm:items-end gap-1">
            <span className="text-[11px] font-mono text-muted uppercase tracking-wider">Total Energy</span>
            <span className="font-display text-2xl sm:text-3xl font-black text-foreground">
              {state.totalXp.toLocaleString()}{' '}
              <span className="text-xs font-mono font-bold text-accent">XP</span>
            </span>
          </div>
        </div>

        {/* Level XP Progress HUD */}
        <div className="mt-6 pt-5 border-t border-border/50 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-foreground font-bold">
              Level <span className="text-accent">{level}</span>
            </span>
            <span className="text-muted">
              <strong className="text-foreground font-semibold">
                {progress.xpIntoCurrentLevel.toLocaleString()}
              </strong>{' '}
              / {progress.xpNeededForThisLevel.toLocaleString()} XP ({progress.percent}%)
            </span>
          </div>

          <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/40 border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-accent via-rose-500 to-amber-400"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted pt-0.5">
            <span>{progress.xpRemaining.toLocaleString()} XP to Level {level + 1}</span>
            {nextPerk && (
              <span className="text-foreground font-medium">
                Next Milestone: {nextPerk.badge} {nextPerk.title} (Lv {nextPerk.level})
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-border/60">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs sm:text-sm font-bold transition active:scale-95',
                on
                  ? 'border-accent bg-accent/15 text-accent shadow-sm'
                  : 'border-transparent bg-transparent text-muted hover:border-border/60 hover:text-foreground'
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: HUNTER RANK LADDER */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border/60 bg-card-2/40 p-4">
              <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Current Tier</p>
              <p className="text-lg font-display font-black text-foreground mt-0.5">{rank.name}</p>
              <p className="text-[11px] text-muted truncate mt-0.5">{rank.title}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card-2/40 p-4">
              <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Daily Streak</p>
              <p className="text-lg font-display font-black text-amber-500 mt-0.5 flex items-center gap-1">
                <Flame className="size-4" />
                <span>{state.streak} Days</span>
              </p>
              <p className="text-[11px] text-muted mt-0.5">Best: {state.longestStreak} days</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card-2/40 p-4">
              <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Achievements</p>
              <p className="text-lg font-display font-black text-foreground mt-0.5">
                {state.achievements.length} <span className="text-xs font-normal text-muted">/ {ACHIEVEMENTS.length}</span>
              </p>
              <p className="text-[11px] text-muted mt-0.5">Permanent milestones</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card-2/40 p-4">
              <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Daily Check-In</p>
              <p className="text-lg font-display font-black text-emerald-500 mt-0.5">
                {state.lastLoginDate ? 'Completed' : 'Pending'}
              </p>
              <p className="text-[11px] text-muted mt-0.5">+20 XP daily</p>
            </div>
          </div>

          {/* Ascension Road Ladder (Minimalist Titanium Insignia Cards) */}
          <section className="rounded-3xl border border-[#242730] bg-[#0B0C0F] p-5 sm:p-7 shadow-2xl">
            <div className="mb-6">
              <h3 className="font-display text-lg font-bold text-[#F4F4F5]">
                Hunter Rank Ascension Road
              </h3>
              <p className="text-xs text-[#9298A4] mt-0.5">
                Progress through hunter ranks by earning XP. Every rank unlocks new cosmetic permissions and prestige.
              </p>
            </div>

            <div className="space-y-2.5">
              {Object.values(HUNTER_RANKS).map((r) => {
                const isCurrent = r.tier === rank.tier
                const isCleared = level > r.maxLevel
                const isLocked = level < r.minLevel

                const accentColor = {
                  E: '#94A3B8', // Graphite Silver
                  D: '#38BDF8', // Titanium Blue
                  C: '#10B981', // Emerald
                  B: '#A855F7', // Amethyst
                  A: '#F59E0B', // Champagne Gold
                  S: '#EF4444', // Crimson Steel
                  SS: '#38BDF8', // Platinum Ice
                }[r.tier] || r.color

                return (
                  <div
                    key={r.tier}
                    className={cn(
                      'group relative rounded-[14px] border p-3.5 sm:p-4 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5',
                      isCurrent
                        ? 'border-[var(--rank-accent)] bg-[#111318] shadow-md'
                        : isCleared
                        ? 'border-[#242730] bg-[#111318] hover:border-[#383C49]'
                        : isLocked
                        ? 'border-[#242730]/60 bg-[#111318]/50 opacity-60 hover:opacity-85'
                        : 'border-[#242730] bg-[#111318]'
                    )}
                    style={{
                      ['--rank-accent' as any]: accentColor,
                    }}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* 46px Insignia Recessed Container */}
                      <div className="size-[46px] rounded-[10px] grid place-items-center shrink-0 border border-[#242730] bg-[#0B0C0F] transition-colors duration-200 group-hover:border-[#383C49]">
                        <HunterRankInsignia
                          tier={r.tier}
                          size={36}
                          animated={isCurrent}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-mono text-sm sm:text-base font-black tracking-wide text-[#F4F4F5]">
                            {r.name}
                          </h4>
                          <span className="text-xs font-mono font-medium text-[#9298A4]">
                            ({r.title})
                          </span>
                          <span className="rounded-full border border-[#242730] bg-[#0B0C0F] px-2 py-0.5 text-[10px] font-mono text-[#9298A4]">
                            Lv {r.minLevel}{r.maxLevel === 999 ? '+' : `–${r.maxLevel}`}
                          </span>
                        </div>
                        <p className="text-xs text-[#9298A4] mt-1 leading-relaxed line-clamp-1 sm:line-clamp-none">
                          {r.description}
                        </p>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                      {isCurrent ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-bold border transition-colors"
                          style={{
                            backgroundColor: `${accentColor}18`,
                            borderColor: `${accentColor}40`,
                            color: accentColor,
                          }}
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: accentColor }}
                          />
                          <span>CURRENT</span>
                        </span>
                      ) : isCleared ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[#9298A4]">
                          <Check className="size-3.5 text-neutral-400 stroke-[2.5]" />
                          <span>CLEARED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-[#9298A4]/70">
                          <Lock className="size-3" />
                          <span>Lv {r.minLevel}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: QUESTS & COMMISSIONS */}
      {activeTab === 'quests' && (
        <div className="space-y-6">
          {/* Daily Commissions */}
          <section className="rounded-3xl border border-border/60 bg-card-2/40 p-5 sm:p-7 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-border/50 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                  <ChevronsUp className="size-4 text-accent" />
                  <span>Daily Hunter Commissions</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Complete daily anime viewing, reading, and check-in tasks to claim XP.
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-mono text-muted">
                <Clock className="size-3.5 text-accent" />
                <span>Resets in: <strong className="text-foreground">{timeUntilReset || '...'}</strong> (UTC)</span>
              </div>
            </div>

            <div className="divide-y divide-border/50">
              {DAILY_QUEST_TEMPLATES.map((q) => {
                const userQ = state.quests[q.id]
                const progressVal = userQ ? userQ.progress : 0
                const isCompleted = userQ ? userQ.completed : false
                const isClaimed = userQ ? userQ.claimed : false
                const percent = Math.min(100, Math.round((progressVal / q.target) * 100))

                return (
                  <div key={q.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <span className="text-2xl shrink-0 mt-0.5">{q.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">{q.title}</h4>
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                            +{q.xpReward} XP
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">{q.description}</p>

                        <div className="mt-2.5 flex items-center gap-3 max-w-xs">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                            <div
                              className="h-full rounded-full bg-accent transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-muted shrink-0">
                            {progressVal}/{q.target}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 sm:self-center">
                      {isClaimed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-500">
                          <Check className="size-3.5 stroke-[3]" /> Claimed
                        </span>
                      ) : isCompleted ? (
                        <button
                          type="button"
                          disabled={claimLoading === q.id}
                          onClick={() => handleClaim(q.id)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                        >
                          <Check className="size-3.5 stroke-[3]" />
                          <span>{claimLoading === q.id ? 'Claiming…' : `Claim +${q.xpReward} XP`}</span>
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-muted">In progress</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Weekly Expeditions */}
          <section className="rounded-3xl border border-border/60 bg-card-2/40 p-5 sm:p-7 shadow-xl">
            <div className="mb-5 border-b border-border/50 pb-4">
              <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Trophy className="size-4 text-accent" />
                <span>Weekly Expeditions</span>
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Larger objectives that reward substantial XP throughout your week.
              </p>
            </div>

            <div className="divide-y divide-border/50">
              {WEEKLY_QUEST_TEMPLATES.map((q) => {
                const userQ = state.quests[q.id]
                const progressVal = userQ ? userQ.progress : 0
                const isCompleted = userQ ? userQ.completed : false
                const isClaimed = userQ ? userQ.claimed : false
                const percent = Math.min(100, Math.round((progressVal / q.target) * 100))

                return (
                  <div key={q.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <span className="text-2xl shrink-0 mt-0.5">{q.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">{q.title}</h4>
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                            +{q.xpReward} XP
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">{q.description}</p>

                        <div className="mt-2.5 flex items-center gap-3 max-w-xs">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                            <div
                              className="h-full rounded-full bg-accent transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-muted shrink-0">
                            {progressVal}/{q.target}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 sm:self-center">
                      {isClaimed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-500">
                          <Check className="size-3.5 stroke-[3]" /> Claimed
                        </span>
                      ) : isCompleted ? (
                        <button
                          type="button"
                          disabled={claimLoading === q.id}
                          onClick={() => handleClaim(q.id)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                        >
                          <Check className="size-3.5 stroke-[3]" />
                          <span>{claimLoading === q.id ? 'Claiming…' : `Claim +${q.xpReward} XP`}</span>
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-muted">In progress</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: ACHIEVEMENTS */}
      {activeTab === 'achievements' && (
        <section className="rounded-3xl border border-border/60 bg-card-2/40 p-5 sm:p-7 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-border/50 pb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Trophy className="size-4 text-accent" />
                <span>Permanent Achievements</span>
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Milestones rewarding dedicated activity across Zenkai.
              </p>
            </div>

            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-mono font-semibold text-muted">
              {state.achievements.length} / {ACHIEVEMENTS.length} Unlocked
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACHIEVEMENTS.map((ach) => {
              const isUnlocked = state.achievements.includes(ach.id)

              return (
                <div
                  key={ach.id}
                  className={cn(
                    'rounded-2xl border p-4 transition flex items-start gap-3.5',
                    isUnlocked
                      ? 'border-border/60 bg-card/60'
                      : 'border-border/30 bg-card-2/20 opacity-50'
                  )}
                >
                  <div className="text-2xl shrink-0 mt-0.5">{ach.badgeIcon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground truncate">{ach.title}</h4>
                      <span className="text-[10px] font-mono font-bold text-accent shrink-0">
                        +{ach.xpReward} XP
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">{ach.description}</p>
                    <div className="mt-2 text-[10px] font-mono">
                      {isUnlocked ? (
                        <span className="text-emerald-500 font-bold">✓ Unlocked</span>
                      ) : (
                        <span className="text-muted">🔒 Locked</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* TAB 4: ARMORY */}
      {activeTab === 'armory' && (
        <section className="rounded-3xl border border-border/60 bg-card-2/40 p-5 sm:p-7 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <Palette className="size-4 text-accent" />
                <span>Cosmetic Armory</span>
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Customize your name color, text aura, frames, and titles.
              </p>
            </div>

            {/* Sub-tabs */}
            <div className="inline-flex rounded-full border border-border bg-card p-1">
              {(['colors', 'fonts', 'effects', 'frames', 'titles'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setArmoryTab(st)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition',
                    armoryTab === st ? 'bg-accent text-accent-fg' : 'text-muted hover:text-foreground'
                  )}
                >
                  {st === 'colors' ? 'Name Colours' : st === 'fonts' ? 'Fonts' : st === 'effects' ? 'Shaders' : st === 'frames' ? 'Frames' : 'Titles'}
                </button>
              ))}
            </div>
          </div>

          {/* 1. Name Colours */}
          {armoryTab === 'colors' && (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                Pick your signature name color or animated gradient palette:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {NAME_COLORS.map((col) => {
                  const unlocked = isNameColorUnlocked(col.id, level)
                  const isEquipped = (profile.nameColor || state.equippedNameColor || 'default') === col.id

                  return (
                    <div
                      key={col.id}
                      onClick={() => {
                        if (!unlocked) {
                          toast(`🔒 Requires Hunter Level ${col.minLevel}!`, 'error')
                          return
                        }
                        const val = col.id === 'default' ? null : col.id
                        saveProfile({ nameColor: val })
                        equipCosmetic('color', val)
                        toast(val ? `Equipped: ${col.name}` : 'Reset to default color')
                      }}
                      className={cn(
                        'rounded-2xl border p-3 transition flex flex-col justify-between cursor-pointer select-none',
                        isEquipped
                          ? 'border-accent bg-accent/15 ring-2 ring-accent/30 shadow-sm'
                          : unlocked
                          ? 'border-border/60 bg-card/60 hover:border-accent/50'
                          : 'border-border/30 bg-card-2/20 opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="size-3.5 rounded-full shrink-0 border border-white/20 shadow-sm"
                          style={{
                            background: col.isGradient
                              ? 'linear-gradient(135deg, var(--accent), #f59e0b, #a855f7)'
                              : col.colorHex,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate text-foreground">{col.name}</p>
                          <span className="text-[10px] font-mono text-muted">
                            {col.minLevel > 1 ? `Lv ${col.minLevel}` : 'Free'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono">
                        <span className={cn('font-bold truncate max-w-[80px]', col.cssClass)}>
                          {displayName}
                        </span>
                        {isEquipped ? (
                          <span className="text-accent font-bold text-[10px]">Active</span>
                        ) : !unlocked ? (
                          <span className="text-amber-500 text-[10px]">🔒 Lv {col.minLevel}</span>
                        ) : (
                          <span className="text-muted text-[10px]">Pick</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2. Fonts (Clean Minimal Typography Specimen List - No Card UI) */}
          {armoryTab === 'fonts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <p>Select your signature typography identity ({FONT_STYLES.length} styles):</p>
                <span className="font-mono text-[11px] text-[#9298A4]">
                  Active: <strong className="text-accent">{FONT_STYLES.find(f => f.id === state.equippedFontStyle)?.name.split(' (')[0] || 'Outfit'}</strong>
                </span>
              </div>

              <div className="divide-y divide-[#242730]/60 rounded-2xl border border-[#242730]/70 bg-[#0B0C0F]/90 overflow-hidden">
                {FONT_STYLES.map((f) => {
                  const unlocked = isFontUnlocked(f.id, level)
                  const isEquipped = (state.equippedFontStyle || 'default') === f.id
                  const cleanName = f.name.split(' (')[0]
                  const subTag = f.name.includes('(') ? f.name.split('(')[1].replace(')', '') : ''

                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        if (!unlocked) {
                          toast(`🔒 Requires Hunter Level ${f.minLevel}!`, 'error')
                          return
                        }
                        equipCosmetic('font', isEquipped ? 'default' : f.id)
                        toast(isEquipped ? 'Font reset to Modern Obsidian' : `Equipped font: ${cleanName}`)
                      }}
                      className={cn(
                        'group flex items-center justify-between py-4 px-4 sm:px-6 transition-all duration-150 cursor-pointer select-none',
                        isEquipped
                          ? 'bg-accent/10'
                          : unlocked
                          ? 'hover:bg-white/[0.03]'
                          : 'opacity-40 hover:opacity-60 cursor-not-allowed'
                      )}
                    >
                      {/* Left: Font Name in authentic typeface + theme subtitle */}
                      <div className="flex items-baseline gap-3.5 min-w-0 flex-1 pr-4">
                        <span
                          className={cn(
                            'text-2xl sm:text-3xl tracking-wide transition-colors leading-none',
                            isEquipped ? 'text-accent font-bold' : 'text-[#F4F4F5] group-hover:text-white'
                          )}
                          style={{ fontFamily: f.fontFamily, letterSpacing: f.letterSpacing }}
                        >
                          {cleanName}
                        </span>
                        {subTag && (
                          <span className="hidden sm:inline text-xs font-mono text-[#9298A4] opacity-70">
                            {subTag}
                          </span>
                        )}
                      </div>

                      {/* Right: Level / Active indicator */}
                      <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
                        {isEquipped ? (
                          <span className="inline-flex items-center gap-1.5 font-bold text-accent">
                            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                            <span>ACTIVE</span>
                          </span>
                        ) : unlocked ? (
                          <span className="text-[#9298A4] group-hover:text-white transition-colors">
                            {f.minLevel > 1 ? `Lv ${f.minLevel}` : 'Free'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#9298A4]/60">
                            <Lock className="size-3" />
                            <span>Lv {f.minLevel}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3. Text Effects (Surface Shaders) */}
          {armoryTab === 'effects' && (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                Animated surface shaders and kinetic typography applied to your username:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TEXT_EFFECTS.map((eff) => {
                  const unlocked = isEffectUnlocked(eff.id, level)
                  const isEquipped = state.equippedTextEffect === eff.id

                  return (
                    <div
                      key={eff.id}
                      onClick={() => {
                        if (!unlocked) {
                          toast(`🔒 Requires Hunter Level ${eff.minLevel}!`, 'error')
                          return
                        }
                        equipCosmetic('effect', isEquipped ? 'none' : eff.id)
                        toast(isEquipped ? 'Text effect removed' : `Equipped: ${eff.name}`)
                      }}
                      className={cn(
                        'rounded-2xl border p-4 transition flex flex-col justify-between cursor-pointer',
                        isEquipped
                          ? 'border-accent bg-card/60 ring-1 ring-accent shadow-sm'
                          : unlocked
                          ? 'border-border/60 bg-card/60 hover:border-accent/50'
                          : 'border-border/30 bg-card-2/20 opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div>
                        {/* Header: Shader Name & Level Requirement */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="size-2 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: eff.glowColor && eff.glowColor !== 'transparent' ? eff.glowColor : 'var(--accent)' }}
                            />
                            <h4 className="text-sm font-bold text-foreground truncate font-display">
                              {eff.name}
                            </h4>
                          </div>
                          <span className="rounded-full border border-border/80 bg-card px-2 py-0.5 text-[10px] font-mono text-muted shrink-0">
                            {eff.minLevel > 1 ? `Lv ${eff.minLevel}` : 'Free'}
                          </span>
                        </div>

                        {/* Live Shader Preview on Clean Card Surface */}
                        <div className="py-4 my-0.5 flex items-center justify-center text-center">
                          <div className="text-xl sm:text-2xl font-black tracking-wide text-center truncate max-w-full -mx-8 px-8 -my-5 py-5">
                            <TextEffectRenderer
                              text={displayName}
                              effectId={eff.id}
                              fontId={state.equippedFontStyle}
                              fallbackClass="text-foreground"
                            />
                          </div>
                        </div>

                        <p className="text-xs text-muted leading-relaxed line-clamp-2 mt-1">{eff.description}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-xs font-mono">
                        <span className="text-[10px] text-muted">Surface Shader</span>
                        <span className={cn('font-bold', isEquipped ? 'text-accent' : unlocked ? 'text-accent' : 'text-amber-500')}>
                          {isEquipped ? '✓ EQUIPPED' : unlocked ? 'EQUIP' : `🔒 Lv ${eff.minLevel}`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. Frames */}
          {armoryTab === 'frames' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">
                    Select an animated frame overlay for your avatar ({FRAMES.length} total available):
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[200px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={frameSearch}
                    onChange={(e) => setFrameSearch(e.target.value)}
                    placeholder={`Search ${FRAMES.length} frames...`}
                    className="w-full rounded-full border border-border/80 bg-card/60 pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none transition-colors"
                  />
                  {frameSearch && (
                    <button
                      type="button"
                      onClick={() => setFrameSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-border/40">
                <button
                  type="button"
                  onClick={() => setFrameCategory('')}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-mono font-medium transition active:scale-95',
                    frameCategory === ''
                      ? 'bg-accent text-accent-fg font-bold shadow-sm'
                      : 'border border-border/60 bg-card/40 text-muted hover:text-foreground hover:border-border'
                  )}
                >
                  All ({FRAMES.length})
                </button>
                {Object.values(FRAME_GROUPS).map((group) => {
                  const count = FRAMES.filter((f) => frameGroup(f) === group).length
                  const on = frameCategory === group
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setFrameCategory(on ? '' : group)}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1 text-xs font-mono font-medium transition active:scale-95',
                        on
                          ? 'bg-accent text-accent-fg font-bold shadow-sm'
                          : 'border border-border/60 bg-card/40 text-muted hover:text-foreground hover:border-border'
                      )}
                    >
                      {group} ({count})
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                <span>Showing {filteredFrames.length} frames</span>
                {profile.frame && (
                  <button
                    type="button"
                    onClick={() => {
                      saveProfile({ frame: null })
                      equipCosmetic('frame', null)
                      toast('Frame removed')
                    }}
                    className="text-accent hover:underline"
                  >
                    Remove active frame
                  </button>
                )}
              </div>

              {/* Grid with ALL Filtered Frames */}
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {/* None option (when no active filter) */}
                {!frameCategory && !frameSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      saveProfile({ frame: null })
                      equipCosmetic('frame', null)
                      toast('Frame removed')
                    }}
                    className={cn(
                      'grid aspect-square w-full place-items-center rounded-2xl border text-xs font-bold transition active:scale-95',
                      !profile.frame && !state.equippedFrame
                        ? 'border-accent bg-accent/15 text-accent ring-2 ring-accent'
                        : 'border-border text-muted hover:border-accent/50'
                    )}
                  >
                    None
                  </button>
                )}

                {filteredFrames.map((f) => {
                  const unlocked = isFrameUnlocked(f.id, level)
                  const reqLvl = FRAME_LEVEL_REQUIREMENTS[f.id] || 1
                  const on = (profile.frame || state.equippedFrame) === f.id

                  return (
                    <button
                      key={f.id}
                      type="button"
                      title={unlocked ? f.name : `${f.name} (Requires Level ${reqLvl})`}
                      onClick={() => {
                        if (!unlocked) {
                          toast(`🔒 Requires Hunter Level ${reqLvl}!`, 'error')
                          return
                        }
                        saveProfile({ frame: f.id })
                        equipCosmetic('frame', f.id)
                        toast(`Frame: ${f.name}`)
                      }}
                      className={cn(
                        'group relative aspect-square w-full overflow-hidden rounded-2xl border bg-card-2/60 transition-all duration-200 hover:scale-[1.03] active:scale-95',
                        on ? 'border-accent ring-2 ring-accent shadow-md shadow-accent/20' : 'border-border/80 hover:border-accent/60',
                        !unlocked && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      {/* Avatar Preview Silhouette inside frame */}
                      <span className="absolute left-1/2 top-1/2 size-[82%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-card ring-1 ring-border/60">
                        {profile.avatar && (
                          <img
                            src={profile.avatar}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="size-full object-cover"
                          />
                        )}
                      </span>

                      {/* Animated APNG / Frame Layer */}
                      <img
                        src={frameUrl(f)}
                        alt={f.name}
                        loading="lazy"
                        className={cn('relative size-full object-contain pointer-events-none', !unlocked && 'grayscale-[40%]')}
                      />

                      {/* Active Checkmark Pill */}
                      {on && (
                        <div className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-accent-fg shadow">
                          <Check className="size-2.5 stroke-[3]" />
                        </div>
                      )}

                      {/* Locked Overlay */}
                      {!unlocked && (
                        <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex flex-col items-center justify-center p-1 text-center">
                          <Lock className="size-3.5 text-amber-400 mb-0.5" />
                          <span className="text-[9px] font-mono font-bold text-amber-300">
                            Lv {reqLvl}
                          </span>
                        </div>
                      )}

                      {/* Hover Name Tooltip Banner */}
                      <div className="absolute bottom-0 inset-x-0 bg-black/80 px-1 py-0.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] font-mono text-white truncate block">
                          {f.name}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. Titles */}
          {armoryTab === 'titles' && (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                Prestige titles displayed below your username:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {HUNTER_TITLES.map((t) => {
                  const unlocked = isTitleUnlocked(t.title, level)
                  const isEquipped = state.equippedTitle === t.title

                  return (
                    <div
                      key={t.title}
                      onClick={() => {
                        if (!unlocked) {
                          toast(`🔒 Requires Hunter Level ${t.minLevel}!`, 'error')
                          return
                        }
                        equipCosmetic('title', t.title)
                        toast(`Equipped title: ${t.title}`)
                      }}
                      className={cn(
                        'rounded-2xl border p-4 transition flex flex-col justify-between cursor-pointer',
                        isEquipped
                          ? 'border-accent bg-accent/15 ring-2 ring-accent/30 shadow-sm'
                          : unlocked
                          ? 'border-border/60 bg-card/60 hover:border-accent/50'
                          : 'border-border/30 bg-card-2/20 opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
                          <span className="text-muted">Level {t.minLevel}</span>
                          {isEquipped && <span className="text-accent font-bold">Active</span>}
                        </div>

                        <p className="font-mono text-sm font-bold text-foreground">{t.title}</p>
                        <p className="text-xs text-muted leading-tight mt-0.5">{t.description}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/50 text-right text-xs font-semibold text-accent">
                        {isEquipped ? 'Equipped' : unlocked ? 'Equip' : `Unlocks at Lv ${t.minLevel}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default AscensionPage