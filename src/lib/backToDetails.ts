import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isPlayerPath } from './sections'

const KEY = 'zk:d:'

/** Details pages remember their history slot, so a player's "Details" link can step back to it instead of pushing a duplicate. */
export function useMarkDetails() {
  const { pathname } = useLocation()
  useEffect(() => {
    sessionStorage.setItem(KEY + pathname, String(window.history.state?.idx ?? 0))
  }, [pathname])
}

export function useBackToDetails() {
  const navigate = useNavigate()
  return (to: string) => (e: React.MouseEvent) => {
    const saved = sessionStorage.getItem(KEY + to.split('?')[0])
    const idx = window.history.state?.idx
    if (saved === null || !(idx > Number(saved))) return // not reached via that page: plain link
    e.preventDefault()
    navigate(Number(saved) - idx)
  }
}

const TRAIL = 'zk:trail'

function readTrail(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL) || '{}')
  } catch {
    return {}
  }
}

/** Call once in App: remembers which path sits in each history slot (slots are overwritten on push, so it stays accurate). */
export function useTrackHistory() {
  const { pathname, key } = useLocation()
  useEffect(() => {
    const idx = window.history.state?.idx
    if (typeof idx !== 'number') return
    const trail = readTrail()
    for (const k of Object.keys(trail)) if (Number(k) > idx) delete trail[k] // forward entries are gone
    trail[idx] = pathname
    try {
      sessionStorage.setItem(TRAIL, JSON.stringify(trail))
    } catch {
      /* storage full / blocked: back falls back to the default */
    }
  }, [pathname, key]) // key: episode switches push same-path entries; every slot must be recorded
}

/** How many history steps back the nearest non-player page is, or null when there is none (use the fallback). */
export function smartBackDelta(pathname: string): number | null {
  const idx = window.history.state?.idx
  if (typeof idx !== 'number' || idx <= 0) return null
  const trail = readTrail()
  for (let i = idx - 1; i >= 0; i--) {
    const p = trail[i]
    if (p === undefined || isPlayerPath(p) || p === pathname) continue // unrecorded slot: never a safe landing
    return i - idx
  }
  return null
}

/**
 * Back button for details pages. Steps back to the nearest earlier page that is not a player/reader
 * (or this same page), so Details -> Player -> Details -> Back lands on where you came from, not the player.
 */
export function useSmartBack(fallback: string) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return () => {
    const d = smartBackDelta(pathname)
    if (d !== null) navigate(d)
    else navigate(fallback, { replace: true })
  }
}
