import { useEffect, useState } from 'react'
import { fetchTmdb, type TmdbBundle } from '../services/api'

/** TMDB artwork / details + AniBridge mapping for an AniList id. null until loaded (or when unavailable). */
export function useTmdb(id?: number | null, title?: string, format?: string | null, romaji?: string | null): TmdbBundle | null {
  const [bundle, setBundle] = useState<TmdbBundle | null>(null)
  useEffect(() => {
    setBundle(null)
    if (!id || !title) return
    let off = false
    fetchTmdb(id, title, format, romaji).then((b) => !off && setBundle(b))
    return () => {
      off = true
    }
  }, [id, title, format, romaji])
  return bundle
}
