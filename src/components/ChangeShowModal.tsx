import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Film, X, Loader2, Sparkles } from 'lucide-react'
import { searchAnime } from '../services/anilist'
import { pickTitle } from '../lib/utils'
import type { AniMedia } from '../types/anime'

export function ChangeShowModal({
  open,
  onClose,
  onSelectShow,
  currentAnimeId,
}: {
  open: boolean
  onClose: () => void
  onSelectShow: (animeId: number, animeTitle: string) => void
  currentAnimeId?: number
}) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<AniMedia[]>([])
  const [searched, setSearched] = useState(false)

  // Live search with debounce
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const list = await searchAnime(q)
        setResults(list || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
        setSearched(true)
      }
    }, 380)

    return () => clearTimeout(timer)
  }, [query, open])

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSearched(false)
    }
  }, [open])

  if (!open) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          className="relative flex h-[85vh] max-h-[600px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-2xl shadow-black/60"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/70 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-accent/20 text-accent">
                <Film className="size-4" />
              </div>
              <div>
                <h2 className="font-display text-sm sm:text-base font-bold text-foreground">
                  Switch Watch Party Anime
                </h2>
                <p className="text-[11px] text-muted">
                  Search & pick an anime to transition all party members
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-card-2 hover:text-foreground active:scale-90"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="pt-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anime (e.g. Jujutsu Kaisen, One Piece, Frieren)…"
                className="h-11 w-full rounded-2xl border border-border bg-card-2 pl-10 pr-9 text-xs text-foreground outline-none transition focus-visible:border-accent"
              />
              {loading ? (
                <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-accent" />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear input"
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid size-5 place-items-center rounded-full text-muted hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-y-auto space-y-2 p-1 min-h-0 overscroll-contain">
            {loading && results.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center text-xs text-muted">
                <Loader2 className="size-6 animate-spin text-accent mb-2" />
                <span>Searching anime catalog…</span>
              </div>
            ) : query && searched && results.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center p-6 text-muted">
                <p className="text-xs font-semibold text-foreground">No anime found</p>
                <p className="text-[11px] mt-1">Try another keyword or romanized title</p>
              </div>
            ) : results.length > 0 ? (
              results.map((anime) => {
                const title = pickTitle(anime.title)
                const isCurrent = anime.id === currentAnimeId
                return (
                  <button
                    key={anime.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => {
                      onSelectShow(anime.id, title)
                      onClose()
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition active:scale-[0.98] ${
                      isCurrent
                        ? 'border-accent/40 bg-accent/10 opacity-70 cursor-default'
                        : 'border-border/60 bg-card-2/60 hover:border-accent hover:bg-card-2'
                    }`}
                  >
                    <img
                      src={anime.coverImage?.extraLarge || anime.coverImage?.large || ''}
                      alt={title}
                      className="aspect-[2/3] w-12 shrink-0 rounded-xl object-cover bg-card"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-foreground">
                          {title}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[9px] font-bold text-accent shrink-0">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                        {anime.format && (
                          <span className="font-semibold uppercase text-accent">
                            {anime.format}
                          </span>
                        )}
                        {anime.episodes && (
                          <span>{anime.episodes} {anime.episodes === 1 ? 'ep' : 'eps'}</span>
                        )}
                        {anime.seasonYear && <span>{anime.seasonYear}</span>}
                      </div>
                    </div>

                    {!isCurrent && (
                      <span className="shrink-0 rounded-xl bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent transition group-hover:bg-accent group-hover:text-accent-fg">
                        Switch
                      </span>
                    )}
                  </button>
                )
              })
            ) : (
              <div className="flex h-48 flex-col items-center justify-center text-center p-6 text-muted">
                <Sparkles className="size-6 text-accent mb-2" />
                <p className="text-xs font-semibold text-foreground">Search Anime to Switch</p>
                <p className="text-[11px] mt-1 max-w-xs leading-relaxed">
                  Type an anime title above to change the show for everyone in the watch party.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
