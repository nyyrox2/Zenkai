/** MAL -> AniList id. AniBridge first (one call per id), ARM batch for whatever it could not map. */
const BRIDGE = 'https://anibridge.eliasbenb.dev/api/mappings?source.descriptor=mal:'
const ARM = 'https://arm.haglund.dev/api/v2/ids?include=anilist,myanimelist'

export const aniIdCache = new Map<number, number | null>()

const timed = async (url: string, init?: RequestInit) => {
  const ctl = new AbortController()
  const t = window.setTimeout(() => ctl.abort(), 10000)
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } finally {
    window.clearTimeout(t)
  }
}

const viaBridge = (mal: number) =>
  timed(BRIDGE + mal)
    .then((d) => Number(/anilist:(\d+)/.exec(JSON.stringify(d))?.[1]) || null)
    .catch(() => null)

export async function resolveAniList(mal: number[]): Promise<void> {
  const need = [...new Set(mal)].filter((m) => m && !aniIdCache.has(m))
  for (let i = 0; i < need.length; i += 8) {
    const chunk = need.slice(i, i + 8)
    const ids = await Promise.all(chunk.map(viaBridge))
    chunk.forEach((m, j) => ids[j] && aniIdCache.set(m, ids[j]))
  }
  const left = need.filter((m) => !aniIdCache.get(m))
  if (!left.length) return
  try {
    const out = (await timed(ARM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(left.map((m) => ({ myanimelist: m }))),
    })) as ({ anilist?: number | null } | null)[]
    left.forEach((m, i) => aniIdCache.set(m, out[i]?.anilist ?? null))
  } catch {
    /* unmapped ids are dropped by callers */
  }
}
