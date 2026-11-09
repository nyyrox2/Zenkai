import { useSyncExternalStore } from 'react'

/**
 * Zenkai Cast: Google Cast (Chromecast / Google TV / Android TV / Nest Hub) sender for CinePlayer.
 *
 * - Loads Google's Cast sender SDK lazily (only Chromium browsers get a working one; elsewhere status -> 'unsupported').
 * - The TV fetches the stream itself, so the url handed to it must be absolute and playable without our cookies / referer.
 * - One tiny store (useCast) mirrors the receiver's state so the player UI can drive and display the remote session.
 * - AirPlay (Safari) is separate: it uses the <video> element's own picker, see airplaySupported / airplayPicker.
 */

export type CastStatus = 'loading' | 'unsupported' | 'ready' | 'connecting' | 'connected'

export interface CastState {
  status: CastStatus
  /** friendly name of the receiver, e.g. "Living Room TV" */
  device: string
  playing: boolean
  buffering: boolean
  /** a media item is loaded on the receiver */
  loaded: boolean
  time: number
  duration: number
  volume: number
  muted: boolean
  error: string | null
}

const SDK = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'

let state: CastState = {
  status: 'loading',
  device: '',
  playing: false,
  buffering: false,
  loaded: false,
  time: 0,
  duration: 0,
  volume: 1,
  muted: false,
  error: null,
}
const subs = new Set<() => void>()
const set = (p: Partial<CastState>) => {
  state = { ...state, ...p }
  subs.forEach((f) => f())
}
export const getCast = () => state
export const useCast = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => state,
  )

/* eslint-disable @typescript-eslint/no-explicit-any */
let ctx: any = null
let player: any = null
let ctl: any = null
let started: Promise<boolean> | null = null
let wasIdleFinished = false
const finishedSubs = new Set<() => void>()

/** Fires when the receiver reports the current item played to the end. Returns an unsubscribe function. */
export const onCastFinished = (fn: () => void) => {
  finishedSubs.add(fn)
  return () => void finishedSubs.delete(fn)
}

const errText = (code: unknown) => {
  const c = String(code ?? '')
  if (/cancel/i.test(c)) return null // user closed the device picker
  if (/receiver_unavailable/i.test(c)) return 'No cast devices found. Make sure your phone and the TV are on the same Wi-Fi.'
  if (/timeout/i.test(c)) return 'The device did not answer in time. Try again.'
  if (/session_error|channel_error/i.test(c)) return 'Lost connection to the device.'
  if (/load_media_failed|invalid_request/i.test(c)) return 'The TV could not play this stream. Try another server.'
  return c ? `Cast error: ${c}` : null
}

function sync() {
  if (!player || !ctx) return
  const cast = (window as any).cast
  const session = ctx.getCurrentSession?.()
  const ps = String(player.playerState || '')
  const idle = ps === 'IDLE'
  const finished = idle && String(session?.getMediaSession?.()?.idleReason || '') === 'FINISHED'
  if (finished && !wasIdleFinished) finishedSubs.forEach((f) => f())
  wasIdleFinished = finished
  const connected = !!player.isConnected
  set({
    status: connected ? 'connected' : state.status === 'connecting' ? 'connecting' : 'ready',
    device: session?.getCastDevice?.()?.friendlyName || state.device,
    playing: connected && !player.isPaused && !idle,
    buffering: ps === 'BUFFERING',
    loaded: !!player.mediaInfo,
    time: Number(player.currentTime) || 0,
    duration: Number(player.duration) || 0,
    volume: typeof player.volumeLevel === 'number' ? player.volumeLevel : 1,
    muted: !!player.isMuted,
  })
  void cast
}

function setup() {
  const w = window as any
  const cast = w.cast
  const chromeCast = w.chrome?.cast
  if (!cast?.framework || !chromeCast) throw new Error('cast sdk missing')
  ctx = cast.framework.CastContext.getInstance()
  ctx.setOptions({
    receiverApplicationId: chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
    resumeSavedSession: true,
  })
  player = new cast.framework.RemotePlayer()
  ctl = new cast.framework.RemotePlayerController(player)
  ctl.addEventListener(cast.framework.RemotePlayerEventType.ANY_CHANGE, sync)
  ctx.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (e: any) => {
    const S = cast.framework.SessionState
    if (e.sessionState === S.SESSION_STARTING) set({ status: 'connecting', error: null })
    else if (e.sessionState === S.SESSION_STARTED || e.sessionState === S.SESSION_RESUMED) {
      set({ status: 'connected', error: null, device: ctx.getCurrentSession?.()?.getCastDevice?.()?.friendlyName || '' })
      sync()
    } else if (e.sessionState === S.SESSION_START_FAILED) set({ status: 'ready', error: errText(e.errorCode) ?? 'Could not connect to the device.' })
    else if (e.sessionState === S.SESSION_ENDED) {
      wasIdleFinished = false
      set({ status: 'ready', playing: false, buffering: false, loaded: false, device: '' })
    }
  })
  set({ status: 'ready' })
  // a session saved from before a page reload comes back on its own
  if (ctx.getCurrentSession?.()) {
    set({ status: 'connected', device: ctx.getCurrentSession().getCastDevice?.()?.friendlyName || '' })
    sync()
  }
}

