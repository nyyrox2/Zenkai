import { useEffect, useState, type ReactNode } from 'react'
import { liftScreen, prefetchSections, startBoot } from '../lib/boot'

/**
 * Keeps the app unmounted until the opening screen says everything is ready (fonts, this page's code, artwork, a calm
 * main thread). It then mounts the app underneath the screen and lifts it two frames later, so every entrance
 * animation plays as the screen slides away instead of finishing out of sight.
 */
export function BootGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let dead = false
    startBoot().then(() => !dead && setReady(true))
    return () => {
      dead = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    let dead = false
    // two frames: the app's first paint lands under the screen before it starts moving
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (dead) return
        liftScreen().then(prefetchSections)
      }),
    )
    return () => {
      dead = true
    }
  }, [ready])

  return ready ? <>{children}</> : null
}
