import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Check,
  Copy,
  MessageSquare,
  Palette,
  Flame,
  Calendar,
  Users,
} from 'lucide-react'
import { Avatar } from './Avatar'
import { TextEffectRenderer } from './ascension/TextEffectRenderer'
import { getLevelProgress, getHunterRank } from '../lib/ascension/types'
import { getAscensionState } from '../lib/ascension/ascensionStore'
import type { PublicUserData } from '../lib/profile'

const spring = { type: 'spring', stiffness: 260, damping: 22 } as const

export function PublicProfileCard({
  data,
  isSelf = false,
  watchlist = [],
}: {
  data: PublicUserData
  isSelf?: boolean
  watchlist?: any[]
}) {
  const [copied, setCopied] = useState(false)
  const { profile, username, watchlistCount = 0, historyCount = 0, readingCount = 0 } = data

  const localAscension = isSelf ? getAscensionState() : null
  const userLevel = localAscension?.level ?? data.level ?? 1
  const userTotalXp = localAscension?.totalXp ?? data.totalXp ?? 0
  const userStreak = localAscension?.streak ?? data.streak ?? 0
  const rawTitle = localAscension?.equippedTitle ?? data.equippedTitle ?? 'Otaku'
  const userTitle = rawTitle === 'Novice Hunter' ? 'Otaku' : rawTitle
  const userTextEffect = localAscension?.equippedTextEffect ?? data.equippedTextEffect ?? 'none'
  const userFontStyle = localAscension?.equippedFontStyle ?? data.equippedFontStyle ?? 'default'
  const userNameColor = profile.nameColor || data.nameColor || localAscension?.equippedNameColor

  const userProgress = getLevelProgress(userTotalXp)
  const userRank = getHunterRank(userLevel)
  const displayName = profile.name || username

  const listItems = watchlist && watchlist.length > 0 ? watchlist : (data.watchlist || [])
  const completedCount = listItems.filter((i: any) => i.status === 'completed').length || watchlistCount
  const watchingCount = listItems.filter((i: any) => i.status === 'watching').length || historyCount
  const planningCount = listItems.filter((i: any) => i.status === 'planning' || i.status === 'plan_to_watch').length || readingCount

  const joinedDateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'October 3, 2026'

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/u/${username}`
    const name = profile.name || username
    const { shareCard } = await import('../lib/shareCard')
    await shareCard(
      { kind: 'profile', eyebrow: 'Join me on Zenkai', title: name, subtitle: `@${username}`, image: profile.banner, avatar: profile.avatar, initial: name },
      url,
      `${name} (@${username}) is inviting you to Zenkai — watch anime & movies together`,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.05 }}
      className={`relative pb-8 border-b border-[#242730]/60 ${profile.banner ? 'pt-24 sm:pt-32' : 'pt-2 sm:pt-4'}`}
    >
      {/* Banner: sharp and visible, fading into the page so the avatar/text stay readable */}
      {profile.banner ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 sm:h-60 overflow-hidden rounded-3xl">
          <img
            src={profile.banner}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent via-40% to-background" />
        </div>
      ) : null}

      {/* Main Content Layout matching clean luxury Zenkai identity */}
      <div className="relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
          {/* Left Group: Avatar + Identity + Level Progress */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 min-w-0 flex-1">
            {/* Avatar with Overlapping Level Badge */}
            <div className="relative shrink-0">
              <Avatar
                size={96}
                src={profile.avatar}
                frame={profile.frame}
                name={displayName}
                animateFrame
                className="relative rounded-full ring-4 ring-[#111318] bg-[#111318] shadow-2xl"
              />
              {/* Overlapping Hex/Pill Level Badge centered at bottom edge */}
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center justify-center min-w-[38px] px-2 py-0.5 rounded-lg bg-[#0B0C0F] border border-[#242730] shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                <span className="text-[8px] font-mono font-bold leading-none text-[#9298A4] tracking-widest uppercase">
                  LV
                </span>
                <span className="text-xs font-display font-black leading-tight text-[#F4F4F5]">
                  {userLevel}
                </span>
              </div>
            </div>

            {/* Identity Info */}
            <div className="min-w-0 flex-1 pt-1">
              {/* Name */}
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-[#F4F4F5] truncate max-w-full">
                <TextEffectRenderer
                  text={displayName}
                  effectId={userTextEffect}
                  fontId={userFontStyle}
                  colorId={userNameColor}
                  fallbackClass="text-foreground"
                />
              </h1>

              {/* Handle */}
              <p className="text-xs font-mono font-medium text-[#9298A4] mt-0.5">
                @{username}
              </p>

              {/* Bio / Tagline shown directly here (clean, no container box) */}
              {profile.bio?.trim() ? (
                <p className="text-xs sm:text-sm text-[#F4F4F5]/85 leading-relaxed mt-1.5 line-clamp-2">
                  {profile.bio}
                </p>
              ) : isSelf ? (
                <Link
                  to="/profile"
                  className="inline-block text-xs text-accent/80 hover:text-accent italic mt-1.5 transition"
                >
                  + Add your anime quote or bio...
                </Link>
              ) : (
                <p className="text-xs sm:text-sm text-[#9298A4]/70 italic mt-1.5">
                  This otaku hasn't written a bio yet.
                </p>
              )}

              {/* Metadata Row: Joined date + Streak showing system */}
              <div className="flex flex-wrap items-center gap-3.5 text-xs font-mono text-[#9298A4] mt-2">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-[#9298A4]/70" />
                  <span>Joined {joinedDateStr}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-500 font-bold">
                  <Flame className="size-3.5 text-amber-500" />
                  <span>{userStreak}d streak</span>
                </span>
                <span className="text-muted/60">•</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3 text-[#9298A4]/70" />
                  <span>{userRank.name} ({userTitle})</span>
                </span>
              </div>

              {/* LEVEL Progress Bar HUD */}
              <div className="mt-3.5 space-y-1.5 max-w-sm">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#F4F4F5] tracking-wider uppercase text-[11px]">
                    LEVEL {userLevel}
                  </span>
                  <span className="text-[#9298A4] text-[11px]">
                    <strong className="text-[#F4F4F5] font-semibold">
                      {userProgress.xpIntoCurrentLevel.toLocaleString()}
                    </strong>{' '}
                    / {userProgress.xpNeededForThisLevel.toLocaleString()} XP
                  </span>
                </div>

                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10 border border-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-accent via-rose-500 to-amber-400 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                    style={{ width: `${userProgress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Group: Large Stat Numbers + Action Buttons down below */}
          <div className="flex flex-col items-center sm:items-end justify-center gap-4 shrink-0 border-t border-[#242730]/60 pt-5 lg:border-t-0 lg:pt-0">
            {/* The 3 stat numbers */}
            <div className="flex items-center justify-around sm:justify-end gap-6 sm:gap-8 w-full sm:w-auto">
              <div className="text-center sm:text-right">
                <div className="font-display text-3xl sm:text-4xl font-black text-[#F4F4F5] tracking-tight">
                  {completedCount}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-[#9298A4] uppercase mt-0.5">
                  COMPLETED
                </div>
              </div>

              <div className="text-center sm:text-right">
                <div className="font-display text-3xl sm:text-4xl font-black text-[#F4F4F5] tracking-tight">
                  {watchingCount}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-[#9298A4] uppercase mt-0.5">
                  WATCHING
                </div>
              </div>

              <div className="text-center sm:text-right">
                <div className="font-display text-3xl sm:text-4xl font-black text-[#F4F4F5] tracking-tight">
                  {planningCount}
                </div>
                <div className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-[#9298A4] uppercase mt-0.5">
                  PLANNING
                </div>
              </div>
            </div>

            {/* Action Buttons down below the completed, watching and planning row */}
            <div className="flex items-center gap-2 mt-1">
              {isSelf ? (
                <Link
                  to="/profile"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95"
                >
                  <Palette className="size-3.5" />
                  <span>Edit Profile</span>
                </Link>
              ) : (
                <Link
                  to={`/messages/${username}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Message</span>
                </Link>
              )}

              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="Share public profile"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-semibold text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white active:scale-95"
              >
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                <span>{copied ? 'Copied' : 'Share Profile'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
