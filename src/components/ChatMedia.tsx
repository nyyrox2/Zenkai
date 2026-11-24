import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Maximize2, X } from 'lucide-react'

export type Media = { t: 'media'; kind: 'img' | 'video'; url: string; alt: string }
export type Seg = { t: 'text'; v: string } | Media | { t: 'link'; url: string }

const VIDEO = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
const IMAGE = /\.(gif|jpe?g|png|webp|avif|bmp)(\?|#|$)/i
const IMG_HOST = /^https?:\/\/(?:[\w-]+\.)?(?:giphy\.com\/media|tenor\.com\/|media\.tenor\.com|i\.giphy\.com)/i
// "[GIF|url|title]" tokens or any bare http(s) URL
const TOKEN = /\[GIF\|(https?:\/\/[^|\]\s]+)\|([^\]]*)\]|(https?:\/\/[^\s<>"']+)/gi

function classify(url: string, alt = ''): Seg {
  if (VIDEO.test(url)) return { t: 'media', kind: 'video', url, alt }
  if (IMAGE.test(url) || IMG_HOST.test(url)) return { t: 'media', kind: 'img', url, alt }
  return { t: 'link', url }
}

export function parseContent(text: string): Seg[] {
  const out: Seg[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0
    let url = m[1] || m[3]
    let tail = ''
    if (m[3]) {
      const trim = url.match(/[.,;:!?)\]]+$/)
      if (trim) { tail = trim[0]; url = url.slice(0, -tail.length) }
    }
    if (at > last) out.push({ t: 'text', v: text.slice(last, at) })
    out.push(m[1] ? (VIDEO.test(url) ? { t: 'media', kind: 'video', url, alt: m[2] } : { t: 'media', kind: 'img', url, alt: m[2] }) : classify(url))
    if (tail) out.push({ t: 'text', v: tail })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) })
  return out.filter((s) => s.t !== 'text' || s.v.trim() !== '')
}

/** One-line description for reply quotes. */
export function previewOf(text: string): string {
  const segs = parseContent(text)
  const words = segs.map((s) => (s.t === 'text' ? s.v : s.t === 'link' ? 'link' : s.kind === 'video' ? '🎬 Video' : /\.gif|giphy|tenor/i.test(s.url) ? 'GIF' : '📷 Photo')).join(' ')
  return words.replace(/\|\|/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
}

function Lightbox({ m, onClose }: { m: Media; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-3">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 grid size-10 place-items-center rounded-full bg-white/10 text-white active:scale-90" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <X className="size-5" />
      </button>
      {m.kind === 'video' ? (
        <video src={m.url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] max-w-[96vw] rounded-xl" />
      ) : (
        <img src={m.url} alt={m.alt} referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] max-w-[96vw] rounded-xl object-contain" />
      )}
    </div>,
    document.body,
  )
}

export function MediaBlock({ m, onLoad }: { m: Media; onLoad?: () => void }) {
  const [open, setOpen] = useState(false)
  const [bad, setBad] = useState(false)
  if (bad) {
    return (
      <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-xs underline opacity-80">
        <ExternalLink className="size-3 shrink-0" /> {m.alt || 'Open media'}
      </a>
    )
  }
  return (
    <>
      <div className="relative w-fit max-w-full overflow-hidden rounded-xl bg-black/20">
        {m.kind === 'video' ? (
          <>
            <video src={m.url} controls playsInline preload="metadata" onLoadedMetadata={onLoad} onError={() => setBad(true)} className="block max-h-64 max-w-full" />
            <button type="button" onClick={() => setOpen(true)} aria-label="Fullscreen" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/55 text-white active:scale-90">
              <Maximize2 className="size-3.5" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setOpen(true)} aria-label="View full size" className="block">
            <img src={m.url} alt={m.alt} loading="lazy" referrerPolicy="no-referrer" onLoad={onLoad} onError={() => setBad(true)} className="block max-h-64 min-w-24 max-w-full object-cover" />
          </button>
        )}
      </div>
      {open && <Lightbox m={m} onClose={() => setOpen(false)} />}
    </>
  )
}
