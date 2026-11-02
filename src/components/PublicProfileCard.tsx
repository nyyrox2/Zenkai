import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Check,
  Copy,
  Film,
  History,
  BookOpen,
  MessageSquare,
  Palette,
  Quote,
  ShieldCheck,
} from 'lucide-react'
import { Avatar } from './Avatar'
import type { PublicUserData } from '../lib/profile'
import { toast } from '../lib/toast'

const spring = { type: 'spring', stiffness: 260, damping: 22 } as const

export function PublicProfileCard({
  data,
  isSelf = false,
}: {
  data: PublicUserData
  isSelf?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const { profile, username, watchlistCount = 0, historyCount = 0, readingCount = 0 } = data

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/u/${username}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast(`Copied @${username}'s profile link!`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Failed to copy link', 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.05 }}
      className="overflow-hidden rounded-3xl border border-border bg-card/70 shadow-2xl backdrop-blur-md"
    >
      {/* 1. Header Banner */}
      <div className="relative h-44 overflow-hidden bg-card-2 sm:h-64">
        {profile.banner ? (
          <img
            src={profile.banner}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full bg-gradient-to-br from-accent/25 via-card-2 to-card" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-black/30" />

        {/* Member Badge & Share button */}
        <div className="absolute right-3.5 top-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            aria-label="Share public profile"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/80 active:scale-95"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Share Profile'}</span>
          </button>
        </div>
      </div>

      {/* 2. Profile Details & Avatar */}
      <div className="relative px-5 pb-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4 sm:gap-5">
            {/* Avatar with Animated Frame */}
            <motion.div
              initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.15 }}
              className="relative -mt-16 ml-1 shrink-0 sm:-mt-20"
            >
              <Avatar
                size={112}
                src={profile.avatar}
                frame={profile.frame}
                name={profile.name || username}
                animateFrame
                className="relative rounded-full ring-4 ring-card shadow-2xl"
              />
            </motion.div>

            {/* Display Name, Handle & Frame Pill */}
            <div className="min-w-0 pb-1 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-2xl font-black tracking-tight sm:text-3xl">
                  {profile.name || username}
                </h1>
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
                  @{username}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card-2 px-2.5 py-0.5 text-[11px] font-bold text-muted">
                  <ShieldCheck className="size-3 text-accent" /> MEMBER
                </span>
              </div>
            </div>
          </div>

          {/* Action Button: Edit Profile (if self) or Direct Message */}
          <div className="shrink-0 pt-2 sm:pt-0">
            {isSelf ? (
              <Link
                to="/profile"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent/80 px-5 text-sm font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95"
              >
                <Palette className="size-4" />
                <span>Edit Profile</span>
              </Link>
            ) : (
              <Link
                to={`/messages/${username}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95"
              >
                <MessageSquare className="size-4" />
                <span>Message</span>
              </Link>
            )}
          </div>
        </div>

        {/* 3. Bio Section */}
        <div className="mt-6 rounded-2xl border border-border bg-card-2/60 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Quote className="size-3 text-accent" /> About / Bio
            </span>
            {isSelf && (
              <Link
                to="/profile"
                className="text-xs font-semibold text-accent hover:underline"
              >
                Edit bio
              </Link>
            )}
          </div>

          {profile.bio ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground/95 whitespace-pre-line font-medium">
              “{profile.bio}”
            </p>
          ) : (
            <p className="mt-2 text-xs italic text-muted">
              {isSelf
                ? 'You haven’t added a bio yet. Tap Edit Profile to introduce yourself!'
                : 'This otaku hasn’t written a bio yet.'}
            </p>
          )}
        </div>

        {/* 4. Anime Stats Counters */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-2xl border border-border bg-card-2/40 p-3.5 text-center sm:text-left">
            <div className="flex items-center justify-center gap-1.5 text-muted sm:justify-start">
              <Film className="size-3.5 text-accent" />
              <dt className="text-[11px] font-semibold">Watchlist</dt>
            </div>
            <dd className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">
              {watchlistCount}
            </dd>
          </div>

          <div className="rounded-2xl border border-border bg-card-2/40 p-3.5 text-center sm:text-left">
            <div className="flex items-center justify-center gap-1.5 text-muted sm:justify-start">
              <History className="size-3.5 text-accent" />
              <dt className="text-[11px] font-semibold">Watched</dt>
            </div>
            <dd className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">
              {historyCount}
            </dd>
          </div>

          <div className="rounded-2xl border border-border bg-card-2/40 p-3.5 text-center sm:text-left">
            <div className="flex items-center justify-center gap-1.5 text-muted sm:justify-start">
              <BookOpen className="size-3.5 text-accent" />
              <dt className="text-[11px] font-semibold">Manga / Novels</dt>
            </div>
            <dd className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">
              {readingCount}
            </dd>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
