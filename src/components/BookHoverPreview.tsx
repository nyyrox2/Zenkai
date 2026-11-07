import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookOpen, Heart, Plus, Check, Bell, ChevronDown } from 'lucide-react'
import type { BookCardItem } from './BookCard'
import { cn } from '../lib/utils'
import { toast } from '../lib/toast'
import { fetchMangaMeta, type MangaMeta } from '../services/manga'

interface BookHoverPreviewProps {
  item: BookCardItem
  anchorRect: DOMRect
  onClose: () => void
  onKeepOpen?: () => void
}

/** Manga-only hover preview popup strictly resolved from AniList Manga metadata (no TMDB). */
export function BookHoverPreview({ item, anchorRect, onClose, onKeepOpen }: BookHoverPreviewProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isReminded, setIsReminded] = useState(false)
  const [meta, setMeta] = useState<MangaMeta | null>(null)

  // Prominent cinematic preview width matching anime preview
  const previewWidth = 345

  // Position calculation with viewport boundaries
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useEffect(() => {
    let left = anchorRect.left + anchorRect.width / 2 - previewWidth / 2
    let top = anchorRect.top + window.scrollY - 36

    const minLeft = 16
    const maxLeft = window.innerWidth - previewWidth - 16
    left = Math.max(minLeft, Math.min(maxLeft, left))

    if (top < window.scrollY + 8) {
      top = window.scrollY + 8
    }

    setCoords({ top, left })
  }, [anchorRect])

  // Resolve Manga metadata strictly from AniList MANGA database (no TMDB)
  useEffect(() => {
    let off = false
    fetchMangaMeta(item.title).then((m) => {
      if (!off && m) setMeta(m)
    })
    return () => {
      off = true
    }
  }, [item.title])

  const toggleHeart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsLiked(!isLiked)
    toast(!isLiked ? 'Added to favorites' : 'Removed from favorites')
  }

  const toggleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsSaved(!isSaved)
    toast(!isSaved ? 'Added to reading list' : 'Removed from reading list')
  }

  const toggleRemind = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsReminded(!isReminded)
    toast(!isReminded ? 'Notifications enabled' : 'Notifications disabled')
  }

  // Official AniList manga banner, with fallback to AniList cover or item image
  const backdropImage = meta?.banner || meta?.cover || item.image
  const isLandscape = Boolean(meta?.banner)
  const formatText = meta?.format || item.badge || 'Manga'
  const chapterText = meta?.chapters ? `${meta.chapters} chapters` : (item.caption || 'Ongoing')
  const scoreText = meta?.score
    ? `${Math.round(meta.score * 10)}% liked`
    : (item.score ? `${item.score} rating` : 'Recommended')
  const genresList = (meta?.genres && meta.genres.length > 0)
    ? meta.genres.slice(0, 3).join(', ')
    : (item.genres && item.genres.length > 0 ? item.genres.slice(0, 3).join(', ') : 'Action, Adventure, Fantasy')

  return createPortal(
    <div
      style={{ position: 'absolute', top: coords.top, left: coords.left, zIndex: 9999 }}
      onMouseEnter={onKeepOpen}
      onMouseLeave={onClose}
      className="pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 3 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        style={{
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
        className="w-[345px] rounded-2xl overflow-hidden bg-card border border-border shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_65px_rgba(0,0,0,0.95)] flex flex-col select-none transform-gpu isolate text-foreground"
      >
        {/* Top Artwork Banner */}
        <Link to={item.href} className="relative h-[190px] w-full block overflow-hidden bg-card-2 group/img -mb-px">
          <img
            src={backdropImage}
            alt={item.title}
            referrerPolicy="no-referrer"
            className={cn(
              'w-full h-full filter brightness-[0.93] group-hover/img:scale-105 transition-transform duration-500 ease-out',
              isLandscape ? 'object-cover object-center' : 'object-cover object-[center_20%]'
            )}
          />

          {/* Vignette Gradient on image with smooth fade into card */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 -bottom-1 h-14 bg-gradient-to-t from-card to-transparent pointer-events-none" />

          {/* Clean Manga Title Badge inside image banner */}
          <div className="absolute bottom-3 left-4 right-4 z-10 pointer-events-none">
            <span className="font-display font-black text-white text-[16px] leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] line-clamp-1">
              {item.title}
            </span>
          </div>
        </Link>

        {/* Action Controls Row */}
        <div className="relative z-10 bg-card px-4 pt-3 pb-1.5 flex items-center gap-2">
          {/* Read Now Button */}
          <Link
            to={item.href}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow-sm shrink-0"
          >
            <BookOpen className="size-3.5 stroke-[2.5]" />
            <span>Read now</span>
          </Link>

          {/* Favorite / Heart Button */}
          <button
            type="button"
            onClick={toggleHeart}
            title={isLiked ? 'Liked' : 'Like'}
            className={cn(
              'grid size-9 place-items-center rounded-full border transition-all active:scale-90 shrink-0',
              isLiked
                ? 'bg-foreground text-background border-foreground shadow-sm'
                : 'border-border bg-card-2 text-muted hover:text-foreground hover:bg-card-2/80 hover:border-foreground/30'
            )}
          >
            <Heart className={cn('size-4 stroke-[2.2]', isLiked && 'fill-current')} />
          </button>

          {/* Library / Plus Button */}
          <button
            type="button"
            onClick={toggleWatchlist}
            title={isSaved ? 'In Reading List' : 'Add to Reading List'}
            className={cn(
              'grid size-9 place-items-center rounded-full border transition-all active:scale-90 shrink-0',
              isSaved
                ? 'bg-foreground text-background border-foreground shadow-sm'
                : 'border-border bg-card-2 text-muted hover:text-foreground hover:bg-card-2/80 hover:border-foreground/30'
            )}
          >
            {isSaved ? (
              <Check className="size-4 stroke-[2.5]" />
            ) : (
              <Plus className="size-4 stroke-[2.2]" />
            )}
          </button>

          {/* Remind / Notification Bell */}
          <button
            type="button"
            onClick={toggleRemind}
            title={isReminded ? 'Notifications on' : 'Remind me'}
            className={cn(
              'grid size-9 place-items-center rounded-full border transition-all active:scale-90 shrink-0',
              isReminded
                ? 'bg-foreground text-background border-foreground shadow-sm'
                : 'border-border bg-card-2 text-muted hover:text-foreground hover:bg-card-2/80 hover:border-foreground/30'
            )}
          >
            <Bell className={cn('size-4 stroke-[2.2]', isReminded && 'fill-current')} />
          </button>

          {/* View Details Chevron Button */}
          <Link
            to={item.href}
            title="View Details"
            className="grid size-9 place-items-center rounded-full border border-border bg-card-2 text-muted hover:text-foreground hover:bg-card-2/80 hover:border-foreground/30 transition-all active:scale-90 ml-auto shrink-0"
          >
            <ChevronDown className="size-4 stroke-[2.2]" />
          </Link>
        </div>

        {/* Text Information Details */}
        <div className="relative z-10 bg-card px-4 pb-3.5 pt-1 space-y-1">
          <Link to={item.href} className="block group/t">
            <h4 className="text-[15px] font-bold text-foreground tracking-tight leading-snug line-clamp-1 group-hover/t:text-accent transition-colors">
              {item.title}
            </h4>
          </Link>

          {meta?.nativeTitle && (
            <p className="text-[10.5px] text-muted/70 font-normal line-clamp-1 truncate">
              {meta.nativeTitle}
            </p>
          )}

          <p className="text-xs text-muted font-medium font-sans">
            {formatText} · {chapterText} · {scoreText}
          </p>

          <p className="text-[11.5px] text-muted/70 truncate font-light">
            {genresList}
          </p>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
