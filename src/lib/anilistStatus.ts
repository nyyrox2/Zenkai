import { useSyncExternalStore } from 'react'

/** Tiny global flag: true while AniList is failing and pages are running on the MAL / TMDB fallback. */
let down = false
const subs = new Set<() => void>()
const set = (v: boolean) => {
  if (down === v) return
  down = v
  subs.forEach((f) => f())
}
export const markAniListDown = () => set(true)
export const markAniListUp = () => set(false)
export const useAniListDown = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => down,
  )

/** Thrown for network failures, 429 and 5xx: the cases where the fallback should kick in. */
export class AniListDownError extends Error {}
