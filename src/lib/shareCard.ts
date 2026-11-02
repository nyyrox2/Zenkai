import { toast } from './toast'

/**
 * One share-card renderer for everything people post to Instagram / WhatsApp / Discord:
 * watch-party invites, profiles, anime, movies and manga all use the same design.
 * It draws on a canvas (no dependencies), so it works offline from the edge and needs no server.
 */
export type ShareCardKind = 'party' | 'profile' | 'media'

export interface ShareCardOpts {
  kind: ShareCardKind
  /** small line above the headline, e.g. "Mahfooz is inviting you" */
  eyebrow: string
  /** big headline: anime / movie title, or the person's name */
  title: string
  /** line under the headline, e.g. "Episode 6 · Watch together" or "@username" */
  subtitle?: string
  /** background art (banner / backdrop / cover). Without it a generated gradient is used. */
  image?: string | null
  /** foreground picture: poster (media) or avatar (profile / party host) */
  avatar?: string | null
  /** letter shown when there is no picture (the person's initial for profile / party cards) */
  initial?: string
  /** watch-party code shown in a big box */
  code?: string
  /** bottom line, defaults to the site host */
  footer?: string
}

export const CARD_W = 1080
export const CARD_H = 1350

const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif'

/** Stable hue from a string, so every title gets its own generated background. */
function hueOf(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}

/** Load an image for canvas use. Tries a direct CORS fetch first, then our own /proxy (which adds CORS headers). */
async function loadImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null
  const attempt = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.referrerPolicy = 'no-referrer'
      const timer = window.setTimeout(() => resolve(null), 8000)
      img.onload = () => {
        window.clearTimeout(timer)
        resolve(img)
      }
      img.onerror = () => {
        window.clearTimeout(timer)
        resolve(null)
      }
      img.src = src
    })
  const direct = await attempt(url)
  if (direct) return direct
  if (/^https?:\/\//i.test(url)) return attempt(`/proxy?url=${encodeURIComponent(url)}`)
  return null
}

function coverFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height)
  const dw = img.width * s
  const dh = img.height * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Wrap text into at most `maxLines` lines, ellipsising the last one. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (ctx.measureText(test).width <= maxW || !cur) cur = test
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1)
    kept[maxLines - 1] = last.trimEnd() + '…'
    return kept
  }
  return lines
}

