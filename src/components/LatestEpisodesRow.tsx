import { useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import type { LatestEpisodeItem } from '../services/anilist'
import type { CardItem } from '../types/anime'
import { pickTitle } from '../lib/utils'
import { useTmdb } from '../hooks/useTmdb'
import { tmdbImg } from '../services/api'
import { AnimeHoverPreview } from './AnimeHoverPreview'

function formatTimeAgo(timestampSeconds: number): string {
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - timestampSeconds))
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${Math.max(1, diffMin)} mins ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} hours ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} days ago`
}

interface LatestEpisodeCardProps {
  item: LatestEpisodeItem
  onShowPreview: (card: CardItem, rect: DOMRect) => void
  onKeepPreviewOpen?: () => void
  onClosePreview?: () => void
}

function LatestEpisodeCard({ item, onShowPreview, onKeepPreviewOpen, onClosePreview }: LatestEpisodeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<any>(null)
  const title = pickTitle(item.media.title as any)
  const jpTitle = item.media.title?.native || null
  const tmdbBundle = useTmdb(item.media.id, title, item.media.format)
  const tmdbBackdrop = tmdbImg(tmdbBundle?.tmdb?.backdrop, 'w1280')

  // Official TMDB backdrop with fallback to AniList banner / cover
  const image = tmdbBackdrop || item.media.bannerImage || item.media.coverImage?.extraLarge || item.media.coverImage?.large
  const timeAgo = formatTimeAgo(item.airingAt)

  const cardItem: CardItem = {
    id: item.media.id,
    href: `/watch/${item.media.id}?ep=${item.episode}`,
    title,
    jpTitle,
    image: item.media.coverImage?.extraLarge || item.media.coverImage?.large || '',
    score: item.media.averageScore ?? null,
    format: item.media.format,
    bannerImage: tmdbBackdrop || item.media.bannerImage,
    season: item.media.season,
    year: item.media.seasonYear,
    genres: item.media.genres || undefined,
    caption: `Episode ${item.episode}`,
  }

  const triggerPreview = () => {
    if (cardRef.current) {
      onShowPreview(cardItem, cardRef.current.getBoundingClientRect())
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    triggerPreview()
  }

  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    onKeepPreviewOpen?.()
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      triggerPreview()
    }, 600)
  }

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(hoverTimer.current)
    onClosePreview?.()
  }

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className="group relative w-[230px] sm:w-[260px] md:w-[280px] shrink-0 snap-start select-none cursor-pointer outline-none"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          triggerPreview()
        }
      }}
      aria-label={`${title} Episode ${item.episode}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#121319] shadow-lg shadow-black/25 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-white/35 group-focus-visible:border-white/60 group-hover:shadow-2xl">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="size-full bg-[#181922] grid place-items-center text-white/20">
            <Play className="size-8" />
          </div>
        )}

        {/* Angled cinematic vignette gradient mask (going dark at corners) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.3)_100%)] pointer-events-none" />

        {/* Floating pure text for Episode with soft drop shadow (no background box) */}
        <div className="absolute bottom-2.5 left-3 pointer-events-none">
          <span className="text-[11.5px] sm:text-[12px] font-semibold tracking-wide text-neutral-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            Episode {item.episode}
          </span>
        </div>
      </div>

      {/* Metadata Below Card */}
      <div className="mt-2.5 space-y-0.5">
        <h3 className="line-clamp-1 text-[13px] font-semibold text-foreground transition-colors group-hover:text-foreground/75">
          {title}
        </h3>
        {jpTitle && (
          <p className="line-clamp-1 text-[10.5px] font-normal text-muted">
            {jpTitle}
          </p>
        )}
        <p className="text-[11px] text-muted font-medium">
          {timeAgo}
        </p>
      </div>
    </div>
  )
}

interface LatestEpisodesRowProps {
  items: LatestEpisodeItem[]
  loading?: boolean
}

export function LatestEpisodesRow({ items, loading }: LatestEpisodesRowProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<any>(null)
  const [previewState, setPreviewState] = useState<{
    item: CardItem
    anchorRect: DOMRect
  } | null>(null)

  const handleShowPreview = useCallback((item: CardItem, anchorRect: DOMRect) => {
    clearTimeout(closeTimer.current)
    setPreviewState({ item, anchorRect })
  }, [])

  const handleKeepOpen = useCallback(() => {
    clearTimeout(closeTimer.current)
  }, [])

  const handleClose = useCallback(() => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setPreviewState(null)
    }, 180)
  }, [])

  const handleImmediateClose = useCallback(() => {
    clearTimeout(closeTimer.current)
    setPreviewState(null)
  }, [])

  const scroll = (dir: 1 | -1) => {
    if (scroller.current) {
      scroller.current.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' })
    }
  }

  if (!loading && (!items || items.length === 0)) return null

  return (
    <section className="cv-auto mx-auto w-full max-w-7xl">
      <div className="mb-4 flex items-end justify-between gap-4 px-4 sm:px-6">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Latest Episodes</h2>
          <p className="mt-0.5 text-xs text-muted font-medium">Recently released episodes</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scroll(-1)}
            className="grid size-9 place-items-center rounded-full border border-border bg-card/60 text-muted hover:text-foreground hover:bg-card-2 transition active:scale-90 shadow-sm"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scroll(1)}
            className="grid size-9 place-items-center rounded-full border border-border bg-card/60 text-muted hover:text-foreground hover:bg-card-2 transition active:scale-90 shadow-sm"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="[mask-image:linear-gradient(to_right,transparent,#000_16px,#000_calc(100%_-_40px),transparent)] no-scrollbar flex snap-x snap-proximity scroll-pl-4 scroll-pr-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-4 pt-1 sm:scroll-pl-6 sm:scroll-pr-6 sm:gap-4.5 sm:px-6"
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-[230px] sm:w-[260px] md:w-[280px] shrink-0 animate-pulse space-y-2.5"
              >
                <div className="aspect-[16/9] w-full rounded-2xl bg-white/[0.05]" />
                <div className="h-4 w-3/4 rounded bg-white/[0.05]" />
                <div className="h-3 w-1/3 rounded bg-white/[0.05]" />
              </div>
            ))
          : items.map((item) => (
              <LatestEpisodeCard
                key={item.id}
                item={item}
                onShowPreview={handleShowPreview}
                onKeepPreviewOpen={handleKeepOpen}
                onClosePreview={handleClose}
              />
            ))}
      </div>

      {/* Floating Preview Popover on Click/Hover */}
      {previewState && (
        <AnimeHoverPreview
          item={previewState.item}
          anchorRect={previewState.anchorRect}
          onClose={handleImmediateClose}
          onKeepOpen={handleKeepOpen}
        />
      )}
    </section>
  )
}