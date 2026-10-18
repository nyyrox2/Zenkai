import { useMemo } from 'react'
import { fetchTmdbEpisodes, type EpInfo, type Tmdb } from '../services/api'
import { anilistEpisodes, mergeEpisodes } from '../lib/episodes'
import type { AniStreamingEpisode } from '../types/anime'
import { useAsync } from './useAsync'

/** Per-episode info: TMDB when it has it, AniList streamingEpisodes otherwise. Never blocks on TMDB failing. */
export function useEpisodes(tmdb: Tmdb | null, streaming?: AniStreamingEpisode[]): Map<number, EpInfo> {
  const remote = useAsync(
    async () => (tmdb ? fetchTmdbEpisodes(tmdb) : []),
    [tmdb?.id, tmdb?.season, tmdb?.episodeGroupId, tmdb?.seasons],
  )
  return useMemo(() => mergeEpisodes(remote.data ?? [], anilistEpisodes(streaming)), [remote.data, streaming])
}
