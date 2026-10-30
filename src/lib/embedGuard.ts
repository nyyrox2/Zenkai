/** Embed guard: the player refuses to run inside a sandboxed iframe (the host would strip popups, storage and navigation). */

/** Sandbox without allow-same-origin gives the frame an opaque origin. */
export const opaqueOrigin = () => window.origin === 'null'

/** Call inside a user gesture: a sandbox without allow-popups makes window.open return null. */
export function popupsBlocked(): boolean {
  const w = window.open('about:blank', '_blank', 'popup=1,width=1,height=1')
  if (!w) return true
  w.close()
  return false
}

/** ?preview=1 is only honoured for the same-origin docs page, so nobody can use it to skip the guard. */
export function sameOriginParent(): boolean {
  try {
    return window.parent !== window && window.parent.location.origin === location.origin
  } catch {
    return false
  }
}
