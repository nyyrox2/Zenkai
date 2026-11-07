import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Heart, Plus, Check, Bell, ChevronDown, X, FolderPlus } from 'lucide-react'
import type { CardItem } from '../types/anime'
import { cn, humanize } from '../lib/utils'
import {
  useListItem,
  toggleFavorite,
  isFavorite,
  setStatus,
  toggleAnimeInCustomList,
  removeFromList,
  useCustomLists,
  createCustomList,
  STATUS_LABEL,
  type ListStatus,
  meta as toMeta,
} from '../lib/library'
import { toast } from '../lib/toast'
import { useTmdb } from '../hooks/useTmdb'
import { tmdbImg } from '../services/api'

interface AnimeHoverPreviewProps {
  item: CardItem
  anchorRect: DOMRect
  onClose: () => void
  onKeepOpen?: () => void
}

const STATUS_OPTIONS: ListStatus[] = ['watching', 'planning', 'completed', 'paused', 'dropped']

export function AnimeHoverPreview({ item, anchorRect, onClose, onKeepOpen }: AnimeHoverPreviewProps) {
  const [isReminded, setIsReminded] = useState(false)
  const [showListPicker, setShowListPicker] = useState(false)
  const [creatingList, setCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')

  const savedItem = useListItem(item.id)
  const isSaved = Boolean(savedItem)
  const isLiked = Boolean(savedItem?.favorite || isFavorite(item.id))
  const customLists = useCustomLists()

  // Prominent cinematic preview width
  const previewWidth = 345

  // Fetch TMDB backdrop artwork and logo
  const tmdbBundle = useTmdb(item.id, item.title, item.format)
  const tmdbBackdrop = tmdbImg(tmdbBundle?.tmdb?.backdrop, 'w1280')
  const tmdbLogo = tmdbImg(tmdbBundle?.tmdb?.logo, 'w500')

  // Position calculation with viewport boundaries
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useEffect(() => {
    let left = anchorRect.left + anchorRect.width / 2 - previewWidth / 2
    let top = anchorRect.top + window.scrollY - 36

    // Clamp left and right to stay on screen
    const minLeft = 16
    const maxLeft = window.innerWidth - previewWidth - 16
    left = Math.max(minLeft, Math.min(maxLeft, left))

    // Prevent clipping top
    if (top < window.scrollY + 8) {
      top = window.scrollY + 8
    }

    setCoords({ top, left })
  }, [anchorRect])

  const toggleHeart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleFavorite(toMeta(item as any))
    toast(!isLiked ? 'Added to Favorites' : 'Removed from Favorites')
  }

  const handlePlusClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowListPicker((v) => !v)
  }

  const handleSelectStatus = (s: ListStatus) => {
    setStatus(item.id, s)
    setShowListPicker(false)
    toast(`Added to ${STATUS_LABEL[s]}`)
  }

  const handleToggleCustomList = (clId: string, clName: string) => {
    const inThis = savedItem?.customLists?.includes(clId)
    toggleAnimeInCustomList(item.id, clId, toMeta(item as any))
    toast(!inThis ? `Added to "${clName}"` : `Removed from "${clName}"`)
  }

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newListName.trim()
    if (!name) return
    const cl = createCustomList(name)
    toggleAnimeInCustomList(item.id, cl.id, toMeta(item as any))
    setNewListName('')
    setCreatingList(false)
    toast(`Created and added to "${cl.name}"`)
  }

  const handleRemove = () => {
    removeFromList(item.id)
    setShowListPicker(false)
    toast('Removed from watchlist')
  }

  const toggleRemind = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsReminded(!isReminded)
    toast(!isReminded ? 'Notifications enabled' : 'Notifications disabled')
  }

  const watchUrl = `/watch/${item.id}`
  const backdropImage = tmdbBackdrop || item.bannerImage || item.image
  const isLandscape = Boolean(tmdbBackdrop || item.bannerImage)
  const formatText = item.format === 'MOVIE' ? 'Movie' : (item.format === 'OVA' || item.format === 'ONA' || item.format === 'SPECIAL' || item.format === 'TV_SHORT') ? 'Extra' : 'Show'
  const seasonText = item.season ? `${humanize(item.season)} ${item.year || ''}`.trim() : (item.year ? String(item.year) : 'Fall 2026')
  const scoreText = item.score ? `${item.score}% liked` : '85% liked'
  const genresList = (item.genres && item.genres.length > 0) ? item.genres.slice(0, 3).join(', ') : 'Anime, Action, Drama'

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
        className="w-[345px] rounded-2xl overflow-hidden bg-card border border-border shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_65px_rgba(0,0,0,0.95)] flex flex-col select-none transform-gpu isolate relative text-foreground"
      >
        {/* Top Landscape Artwork Banner (TMDB Backdrop preferred) */}
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

          {/* Show Title or Official TMDB Transparent Logo Badge inside image banner */}
          <div className="absolute bottom-3 left-4 right-4 z-10 pointer-events-none">
            {tmdbLogo ? (
              <img
                src={tmdbLogo}
                alt={item.title}
                className="max-h-12 w-auto max-w-[70%] object-contain object-left drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]"
              />
            ) : (
              <span className="font-display font-black text-white text-[16px] leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] line-clamp-1">
                {item.title}
              </span>
            )}
          </div>
        </Link>

        {/* Action Controls Row */}
        <div className="relative z-10 bg-card px-4 pt-3 pb-1.5 flex items-center gap-2">
          {/* Watch Now Button */}
          <Link
            to={watchUrl}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow-sm shrink-0"
          >
            <Play className="size-3.5 fill-current stroke-[2.5]" />
            <span>Watch now</span>
          </Link>

          {/* Favorite / Heart Button: adds/removes from Favorites */}
          <button
            type="button"
            onClick={toggleHeart}
            title={isLiked ? 'In Favorites' : 'Add to Favorites'}
            className={cn(
              'grid size-9 place-items-center rounded-full transition-all active:scale-95 shrink-0 backdrop-blur-md outline-none',
              isLiked
                ? 'bg-foreground text-background ring-1 ring-inset ring-foreground shadow-sm'
                : 'bg-card-2 text-muted ring-1 ring-inset ring-white/15 hover:text-foreground hover:bg-card-2/80 hover:ring-white/30'
            )}
          >
            <Heart className={cn('size-4 stroke-[2.2]', isLiked && 'fill-current')} />
          </button>

          {/* Plus Button: Opens list picker to ask which list to add to */}
          <button
            type="button"
            onClick={handlePlusClick}
            title={isSaved ? 'Change or Add to List' : 'Add to List'}
            className={cn(
              'grid size-9 place-items-center rounded-full transition-all active:scale-95 shrink-0 backdrop-blur-md outline-none',
              showListPicker
                ? 'bg-foreground text-background ring-1 ring-inset ring-foreground shadow-sm'
                : isSaved
                ? 'ring-1 ring-inset ring-foreground/40 bg-card-2 text-foreground'
                : 'bg-card-2 text-muted ring-1 ring-inset ring-white/15 hover:text-foreground hover:bg-card-2/80 hover:ring-white/30'
            )}
          >
            {isSaved && !showListPicker ? (
              <Check className="size-4 stroke-[2.5]" />
            ) : (
              <Plus className={cn('size-4 stroke-[2.2]', showListPicker && 'rotate-45 transition-transform')} />
            )}
          </button>

          {/* Remind / Notification Bell */}
          <button
            type="button"
            onClick={toggleRemind}
            title={isReminded ? 'Notifications on' : 'Remind me'}
            className={cn(
              'grid size-9 place-items-center rounded-full transition-all active:scale-95 shrink-0 backdrop-blur-md outline-none',
              isReminded
                ? 'bg-foreground text-background ring-1 ring-inset ring-foreground shadow-sm'
                : 'bg-card-2 text-muted ring-1 ring-inset ring-white/15 hover:text-foreground hover:bg-card-2/80 hover:ring-white/30'
            )}
          >
            <Bell className={cn('size-4 stroke-[2.2]', isReminded && 'fill-current')} />
          </button>

          {/* View Details Chevron Button */}
          <Link
            to={item.href}
            title="View Details"
            className="grid size-9 place-items-center rounded-full bg-card-2 text-muted ring-1 ring-inset ring-white/15 hover:text-foreground hover:bg-card-2/80 hover:ring-white/30 transition-all active:scale-95 ml-auto shrink-0 backdrop-blur-md outline-none"
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

          <p className="text-xs text-muted font-medium font-sans">
            {formatText} · {seasonText} · {scoreText}
          </p>

          <p className="text-[11.5px] text-muted/70 truncate font-light">
            {genresList}
          </p>
        </div>

        {/* Which list picker overlay */}
        <AnimatePresence>
          {showListPicker && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              className="absolute inset-0 z-30 bg-card/98 backdrop-blur-md p-4 flex flex-col justify-between border border-border"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                  <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                    Add to which list?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowListPicker(false)}
                    className="rounded-full p-1 text-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <div className="space-y-0.5 max-h-[160px] overflow-y-auto no-scrollbar text-xs">
                  <div className="text-[10px] uppercase font-bold text-muted px-1 py-0.5">
                    Watch Status
                  </div>
                  {STATUS_OPTIONS.map((s) => {
                    const active = savedItem?.status === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSelectStatus(s)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors',
                          active
                            ? 'text-foreground font-semibold bg-card-2'
                            : 'text-muted hover:text-foreground hover:bg-card-2/60'
                        )}
                      >
                        <span>{STATUS_LABEL[s]}</span>
                        {active && <Check className="size-3 text-foreground" />}
                      </button>
                    )
                  })}

                  {customLists.length > 0 && (
                    <>
                      <div className="text-[10px] uppercase font-bold text-muted px-1 pt-2 pb-0.5">
                        Custom Lists
                      </div>
                      {customLists.map((cl) => {
                        const inThis = savedItem?.customLists?.includes(cl.id)
                        return (
                          <button
                            key={cl.id}
                            type="button"
                            onClick={() => handleToggleCustomList(cl.id, cl.name)}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors',
                              inThis
                                ? 'text-foreground font-semibold bg-card-2'
                                : 'text-muted hover:text-foreground hover:bg-card-2/60'
                            )}
                          >
                            <span className="truncate">{cl.name}</span>
                            {inThis && <Check className="size-3 text-foreground" />}
                          </button>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                {creatingList ? (
                  <form onSubmit={handleCreateList} className="flex items-center gap-1 w-full">
                    <input
                      type="text"
                      autoFocus
                      placeholder="List name..."
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      className="w-full bg-card-2 border border-border rounded-lg px-2.5 py-1 text-xs text-foreground placeholder:text-muted outline-none focus:border-foreground"
                    />
                    <button
                      type="submit"
                      disabled={!newListName.trim()}
                      className="text-foreground disabled:opacity-40 p-1"
                    >
                      <Check className="size-3.5" />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingList(true)}
                    className="text-muted hover:text-foreground text-xs font-medium inline-flex items-center gap-1"
                  >
                    <FolderPlus className="size-3.5" />
                    <span>New list</span>
                  </button>
                )}

                {isSaved && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="text-rose-500 hover:text-rose-600 text-xs font-medium ml-auto"
                  >
                    Remove
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  )
}
