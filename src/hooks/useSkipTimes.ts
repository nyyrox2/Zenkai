import { useEffect, useState } from 'react'

type Seg = { start: number; end: number } | null
const cache = new Map<string, { intro: Seg; outro: Seg }>()

/** AniSkip community timestamps; fallback for when the stream provider sends no intro/outro. Never throws. */
export function useSkipTimes(malId: number | null | undefined, ep: number, on = true) {
  const key = `${malId}:${ep}`
  const [r, setR] = useState<{ intro: Seg; outro: Seg }>(() => cache.get(key) ?? { intro: null, outro: null })
  useEffect(() => {
    if (!on || !malId || !ep) return setR({ intro: null, outro: null })
    const hit = cache.get(key)
    if (hit) return setR(hit)
    setR({ intro: null, outro: null })
    const ac = new AbortController()
    fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${ep}?types=op&types=ed&types=mixed-op&types=mixed-ed&episodeLength=0`, { signal: ac.signal })
      .then((x) => (x.ok ? x.json() : null))
      .then((j: { results?: { skipType: string; interval: { startTime: number; endTime: number } }[] } | null) => {
        const f = (t: string[]) => {
          const s = j?.results?.find((x) => t.includes(x.skipType))
          return s ? { start: s.interval.startTime, end: s.interval.endTime } : null
        }
        const v = { intro: f(['op', 'mixed-op']), outro: f(['ed', 'mixed-ed']) }
        cache.set(key, v)
        setR(v)
      })
      .catch(() => {})
    return () => ac.abort()
  }, [key, malId, ep, on])
  return r
}
