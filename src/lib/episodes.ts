import type { AniStreamingEpisode } from '../types/anime'
import type { EpInfo, Tmdb } from '../services/api'

// ponytail: episodes that leaked before AniList's airing schedule caught up, keyed by AniList id as [episode, expiry]. After the expiry AniList alone decides, no cleanup needed
const EARLY: Record<number, [number, number]> = { 195604: [9, new Date(2026, 10, 30).getTime()] } // Black Clover Season 2, until end of Nov 29

/** Episodes that have actually aired, and the (known or best-guess) total. */
export function episodeCounts(a: {
  id?: number
  format: string | null
  status: string | null
  episodes: number | null
  nextAiringEpisode: { episode: number } | null
}) {
  if (a.format === 'MOVIE') return { total: 1, available: a.status === 'NOT_YET_RELEASED' ? 0 : 1 }
  const next = a.nextAiringEpisode?.episode
  const aired = next ? next - 1 : (a.episodes ?? 0)
  const e = a.id ? EARLY[a.id] : undefined
  const early = e && Date.now() < e[1] ? e[0] : 0
  const available = Math.max(early, a.episodes ? Math.min(a.episodes, aired || a.episodes) : aired)
  return {
    total: Math.max(a.episodes ?? 0, available, 1),
    available: a.status === 'NOT_YET_RELEASED' ? 0 : Math.max(available, 1),
  }
}


/** AniList streamingEpisodes ("Episode 12 - Title" + thumbnail) as EpInfo. */
export function anilistEpisodes(list: AniStreamingEpisode[] = []): EpInfo[] {
  const out: EpInfo[] = []
  for (const e of list) {
    const m = e.title?.match(/^\s*(?:episode|ep\.?)\s*(\d+)\s*[-:–.]?\s*(.*)$/i)
    if (!m) continue
    out.push({ n: Number(m[1]), name: m[2].trim() || null, overview: null, image: e.thumbnail, runtime: null, air: null })
  }
  return out
}

/** TMDB wins per field; AniList fills whatever TMDB is missing (or everything, if TMDB has nothing). */
export function mergeEpisodes(tmdb: EpInfo[], ani: EpInfo[]): Map<number, EpInfo> {
  const map = new Map<number, EpInfo>()
  for (const e of ani) map.set(e.n, e)
  for (const t of tmdb) {
    const a = map.get(t.n)
    map.set(t.n, { n: t.n, name: t.name ?? a?.name ?? null, overview: t.overview ?? a?.overview ?? null, image: t.image ?? a?.image ?? null, runtime: t.runtime ?? a?.runtime ?? null, air: t.air ?? a?.air ?? null })
  }
  return map
}

/** TMDB season to read: the mapped season, else 1 (ponytail: no absolute-order guessing for split cours). */
export const tmdbSeason = (t: Tmdb | null) => (t && t.type === 'tv' ? (t.season ?? 1) : null)