export async function renderShareCard(o: ShareCardOpts): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  const [bg, fg] = await Promise.all([loadImage(o.image), loadImage(o.avatar)])
  const hue = hueOf(o.title + o.eyebrow)
  const hue2 = (hue + 48) % 360

  // ---- background: art (blurred + darkened) or generated aurora ----
  ctx.fillStyle = `hsl(${hue} 45% 8%)`
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  if (bg) {
    ctx.save()
    ctx.filter = 'blur(28px) saturate(1.25)'
    coverFit(ctx, bg, -60, -60, CARD_W + 120, CARD_H + 120)
    ctx.restore()
  } else {
    const g1 = ctx.createRadialGradient(CARD_W * 0.15, CARD_H * 0.1, 0, CARD_W * 0.15, CARD_H * 0.1, CARD_W * 0.95)
    g1.addColorStop(0, `hsla(${hue} 85% 55% / 0.85)`)
    g1.addColorStop(1, `hsla(${hue} 85% 55% / 0)`)
    ctx.fillStyle = g1
    ctx.fillRect(0, 0, CARD_W, CARD_H)
    const g2 = ctx.createRadialGradient(CARD_W * 0.95, CARD_H * 0.7, 0, CARD_W * 0.95, CARD_H * 0.7, CARD_W * 1.05)
    g2.addColorStop(0, `hsla(${hue2} 90% 52% / 0.7)`)
    g2.addColorStop(1, `hsla(${hue2} 90% 52% / 0)`)
    ctx.fillStyle = g2
    ctx.fillRect(0, 0, CARD_W, CARD_H)
  }
  // scrim so text always reads
  const scrim = ctx.createLinearGradient(0, 0, 0, CARD_H)
  scrim.addColorStop(0, 'rgba(6,6,12,0.55)')
  scrim.addColorStop(0.45, 'rgba(6,6,12,0.35)')
  scrim.addColorStop(1, 'rgba(6,6,12,0.92)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  // faint dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let y = 40; y < CARD_H; y += 44) for (let x = 40; x < CARD_W; x += 44) ctx.fillRect(x, y, 2, 2)

  // ---- brand ----
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fff'
  ctx.font = `800 40px ${FONT}`
  ctx.letterSpacing = '10px'
  ctx.fillText('ZENKAI', 72, 112)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(72, 136, 72, 4)

  // ---- hero picture ----
  const isRound = o.kind !== 'media'
  const heroW = isRound ? 360 : 380
  const heroH = isRound ? 360 : 540
  const heroX = (CARD_W - heroW) / 2
  const heroY = 210
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 24
  ctx.fillStyle = `hsl(${hue} 50% 22%)`
  if (isRound) {
    ctx.beginPath()
    ctx.arc(CARD_W / 2, heroY + heroH / 2, heroW / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    roundRect(ctx, heroX, heroY, heroW, heroH, 36)
    ctx.fill()
  }
  ctx.restore()
  ctx.save()
  if (isRound) {
    ctx.beginPath()
    ctx.arc(CARD_W / 2, heroY + heroH / 2, heroW / 2, 0, Math.PI * 2)
  } else roundRect(ctx, heroX, heroY, heroW, heroH, 36)
  ctx.clip()
  const heroImg = fg ?? (o.kind === 'media' ? bg : null)
  if (heroImg) coverFit(ctx, heroImg, heroX, heroY, heroW, heroH)
  else {
    const g = ctx.createLinearGradient(heroX, heroY, heroX + heroW, heroY + heroH)
    g.addColorStop(0, `hsl(${hue} 80% 55%)`)
    g.addColorStop(1, `hsl(${hue2} 80% 40%)`)
    ctx.fillStyle = g
    ctx.fillRect(heroX, heroY, heroW, heroH)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = `800 ${isRound ? 170 : 150}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(((o.initial ?? o.title).trim()[0] || 'Z').toUpperCase(), CARD_W / 2, heroY + heroH / 2 + (isRound ? 58 : 52))
    ctx.textAlign = 'left'
  }
  ctx.restore()
  // ring
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  if (isRound) {
    ctx.beginPath()
    ctx.arc(CARD_W / 2, heroY + heroH / 2, heroW / 2 + 4, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    roundRect(ctx, heroX, heroY, heroW, heroH, 36)
    ctx.stroke()
  }

  // ---- text block ----
  ctx.textAlign = 'center'
  let y = heroY + heroH + 92
  ctx.fillStyle = `hsl(${hue} 95% 78%)`
  ctx.font = `700 34px ${FONT}`
  ctx.letterSpacing = '4px'
  ctx.fillText(o.eyebrow.toUpperCase(), CARD_W / 2, y)
  ctx.letterSpacing = '0px'

  y += 24
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${o.title.length > 28 ? 62 : 76}px ${FONT}`
  const lines = wrap(ctx, o.title, CARD_W - 150, 2)
  const lh = o.title.length > 28 ? 74 : 90
  for (const l of lines) {
    y += lh
    ctx.fillText(l, CARD_W / 2, y)
  }

  if (o.subtitle) {
    y += 62
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.font = `600 36px ${FONT}`
    ctx.fillText(o.subtitle, CARD_W / 2, y)
  }

  // ---- party code ----
  if (o.code) {
    const code = o.code.toUpperCase()
    ctx.font = `800 64px ${FONT}`
    ctx.letterSpacing = '10px'
    const cw = Math.min(CARD_W - 140, ctx.measureText(code).width + 96)
    const cx = (CARD_W - cw) / 2
    const cy = Math.max(y + 46, CARD_H - 250)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, cx, cy, cw, 104, 30)
    ctx.fill()
    ctx.setLineDash([14, 10])
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#fff'
    ctx.fillText(code, CARD_W / 2 + 5, cy + 71)
    ctx.letterSpacing = '0px'
    ctx.font = `600 26px ${FONT}`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText('PARTY CODE', CARD_W / 2, cy - 14)
  }

  // ---- call to action (cards without a party code) ----
  if (!o.code) {
    const label = o.kind === 'profile' ? 'View profile' : 'Watch now'
    ctx.font = `800 40px ${FONT}`
    const bw = ctx.measureText(label).width + 150
    const bx = (CARD_W - bw) / 2
    const by = Math.max(y + 70, CARD_H - 250)
    ctx.fillStyle = '#fff'
    roundRect(ctx, bx, by, bw, 100, 50)
    ctx.fill()
    ctx.fillStyle = '#0b0b12'
    ctx.beginPath()
    ctx.moveTo(bx + 46, by + 32)
    ctx.lineTo(bx + 46, by + 68)
    ctx.lineTo(bx + 76, by + 50)
    ctx.closePath()
    ctx.fill()
    ctx.fillText(label, bx + 90 + (bw - 150) / 2, by + 66)
  }

  // ---- footer ----
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `600 30px ${FONT}`
  ctx.fillText(o.footer ?? (window.location.host || 'zenkai.cfd'), CARD_W / 2, CARD_H - 62)
  ctx.textAlign = 'left'

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png')
    } catch (e) {
      // a cross-origin picture tainted the canvas: redraw without pictures
      reject(e)
    }
  })
}

/** Renders the card; if a remote picture blocks export, retries with generated art only. */
export async function safeRenderShareCard(o: ShareCardOpts): Promise<Blob> {
  try {
    return await renderShareCard(o)
  } catch {
    return renderShareCard({ ...o, image: null, avatar: null })
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'zenkai'

/**
 * Share a card image plus the link through the native share sheet (Instagram, WhatsApp, Messages ...).
 * Without file sharing support (desktop) the image is downloaded and the link is copied.
 */
export async function shareCard(o: ShareCardOpts, url: string, text: string) {
  let blob: Blob
  try {
    blob = await safeRenderShareCard(o)
  } catch {
    toast('Could not create the share image', 'error')
    return
  }
  const file = new File([blob], `zenkai-${slug(o.title)}.png`, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: o.title, text: `${text}\n${url}`, url })
      return
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return // sheet dismissed
  }
  downloadBlob(blob, file.name)
  try {
    await navigator.clipboard.writeText(url)
    toast('Image saved & link copied')
  } catch {
    toast('Image saved')
  }
}

/** Save only the image. */
export async function saveShareCard(o: ShareCardOpts) {
  try {
    const blob = await safeRenderShareCard(o)
    downloadBlob(blob, `zenkai-${slug(o.title)}.png`)
    toast('Image saved')
  } catch {
    toast('Could not create the share image', 'error')
  }
}
