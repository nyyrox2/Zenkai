import { toast } from './toast'

/** Native share sheet where there is one, otherwise copy the link. Cancelling the sheet is not an error. */
export async function shareLink(url: string, title: string) {
  try {
    if (navigator.share) await navigator.share({ title, url })
    else {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    }
  } catch {
    /* share sheet dismissed */
  }
}

/** Movie / TV link. The title rides along so the preview card still has a name if TMDB is down for the crawler. */
export const movieShareUrl = (type: 'movie' | 'tv', id: number, title: string) =>
  `${window.location.origin}/movies/${type}/${id}?${new URLSearchParams({ t: title })}`

/** Manga link. Manga ids belong to the reading server, so the title/cover/server travel in the URL for the preview card. */
export const mangaShareUrl = (id: string, title: string, cover: string, source: Record<string, string>) =>
  `${window.location.origin}/manga/${encodeURIComponent(id)}?${new URLSearchParams({ title, cover: /^https:\/\//.test(cover) ? cover : '', ...source })}`
