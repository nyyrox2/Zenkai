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

/**
 * Watch-party invite link. Host name and title ride along so the preview card
 * ("<name> is inviting you to watch <title>") works for crawlers without any database lookup.
 */
export const partyShareUrl = (animeId: number, ep: number, room: string, host: string, title: string, pfp?: string | null) => {
  const params = new URLSearchParams({ ep: String(ep), room, host: host.slice(0, 40), t: title.slice(0, 120) })
  if (pfp && /^https?:\/\//i.test(pfp)) params.set('pfp', pfp)
  return `${window.location.origin}/watch/${animeId}?${params.toString()}`
}

/** Anime / movie / manga share: native sheet with clean URL and title. */
export async function shareMedia(o: { url: string; title: string; image?: string | null; poster?: string | null; label: string; subtitle?: string }) {
  const { shareCard } = await import('./shareCard')
  await shareCard(
    { kind: 'media', eyebrow: o.label, title: o.title, subtitle: o.subtitle, image: o.image, avatar: o.poster ?? o.image },
    o.url,
    `${o.title} — ${o.label} on Zenkai`,
  )
}
