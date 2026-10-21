import { ShieldAlert } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAniListDown } from '../lib/anilistStatus'

export function AniListDownBanner() {
  const down = useAniListDown()
  const { pathname } = useLocation()
  if (!down || /^\/(movies|manga|novel)/.test(pathname)) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-xs font-medium text-muted shadow-lg backdrop-blur-xl">
        <ShieldAlert className="size-4 shrink-0 text-amber-400" /> AniList is down — using Kitsu / MAL / TMDB fallback
      </div>
    </div>
  )
}