/** Loads the Cast SDK once. Resolves true when casting is usable in this browser. */
export function initCast(): Promise<boolean> {
  if (started) return started
  started = new Promise<boolean>((resolve) => {
    const w = window as any
    const fail = () => {
      set({ status: 'unsupported' })
      resolve(false)
    }
    if (typeof document === 'undefined' || !window.isSecureContext) return fail() // Cast needs https (or localhost)
    const done = (ok: boolean) => {
      if (!ok) return fail()
      try {
        setup()
        resolve(true)
      } catch {
        fail()
      }
    }
    if (w.cast?.framework && w.chrome?.cast) return done(true)
    w.__onGCastApiAvailable = done
    const s = document.createElement('script')
    s.src = SDK
    s.async = true
    s.onerror = fail
    document.head.appendChild(s)
    window.setTimeout(() => state.status === 'loading' && fail(), 10_000)
  })
  return started
}

/** Opens the browser's device picker. Must be called from a tap / click. */
export async function castRequest() {
  if (!ctx) {
    if (!(await initCast())) return
  }
  try {
    set({ error: null })
    await ctx.requestSession()
  } catch (e) {
    const msg = errText(e)
    if (msg) set({ error: msg })
    if (state.status === 'connecting') set({ status: 'ready' })
  }
}

export const castStop = () => {
  try {
    ctx?.endCurrentSession(true)
  } catch {
    /* already gone */
  }
}

export interface CastLoad {
  url: string
  title: string
  subtitle?: string
  image?: string | null
  /** start position in seconds */
  time?: number
  autoplay?: boolean
  /** plain mp4 / webm instead of HLS */
  file?: boolean
}

/** Starts (or replaces) what the receiver plays. Resolves true on success. */
export async function castLoad(o: CastLoad): Promise<boolean> {
  const w = window as any
  const chromeCast = w.chrome?.cast
  const session = ctx?.getCurrentSession?.()
  if (!session || !chromeCast) return false
  const build = (fmp4: boolean) => {
    const ext = o.url.match(/\.(mp4|webm)(\?|&|$)/i)?.[1]?.toLowerCase()
    const mi = new chromeCast.media.MediaInfo(o.url, o.file ? (ext === 'webm' ? 'video/webm' : 'video/mp4') : 'application/x-mpegURL')
    mi.streamType = chromeCast.media.StreamType.BUFFERED
    if (!o.file && fmp4) {
      mi.hlsSegmentFormat = chromeCast.media.HlsSegmentFormat?.FMP4
      mi.hlsVideoSegmentFormat = chromeCast.media.HlsVideoSegmentFormat?.FMP4
    }
    const md = new chromeCast.media.GenericMediaMetadata()
    md.title = o.title
    if (o.subtitle) md.subtitle = o.subtitle
    if (o.image) md.images = [new chromeCast.Image(o.image)]
    mi.metadata = md
    const req = new chromeCast.media.LoadRequest(mi)
    req.autoplay = o.autoplay !== false
    req.currentTime = Math.max(0, o.time ?? 0)
    return req
  }
  // Some HLS streams use fMP4 segments, which the receiver only plays when told so: try TS first, then fMP4.
  for (const fmp4 of o.file ? [false] : [false, true]) {
    try {
      const res = await session.loadMedia(build(fmp4))
      if (!res) {
        set({ error: null })
        return true
      }
    } catch {
      /* try the next format */
    }
  }
  set({ error: errText('load_media_failed') })
  return false
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

export const castTogglePlay = () => ctl?.playOrPause()
export const castSeek = (t: number) => {
  if (!player || !ctl) return
  player.currentTime = clamp(t, 0, state.duration || t)
  ctl.seek()
  set({ time: player.currentTime })
}
export const castSetVolume = (v: number) => {
  if (!player || !ctl) return
  player.volumeLevel = clamp(v, 0, 1)
  ctl.setVolumeLevel()
  set({ volume: player.volumeLevel, muted: false })
}
export const castToggleMute = () => ctl?.muteOrUnmute()

/** The url the TV can fetch: absolute, and with every segment through our proxy (no referer tricks on the TV). */
export const castUrl = (streamUrl: string) => {
  // same trick the player uses when direct segments fail: without &seg=1 the proxy rewrites every segment through itself
  const proxied = streamUrl.replace(/([?&])seg=1(&|$)/, (_m, a, b) => (b ? a : ''))
  try {
    return new URL(proxied, window.location.href).href
  } catch {
    return proxied
  }
}

/* ---------- AirPlay (Safari / iOS) ---------- */
type AirVideo = HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void }
export const airplaySupported = () => typeof window !== 'undefined' && 'WebKitPlaybackTargetAvailabilityEvent' in window
export const airplayPicker = (v: HTMLVideoElement | null) => {
  try {
    ;(v as AirVideo | null)?.webkitShowPlaybackTargetPicker?.()
  } catch {
    /* picker unavailable */
  }
}
