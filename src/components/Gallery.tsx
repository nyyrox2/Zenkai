import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { fetchMalPictures } from '../services/jikan'
import { tmdbGallery } from '../services/tmdbDirect'
import { useAsync } from '../hooks/useAsync'
import type { AniMediaDetails } from '../types/anime'

/** Banner, cover, episode thumbnails (AniList) + backdrops/posters (TMDB) + pictures (MyAnimeList), de-duplicated. */
export function Gallery({ anime, tmdb }: { anime: AniMediaDetails; tmdb: { id: number; type: string } | null }) {
  const [open, setOpen] = useState<string | null>(null)
  const imgs = useAsync(async () => {
    const [t, m] = await Promise.all([
      tmdb ? tmdbGallery(tmdb.type, tmdb.id).catch(() => []) : [],
      anime.idMal ? fetchMalPictures(anime.idMal).catch(() => []) : [],
    ])
    const all = [
      anime.bannerImage,
      anime.coverImage.extraLarge,
      ...anime.streamingEpisodes.map((e) => e.thumbnail),
      ...t,
      ...m.map((p) => p.jpg.large_image_url ?? p.jpg.image_url),
    ].filter((u): u is string => !!u)
    return [...new Set(all)]
  }, [anime.id, tmdb?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (imgs.loading) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-video animate-pulse rounded-xl bg-card-2" />)}</div>
  if (!imgs.data?.length) return <p className="text-sm text-muted">No images found.</p>

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {imgs.data.map((u) => (
          <button key={u} onClick={() => setOpen(u)} aria-label="View image" className="overflow-hidden rounded-xl bg-card-2 transition hover:ring-2 hover:ring-accent">
            <img src={u} alt="" loading="lazy" className="aspect-video w-full object-cover" onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')} />
          </button>
        ))}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Image preview" onClick={() => setOpen(null)} className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4">
          <button aria-label="Close" onClick={() => setOpen(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"><X className="size-5" /></button>
          <img src={open} alt="" className="max-h-[90svh] max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  )
}
