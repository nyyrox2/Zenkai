import { useMemo } from 'react'
import { fetchTmdbEpisodes, type EpInfo, type Tmdb } from '../services/api'
import { anilistEpisodes, mergeEpisodes, tmdbSeason } from '../lib/episodes'
import type { AniStreamingEpisode } from '../types/anime'
import { useAsync } from './useAsync'

/** Per-episode info: TMDB when it has it, AniList streamingEpisodes otherwise. Never blocks on TMDB failing. */
export function useEpisodes(tmdb: Tmdb | null, streaming?: AniStreamingEpisode[]): Map<number, EpInfo> {
  const season = tmdbSeason(tmdb)
  const remote = useAsync(async () => (tmdb && season ? fetchTmdbEpisodes(tmdb.id, season) : []), [tmdb?.id, season])
  return useMemo(() => mergeEpisodes(remote.data ?? [], anilistEpisodes(streaming)), [remote.data, streaming])
}
