/**
 * Guest-side drift check. Feed it a signature of what differs from the host ('' = in sync).
 * Returns true when the same difference was seen on two heartbeats in a row (one is enough right after joining),
 * so a heartbeat that raced a change the host just made never flips a guest back and forth.
 */
export function makeDriftCheck() {
  const born = Date.now()
  let last = ''
  let n = 0
  return (sig: string): boolean => {
    if (!sig) {
      last = ''
      n = 0
      return false
    }
    n = sig === last ? n + 1 : 1
    last = sig
    if (n >= (Date.now() - born < 15000 ? 1 : 2)) {
      n = 0
      return true
    }
    return false
  }
}

const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
/** two audio renditions are the same when the language or the label matches (same rule the player uses to pick one) */
export const sameTrack = (a?: { label?: string; lang?: string } | null, b?: { label?: string; lang?: string } | null) =>
  !a || !b || (!!norm(a.lang) && norm(a.lang) === norm(b.lang)) || (!!norm(a.label) && norm(a.label) === norm(b.label))
