/** Helpers for animated profile images (GIF / APNG / animated WebP): detection, frame decoding, GIF re-encoding. */
import { GIFEncoder, quantize, applyPalette } from 'gifenc'

export type AnimFormat = 'gif' | 'apng' | 'webp' | null

/** Sniff the real format from the file bytes (extensions and MIME types lie, especially for APNG). */
export function sniffAnimated(b: Uint8Array): AnimFormat {
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n))
  if (ascii(0, 4) === 'GIF8') return 'gif'
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') {
    // APNG has an `acTL` chunk before the first `IDAT`.
    let o = 8
    while (o + 8 <= b.length) {
      const len = ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
      const type = ascii(o + 4, 4)
      if (type === 'acTL') return 'apng'
      if (type === 'IDAT') return null
      o += 12 + len
    }
    return null
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const head = ascii(12, Math.min(b.length - 12, 4096))
    return head.includes('ANIM') ? 'webp' : null
  }
  return null
}

export async function sniffBlob(blob: Blob): Promise<AnimFormat> {
  // acTL always sits near the start of the file; 64 KB is plenty.
  return sniffAnimated(new Uint8Array(await blob.slice(0, 65536).arrayBuffer()))
}

const MIME: Record<Exclude<AnimFormat, null>, string> = { gif: 'image/gif', apng: 'image/png', webp: 'image/webp' }

export const canDecodeAnimated = () => typeof (globalThis as any).ImageDecoder === 'function'

export interface Frame {
  frame: VideoFrame | ImageBitmap
  delay: number // ms
}

export async function decodeFrames(blob: Blob, fmt: Exclude<AnimFormat, null>, maxFrames = 400): Promise<Frame[]> {
  const ID = (globalThis as any).ImageDecoder
  const decoder = new ID({ data: await blob.arrayBuffer(), type: MIME[fmt] })
  await decoder.tracks.ready
  const count: number = Math.min(decoder.tracks.selectedTrack?.frameCount ?? 1, maxFrames)
  const out: Frame[] = []
  for (let i = 0; i < count; i++) {
    const { image } = await decoder.decode({ frameIndex: i, completeFramesOnly: true })
    out.push({ frame: image, delay: image.duration ? image.duration / 1000 : 100 })
  }
  decoder.close()
  return out
}

export const closeFrames = (f: Frame[]) => f.forEach((x) => x.frame.close())

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

/**
 * Re-encode animated frames into a cropped GIF. `draw` paints one frame onto the output context
 * (the cropper supplies its pan / zoom / rotate / flip transform). Tries smaller sizes and fewer frames
 * until the result fits `maxBytes`.
 */
export async function encodeGif(
  frames: Frame[],
  outW: number,
  outH: number,
  draw: (g: CanvasRenderingContext2D, f: Frame['frame'], scale: number) => void,
  opts: { maxBytes?: number; onProgress?: (p: number) => void } = {},
): Promise<Uint8Array> {
  const maxBytes = opts.maxBytes ?? 2_200_000
  // Attempts: full size, then progressively smaller with frame decimation.
  const attempts = [
    { s: 1, step: 1 },
    { s: 0.75, step: 1 },
    { s: 0.6, step: 2 },
    { s: 0.5, step: 3 },
    { s: 0.4, step: 4 },
  ]
  let last: Uint8Array = new Uint8Array(0)
  for (let ai = 0; ai < attempts.length; ai++) {
    const { s, step } = attempts[ai]
    const w = Math.max(32, Math.round(outW * s))
    const h = Math.max(32, Math.round(outH * s))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d', { willReadFrequently: true })!
    g.imageSmoothingQuality = 'high'
    const gif = GIFEncoder()
    // Merge the delays of skipped frames so playback speed stays the same.
    const picked: { f: Frame; delay: number }[] = []
    for (let i = 0; i < frames.length; i += step) {
      let d = 0
      for (let j = i; j < Math.min(i + step, frames.length); j++) d += frames[j].delay
      picked.push({ f: frames[i], delay: d })
    }
    for (let i = 0; i < picked.length; i++) {
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.fillStyle = '#000'
      g.fillRect(0, 0, w, h)
      draw(g, picked[i].f.frame, w / outW)
      const { data } = g.getImageData(0, 0, w, h)
      const palette = quantize(data, 256, { format: 'rgb444' })
      const index = applyPalette(data, palette, 'rgb444')
      gif.writeFrame(index, w, h, { palette, delay: Math.max(20, Math.round(picked[i].delay)), repeat: 0 })
      opts.onProgress?.((ai + (i + 1) / picked.length) / attempts.length)
      if (i % 4 === 3) await tick()
    }
    gif.finish()
    last = gif.bytes()
    if (last.byteLength <= maxBytes) return last
  }
  return last
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(new Blob([bytes as BlobPart], { type: mime }))
  })
}
