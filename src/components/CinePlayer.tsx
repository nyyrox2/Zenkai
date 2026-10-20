import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import Hls from 'hls.js'
import {
  Check, FastForward, Languages, List, Maximize, Minimize, Music, Pause, PictureInPicture2, Play, RotateCcw, RotateCw,
  Server, Settings, SkipBack, SkipForward, Upload, Volume1, Volume2, VolumeX, X,
} from 'lucide-react'
import { apiUrl } from '../services/api'
import { LoadingGrid } from './LoadingGrid'
import { Tour, tourDone, tourSeen, type TourStep } from './Tour'
import { gpuSupported, startUpscale } from '../lib/upscale'
import { findActiveCue, parseSubtitleText, type Cue } from '../lib/subtitles'
import './cineplayer.css'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const SUB_SIZE = { small: 1.1, medium: 1.4, large: 1.85 } as const
const CAP_COLORS = ['#ffffff', '#ffe14d', '#5fe3ff', '#7dff9b']
const CAP_EDGE = {
  none: 'none',
  shadow: '0 1px 2px #000',
  outline: '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000',
} as const
const CAP_DEFAULT = { size: 'medium' as keyof typeof SUB_SIZE, bg: 74, pos: 0, color: '#ffffff', edge: 'shadow' as keyof typeof CAP_EDGE }
type CapStyle = typeof CAP_DEFAULT
const loadCap = (): CapStyle => {
  try {
    return { ...CAP_DEFAULT, ...JSON.parse(localStorage.getItem('zp-cap') || '{}') }
  } catch {
    return CAP_DEFAULT
  }
}
const EP_PAGE = 100
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0
  const h = (s / 3600) | 0
  const m = ((s % 3600) / 60) | 0
  const x = s % 60 | 0
  return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(x).padStart(2, '0')}`
}

type Seg = { start: number; end: number } | null | undefined
const ASPECTS = ['Fit', 'Fill', 'Stretch', '16:9', '4:3'] as const
type Aspect = (typeof ASPECTS)[number]
const loadAspect = (): Aspect => {
  try {
    const v = localStorage.getItem('zp-ar') as Aspect
    return ASPECTS.includes(v) ? v : 'Fit'
  } catch {
    return 'Fit'
  }
}
/** Video box style per aspect mode. 16:9 / 4:3 stretch the picture to that ratio, then letterbox it inside the player. */
const aspectStyle = (a: Aspect): CSSProperties => {
  if (a === 'Fit') return {}
  if (a === 'Fill') return { objectFit: 'cover' }
  if (a === 'Stretch') return { objectFit: 'fill' }
  const r = a === '16:9' ? 16 / 9 : 4 / 3
  return { objectFit: 'fill', inset: 0, margin: 'auto', width: `min(100cqw, ${r} * 100cqh)`, height: `min(100cqh, 100cqw / ${r})` }
}
const readNum = (k: string, d: number) => {
  try {
    const v = localStorage.getItem(k)
    return v === null ? d : Number(v)
  } catch {
    return d
  }
}
const saveNum = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v))
  } catch {
    /* ignore */
  }
}
type SheetName = null | 'subs' | 'set' | 'eps' | 'srv' | 'aud'
interface Track {
  id: string
  label: string
  language: string
  url?: string
  source?: string
  cues?: Cue[]
  referer?: string
}

export interface PlayerServer {
  id: string
  name: string
  note: string
  disabled?: boolean
}

export interface CinePlayerProps {
  streamUrl: string
  intro?: Seg
  outro?: Seg
  title: string
  episode: number
  episodeTitle?: string
  totalEpisodes: number
  availableEpisodes?: number
  animeId: number
  format?: string | null
  directSubtitles?: { id: string; label: string; lang?: string; url: string }[]
  audioMode?: 'sub' | 'dub'
  onAudio?: (m: 'sub' | 'dub') => void
  /** reports the stream's audio renditions (and the active one) so the page can list them; [] when the player goes away */
  onAudioTracks?: (tracks: { i: number; label: string; lang: string }[], active: number) => void
  /** page asks for a rendition; pass a fresh object per request */
  audioSel?: { i: number } | null
  /** false while the page's own tutorial is open, so the two don't overlap */
  tourReady?: boolean
  servers?: PlayerServer[]
  serverId?: string
  onServer?: (id: string) => void
  hasNextEpisode?: boolean
  hasPrevEpisode?: boolean
  onNextEpisode?: () => void
  onPrevEpisode?: () => void
  onSelectEpisode?: (n: number) => void
  onEnded?: () => void
  /** called every few seconds while playing, for continue-watching */
  onProgress?: (pos: number, dur: number) => void
  autoNext?: boolean
  onAutoNext?: (v: boolean) => void
  autoSkip?: boolean
  onAutoSkip?: (v: boolean) => void
  /** what the "next" buttons really go to (they jump over filler when skipFiller is on); defaults to episode + 1 */
  nextEpisode?: number
  /** this episode is non-canon: shows its label and, for filler / recap, a skip button */
  episodeKind?: 'filler' | 'mixed' | 'recap'
  skipFiller?: boolean
  onSkipFiller?: (v: boolean) => void
  /** next episode's stream is being fetched; the player stays mounted (and fullscreen) meanwhile */
  switching?: boolean
}

const PLAYER_TOUR: TourStep[] = [
  { target: '[data-tour="p-play"]', title: 'Play & pause', text: 'Tap to play or pause. Double-tap the left or right side of the video to jump 10 seconds.' },
  { target: '[data-tour="p-seek"]', title: 'Seek bar', text: 'Drag to jump anywhere in the episode. Tap or hover for a time preview.' },
  { target: '[data-tour="p-cc"]', title: 'Subtitles', text: 'Turn captions on, pick a language, or load your own file.' },
  { target: '[data-tour="p-audio"]', title: 'Audio', text: 'Switch the audio language or sub/dub without leaving the player.' },
  { target: '[data-tour="p-srv"]', title: 'Servers', text: 'Video not loading? Switch to another server from here.' },
  { target: '[data-tour="p-set"]', title: 'Settings', text: 'Quality, speed, aspect ratio and the 4K upscaler live here.' },
  { target: '[data-tour="p-fs"]', title: 'Fullscreen', text: 'Go fullscreen. On a phone, turning it sideways does this automatically.' },
]

function Sheet({ title, onClose, target, children }: { title: string; onClose: () => void; target: HTMLElement; children: React.ReactNode }) {
  return createPortal(
    <div className="zp-sw" onClick={onClose}>
      <div className="zp-sh" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="zp-sh-h">
          <h4>{title}</h4>
          <button className="zp-b" style={{ '--s': '40px' } as React.CSSProperties} onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="zp-sh-b">{children}</div>
      </div>
    </div>,
    target,
  )
}

function Episodes({ total, available, current, onPick }: { total: number; available: number; current: number; onPick: (n: number) => void }) {
  const [page, setPage] = useState(Math.floor((current - 1) / EP_PAGE))
  const pages = Math.ceil(total / EP_PAGE)
  const from = page * EP_PAGE + 1
  const to = Math.min(total, from + EP_PAGE - 1)
  return (
    <>
      {pages > 1 && (
        <div className="zp-pg">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} className={cx('zp-pi', i === page && 'on')} onClick={() => setPage(i)}>
              {i * EP_PAGE + 1}–{Math.min(total, (i + 1) * EP_PAGE)}
            </button>
          ))}
        </div>
      )}
      <div className="zp-eg">
        {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((n) => (
          <button key={n} className={cx('zp-pi', n === current && 'on')} disabled={n > available} onClick={() => onPick(n)}>
            {n}
          </button>
        ))}
      </div>
    </>
  )
}

/** Plain files (mp4 / webm) bypass hls.js; the proxied url keeps the real one in ?url= */
const isFileSrc = (u: string) => {
  try {
    const real = new URL(u, window.location.href).searchParams.get('url') ?? u
    return /\.(mp4|webm|mkv)(\?|$)/i.test(real) && !/\.m3u8/i.test(real)
  } catch {
    return false
  }
}
let noSeg = false
const ALANG = 'zp-alang'
const readAlang = () => {
  try {
    return localStorage.getItem(ALANG) || ''
  } catch {
    return ''
  }
}

/** Max quality preference (set on the Profile page): 0 = no cap. */
const readMaxQuality = () => {
  try {
    return Number(localStorage.getItem('zp-q')) || 0
  } catch {
    return 0
  }
}

const posKey = (id: number, ep: number) => `zk:pos:${id}:${ep}`
const readPos = (id: number, ep: number) => {
  try {
    return Number(localStorage.getItem(posKey(id, ep))) || 0
  } catch {
    return 0
  }
}

export default function CinePlayer({
  streamUrl, intro, outro, title, episode, episodeTitle = '', totalEpisodes, availableEpisodes, animeId, format,
  directSubtitles = [], audioMode = 'sub', onAudio, onAudioTracks, audioSel, tourReady = true, servers, serverId, onServer,
  hasNextEpisode = false, hasPrevEpisode = false, onNextEpisode, onPrevEpisode, onSelectEpisode, onEnded, onProgress,
  autoNext = true, onAutoNext, autoSkip = false, onAutoSkip,
  nextEpisode, episodeKind, skipFiller = false, onSkipFiller, switching = false,
}: CinePlayerProps) {
  const vid = useRef<HTMLVideoElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const hls = useRef<Hls | null>(null)
  const bar = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const hideT = useRef(0)
  const fbT = useRef(0)
  const fbAt = useRef(0)
  const tok = useRef(0)
  const skipped = useRef(-1)
  const tap = useRef({ t: 0, side: 0, timer: 0 })
  const st = useRef({ playing: false, sheet: null as SheetName, show: true })
  const api = useRef({ togglePlay: () => {}, toggleMute: () => {}, toggleFs: () => {}, poke: () => {}, doSkip: () => {}, skipOn: false, v: 1 })

  const [playing, setPlaying] = useState(false)
  const [fillAsk, setFillAsk] = useState(false) // "Skip filler?" prompt: asked once per episode, then gone
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const [buf, setBuf] = useState(0)
  const [vol, setVol] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [show, setShow] = useState(true)
  const [busy, setBusy] = useState(true)
  const [err, setErr] = useState(false)
  const [retry, setRetry] = useState(0)
  const [isFs, setIsFs] = useState(false)
  const [fake, setFake] = useState(false)
  const [tour, setTour] = useState(false)
  const autoFs = useRef(false)
  const [pip, setPip] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [scrub, setScrub] = useState<number | null>(null)
  const [levels, setLevels] = useState<{ i: number; label: string }[]>([])
  const [lvl, setLvl] = useState(-1)
  const [audioTracks, setAudioTracks] = useState<{ i: number; label: string; lang: string }[]>([])
  const [audioIdx, setAudioIdx] = useState(0)
  const [fb, setFb] = useState<{ side: number; n: number; k: number } | null>(null)
  const [sheet, setSheet] = useState<SheetName>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [trackId, setTrackId] = useState<string | null>(null)
  const [cues, setCues] = useState<Cue[]>([])
  const [caps, setCaps] = useState(true)
  const [offset, setOffset] = useState(0) // subtitle delay in seconds (+ = later)
  const [up, setUpRaw] = useState(() => gpuSupported && readNum('zp-up', 0) === 1)
  const [upInt, setUpIntRaw] = useState(() => readNum('zp-upi', 100))
  const [upErr, setUpErr] = useState<string | null>(null)
  const [vkey, setVkey] = useState(0)
  const cv = useRef<HTMLCanvasElement>(null)
  const setUp = (on: boolean) => {
    setUpErr(null)
    setUpRaw(on)
    saveNum('zp-up', on ? 1 : 0)
  }
  const setUpInt = (n: number) => {
    setUpIntRaw(n)
    saveNum('zp-upi', n)
  }
  const [ar, setArRaw] = useState<Aspect>(loadAspect)
  const setAr = (a: Aspect) => {
    setArRaw(a)
    try {
      localStorage.setItem('zp-ar', a)
    } catch {
      /* ignore */
    }
  }
  const [cs, setCsRaw] = useState<CapStyle>(loadCap)
  const setCs = (p: Partial<CapStyle>) =>
    setCsRaw((c) => {
      const n = { ...c, ...p }
      try {
        localStorage.setItem('zp-cap', JSON.stringify(n))
      } catch {
        /* storage unavailable */
      }
      return n
    })
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [subErr, setSubErr] = useState<string | null>(null)
  const [card, setCard] = useState(true)

  st.current = { playing, sheet, show }

  /* ── controls visibility ── */
  const poke = useCallback(() => {
    setShow(true)
    clearTimeout(hideT.current)
    const s = st.current
    if (s.playing && !s.sheet) hideT.current = window.setTimeout(() => setShow(false), 3200)
  }, [])
  useEffect(() => {
    poke()
    return () => clearTimeout(hideT.current)
  }, [playing, sheet, poke])

  /* ── HLS ── */
  useEffect(() => {
    const v = vid.current
    if (!v || !streamUrl) return
    setBusy(true)
    setErr(false)
    setLevels([])
    setLvl(-1)
    setAudioTracks([])
    setAudioIdx(0)
    setTime(0)
    setDur(0)
    setBuf(0)
    setCard(true)
    skipped.current = -1
    const saved = readPos(animeId, episode)
    const onMeta = () => {
      if (saved > 10 && saved < v.duration - 45) v.currentTime = saved
      v.play().catch(() => {})
    }
    let h: Hls | null = null
    let fails = 0

    if (!isFileSrc(streamUrl) && Hls.isSupported()) {
      h = new Hls({ enableWorker: true, backBufferLength: 90, maxBufferLength: 45, startPosition: saved > 10 ? saved : -1 })
      hls.current = h
      h.loadSource(noSeg ? streamUrl.replace('&seg=1', '') : streamUrl)
      h.attachMedia(v)
      h.on(Hls.Events.MANIFEST_PARSED, (_: any, d: any) => {
        setLevels(
          (d.levels || [])
            .map((l: any, i: number) => ({ i, h: l.height || 0, label: l.height ? `${l.height}p` : `Level ${i + 1}` }))
            .sort((a: any, b: any) => b.h - a.h),
        )
        // Profile → "Max quality": auto-switching stays on, it just never goes above the chosen height
        const cap = readMaxQuality()
        const ok = cap ? (d.levels || []).map((l: any, i: number) => ({ i, h: l.height || 0 })).filter((l: any) => l.h && l.h <= cap).sort((a: any, b: any) => b.h - a.h) : []
        if (ok.length && h) h.autoLevelCapping = ok[0].i
        v.play().catch(() => {})
      })
      // Multi-audio streams (ACDN): list the renditions, restore the language picked last time
      h.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_: any, d: any) => {
        const list = (d.audioTracks || []).map((t: any, i: number) => ({ i, label: t.name || t.lang || `Track ${i + 1}`, lang: t.lang || '' }))
        setAudioTracks(list)
        const want = readAlang().toLowerCase()
        const name = want.length === 2 ? (new Intl.DisplayNames(['en'], { type: 'language' }).of(want) ?? '').toLowerCase() : ''
        const at = want ? list.find((t: any) => t.lang.toLowerCase() === want || t.label.toLowerCase() === want || (name && t.label.toLowerCase().includes(name))) : null
        if (at && h && h.audioTrack !== at.i) h.audioTrack = at.i
        setAudioIdx(h ? h.audioTrack : 0)
      })
      h.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => setAudioIdx(h ? h.audioTrack : 0))
      h.on(Hls.Events.ERROR, (_: any, d: any) => {
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && h && !noSeg && streamUrl.includes('&seg=1')) {
          noSeg = true // ponytail: any network error on direct segments (referer/CORS) -> proxy everything, for the rest of the session
          h.loadSource(streamUrl.replace('&seg=1', ''))
          return
        }
        if (!d.fatal) return
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && fails++ < 3) h?.startLoad()
        else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && fails++ < 3) h?.recoverMediaError()
        else {
          h?.destroy()
          setErr(true)
          setBusy(false)
        }
      })
    } else if (isFileSrc(streamUrl) || v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = streamUrl
      v.addEventListener('loadedmetadata', onMeta)
    } else {
      setErr(true)
      setBusy(false)
    }

    const onHalt = () => {
      try {
        if (h) {
          h.stopLoad()
          h.destroy()
        }
        hls.current = null
        v.pause()
        v.removeAttribute('src')
        v.load()
        setBusy(false)
      } catch {}
    }
    window.addEventListener('zenkai:devtools-halt', onHalt)

    const t = window.setTimeout(() => setCard(false), 3800)
    return () => {
      window.removeEventListener('zenkai:devtools-halt', onHalt)
      window.clearTimeout(t)
      v.removeEventListener('loadedmetadata', onMeta)
      if (h) h.destroy()
      hls.current = null
      if (!h) {
        v.removeAttribute('src')
        v.load()
      }
    }
  }, [streamUrl, retry, animeId, episode])

  /* remember position every 5s */
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const v = vid.current
      if (!v || !v.duration) return
      if (v.currentTime > 10) onProgress?.(Math.floor(v.currentTime), Math.floor(v.duration))
      try {
        if (v.currentTime > 10 && v.currentTime < v.duration - 45) localStorage.setItem(posKey(animeId, episode), String(Math.floor(v.currentTime)))
        else localStorage.removeItem(posKey(animeId, episode))
      } catch {
        /* storage unavailable */
      }
    }, 5000)
    return () => window.clearInterval(id)
  }, [playing, animeId, episode])

  /* ── subtitles ── */
  /** Fetch + parse a caption file; true when it produced cues. Stream captions need the player's referer, so try the proxy first, then the raw url. */
  const loadTrack = async (url: string | undefined, my: number, referer?: string): Promise<boolean> => {
    if (!url) return false
    const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname))
    const streamProxy = !isDev ? (import.meta.env.VITE_STREAM_PROXY_URL as string | undefined)?.trim() : undefined
    const proxyBase = streamProxy ? (streamProxy.includes('/proxy') ? streamProxy : `${streamProxy.replace(/\/+$/, '')}/api/public/proxy`) : apiUrl('/api/proxy')
    const proxied = `${proxyBase}?url=${encodeURIComponent(url)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`
    for (const u of [proxied, url]) {
      try {
        const res = await fetch(u)
        if (!res.ok) continue
        const parsed = parseSubtitleText(await res.text())
        if (!parsed.length) continue
        if (my === tok.current) setCues(parsed)
        return true
      } catch {
        /* try the next route */
      }
    }
    return false
  }

  const pick = async (t: Track): Promise<boolean> => {
    const my = ++tok.current
    setTrackId(t.id)
    setCaps(true)
    setSubErr(null)
    setCues([])
    if (t.cues) {
      setCues(t.cues)
      return true
    }
    const ok = await loadTrack(t.url, my, t.referer)
    if (!ok && my === tok.current) setSubErr(`Couldn't load "${t.label}". Try another track.`)
    return ok
  }

  const subKey = JSON.stringify(directSubtitles)
  useEffect(() => {
    let dead = false
    ;(async () => {
      setLoadingSubs(true)
      setCues([])
      const all: Track[] = directSubtitles.map((s, i) => ({
        id: s.id || `direct_${i}`,
        label: s.label || s.lang || `Track ${i + 1}`,
        language: s.lang || s.label || 'English',
        url: s.url,
        source: 'Stream',
        referer: 'https://megaplay.buzz/',
      }))
      try {
        const q = new URLSearchParams({ title, ep: String(episode), id: String(animeId), format: format ?? '' })
        const res = await fetch(apiUrl(`/api/subtitles?${q}`))
        if (res.ok) {
          const data = (await res.json()) as { subtitles?: Track[] }
          for (const s of data.subtitles ?? []) if (!all.some((c) => c.language.toLowerCase() === s.language.toLowerCase())) all.push(s)
        }
      } catch {
        /* OpenSubtitles is optional */
      }
      if (dead) return
      setTracks(all)
      setLoadingSubs(false)
      const def = all.find((t) => t.language.toLowerCase().includes('eng')) || all[0]
      if (!def) return setTrackId(null)
      // a broken default must not hide the rest: walk the list until one actually loads
      for (const t of [def, ...all.filter((x) => x !== def)]) {
        if (dead || (await pick(t))) break
      }
    })()
    return () => {
      dead = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, episode, animeId, subKey])

  const uploadSub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const r = new FileReader()
    r.onload = (ev) => {
      const t: Track = {
        id: `custom_${Date.now()}`,
        label: `Custom (${f.name.replace(/\.[^/.]+$/, '')})`,
        language: 'Custom',
        source: 'Upload',
        cues: parseSubtitleText(String(ev.target?.result ?? '')),
      }
      setTracks((p) => [t, ...p])
      void pick(t)
      setSheet(null)
    }
    r.readAsText(f)
  }

  /* ── video events ── */
  const onTime = () => {
    const v = vid.current
    if (!v) return
    setTime(v.currentTime)
    if (v.duration > 0) {
      let end = 0
      for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 0.5) end = Math.max(end, v.buffered.end(i))
      setBuf(end / v.duration)
    }
  }

  const inIntro = intro != null && intro.end > 0 && time >= intro.start && time <= intro.end
  const inOutro = outro != null && outro.end > 0 && time >= outro.start && time <= outro.end
  const skip = inIntro ? { label: 'Skip intro', to: intro!.end } : inOutro ? { label: 'Skip outro', to: outro!.end } : null
  const doSkip = () => {
    if (skip && vid.current) {
      vid.current.currentTime = skip.to
      poke()
    }
  }
  /* ── GPU upscaler (Anime4K): restarts when the toggle flips or the stream changes resolution ── */
  useEffect(() => {
    const v = vid.current
    if (!v) return
    const on = () => setVkey((k) => k + 1)
    v.addEventListener('resize', on)
    return () => v.removeEventListener('resize', on)
  }, [])
  useEffect(() => {
    const v = vid.current
    const c = cv.current
    if (!up || !v || !c) return
    let dead = false
    let stop: (() => void) | undefined
    startUpscale(v, c, () => !dead && setUpErr('GPU too slow'))
      .then((s) => (dead ? s() : (stop = s)))
      .catch((e: unknown) => {
        if (dead) return
        setUpErr(e instanceof Error ? e.message : 'Upscaler failed')
      })
    return () => {
      dead = true
      stop?.()
    }
  }, [up, vkey])

  const cue = caps && cues.length ? findActiveCue(cues, time, -offset) : null
  const upNext = !skip && hasNextEpisode && dur > 0 && dur - time <= 20 && !!onNextEpisode
  const skipFill = fillAsk && !skip && !upNext && (episodeKind === 'filler' || episodeKind === 'recap') && hasNextEpisode && !!onNextEpisode
  useEffect(() => {
    const non = episodeKind === 'filler' || episodeKind === 'recap'
    setFillAsk(non)
    if (!non) return
    const t = window.setTimeout(() => setFillAsk(false), 15000) // unanswered: quietly goes away
    return () => window.clearTimeout(t)
  }, [episode, episodeKind])

  useEffect(() => {
    if (autoSkip && skip && skipped.current !== skip.to && vid.current) {
      skipped.current = skip.to
      vid.current.currentTime = skip.to
    }
  })

  /* ── actions ── */
  const togglePlay = () => {
    const v = vid.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
    poke()
  }

  const seek = (d: number, quiet = false) => {
    const v = vid.current
    if (!v) return
    const t = clamp(v.currentTime + d, 0, v.duration || 0)
    v.currentTime = t
    setTime(t)
    const side = d < 0 ? -1 : 1
    const now = Date.now()
    setFb((p) => (p && p.side === side && now - fbAt.current < 800 ? { side, n: p.n + Math.abs(d), k: p.k + 1 } : { side, n: Math.abs(d), k: (p?.k || 0) + 1 }))
    fbAt.current = now
    clearTimeout(fbT.current)
    fbT.current = window.setTimeout(() => setFb(null), 700)
    if (!quiet) poke()
  }

  const setVolume = (f: number) => {
    const v = vid.current
    if (!v) return
    const n = clamp(f, 0, 1)
    v.volume = n
    v.muted = n === 0
    poke()
  }

  const toggleMute = () => {
    const v = vid.current
    if (!v) return
    v.muted = !v.muted
    if (!v.muted && v.volume === 0) v.volume = 0.6
    poke()
  }

  const setRate = (s: number) => {
    setSpeed(s)
    if (vid.current) vid.current.playbackRate = s
  }
  const setQuality = (i: number) => {
    setLvl(i)
    if (hls.current) hls.current.currentLevel = i
  }
  const setAudioTrack = (t: { i: number; lang: string; label: string }) => {
    if (hls.current) hls.current.audioTrack = t.i
    setAudioIdx(t.i)
    try {
      localStorage.setItem(ALANG, t.lang || t.label)
    } catch {
      /* storage unavailable */
    }
  }
  const atRef = useRef(onAudioTracks)
  atRef.current = onAudioTracks
  useEffect(() => {
    atRef.current?.(audioTracks, audioIdx)
  }, [audioTracks, audioIdx])
  useEffect(() => () => atRef.current?.([], 0), [])
  useEffect(() => {
    const t = audioSel ? audioTracks[audioSel.i] : null
    if (t) setAudioTrack(t)
  }, [audioSel])

  // first visit: guided tour once the stream has loaded (and the page tour, if any, is finished)
  useEffect(() => {
    if (!tourReady || tour || err || dur <= 0 || tourSeen('player')) return
    const t = window.setTimeout(() => setTour(true), 600)
    return () => window.clearTimeout(t)
  }, [tourReady, dur, err])

  // phones: turning the device sideways while playing goes fullscreen, turning back leaves it
  useEffect(() => {
    if (!matchMedia('(pointer: coarse)').matches) return
    const mq = matchMedia('(orientation: landscape)')
    const f = () => {
      const el = root.current
      const v = vid.current
      if (!el || !v) return
      if (mq.matches) {
        if (v.paused || document.fullscreenElement) return
        autoFs.current = true
        if (el.requestFullscreen) el.requestFullscreen().catch(() => setFake(true))
        else setFake(true) // iOS: no element fullscreen, use the CSS one
      } else if (autoFs.current) {
        autoFs.current = false
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        setFake(false)
      }
    }
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  const toggleFs = () => {
    const el = root.current
    if (!el) return
    autoFs.current = false
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else if (fake) setFake(false)
    else if (el.requestFullscreen)
      el
        .requestFullscreen()
        .then(() => {
          // portrait phone + fullscreen button: rotate to landscape (Android; iOS has no lock API)
          const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
          if (matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth) o.lock?.('landscape').catch(() => {})
        })
        .catch(() => setFake(true))
    else setFake(true)
    poke()
  }

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await vid.current?.requestPictureInPicture()
    } catch {
      /* not allowed */
    }
    poke()
  }

  useEffect(() => {
    const f = () => {
      const on = document.fullscreenElement === root.current
      setIsFs(on)
      if (!on) screen.orientation?.unlock?.()
    }
    document.addEventListener('fullscreenchange', f)
    setPip(!!document.pictureInPictureEnabled)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  useEffect(() => {
    if (!fake) return
    const o = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = o
    }
  }, [fake])

  /* ── keyboard ── */
  api.current = { togglePlay, toggleMute, toggleFs, poke, doSkip, skipOn: !!skip, v: muted ? 0 : vol }
  const keys = useRef({ seek, setVolume, setRate, togglePiP, speed, dur, hasNext: hasNextEpisode, hasPrev: hasPrevEpisode, next: onNextEpisode, prev: onPrevEpisode })
  keys.current = { seek, setVolume, setRate, togglePiP, speed, dur, hasNext: hasNextEpisode, hasPrev: hasPrevEpisode, next: onNextEpisode, prev: onPrevEpisode }
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return
      const a = api.current
      const kk = keys.current
      const v = vid.current
      const key = e.key
      const k = key.toLowerCase()
      const tv = document.documentElement.hasAttribute('data-tv')
      const arrow = key.startsWith('Arrow')
      const onBtn = t.tagName === 'BUTTON' || t.tagName === 'A'
      const inCtl = onBtn && !!root.current?.contains(t) // focus is on a control (TV: D-pad moves between them)
      if (k === ' ' && onBtn) return
      if (tv && arrow && st.current.sheet) return // an open menu: the D-pad moves through it
      if (tv && arrow && inCtl) {
        poke() // keep the controls up while the D-pad is working them
        return
      }
      const step = e.shiftKey ? 30 : 10
      let h: (() => void) | null = null
      if (k === ' ' || k === 'k' || (key === 'Enter' && !onBtn)) h = a.togglePlay
      else if (key === 'MediaPlayPause') h = a.togglePlay
      else if (key === 'MediaPlay') h = () => !st.current.playing && a.togglePlay()
      else if (key === 'MediaPause' || key === 'MediaStop') h = () => st.current.playing && a.togglePlay()
      else if (key === 'MediaTrackNext' || k === 'n') h = () => kk.hasNext && kk.next?.()
      else if (key === 'MediaTrackPrevious' || k === 'p') h = () => kk.hasPrev && kk.prev?.()
      else if (key === 'MediaFastForward') h = () => kk.seek(30)
      else if (key === 'MediaRewind') h = () => kk.seek(-30)
      else if (k === 'arrowleft') h = () => kk.seek(-step)
      else if (k === 'arrowright') h = () => kk.seek(step)
      else if (k === 'j') h = () => kk.seek(-10)
      else if (k === 'l') h = () => kk.seek(10)
      else if (tv && (k === 'arrowup' || k === 'arrowdown')) {
        // TV: Up / Down bring up the controls and put focus on Play (the remote has its own volume keys)
        h = () => root.current?.querySelector<HTMLElement>('.zp-hero')?.focus()
      } else if (k === 'arrowup') h = () => kk.setVolume(a.v + 0.1)
      else if (k === 'arrowdown') h = () => kk.setVolume(a.v - 0.1)
      else if (/^[0-9]$/.test(key) && v && kk.dur) h = () => ((v.currentTime = (kk.dur * Number(key)) / 10), setTime(v.currentTime))
      else if (k === 'home' && v) h = () => ((v.currentTime = 0), setTime(0))
      else if (k === 'end' && v && kk.dur) h = () => ((v.currentTime = Math.max(0, kk.dur - 1)), setTime(v.currentTime))
      else if ((key === ',' || key === '.') && v && v.paused) h = () => ((v.currentTime = clamp(v.currentTime + (key === ',' ? -1 : 1) / 24, 0, v.duration || 0)), setTime(v.currentTime))
      else if (key === '<') h = () => kk.setRate(SPEEDS[Math.max(0, SPEEDS.indexOf(kk.speed) - 1)])
      else if (key === '>') h = () => kk.setRate(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(kk.speed) + 1)])
      else if (k === 'f') h = a.toggleFs
      else if (k === 'i') h = () => void kk.togglePiP()
      else if (k === 'm') h = a.toggleMute
      else if (k === 'c') h = () => setCaps((c) => !c)
      else if (k === 'tab' && a.skipOn) h = a.doSkip
      else if (k === 'escape' && st.current.sheet) h = () => setSheet(null)
      else if (k === 'escape' && tv && inCtl) {
        // TV: Back from the controls returns to plain seeking
        h = () => {
          t.blur()
          clearTimeout(hideT.current)
          if (st.current.playing) setShow(false)
        }
      }
      if (!h) return
      e.preventDefault()
      h()
      if (k !== 'escape') a.poke()
    }
    window.addEventListener('keydown', kd)
    return () => window.removeEventListener('keydown', kd)
  }, [])

  /* ── tap / double-tap ── */
  const onTap = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const t = tap.current
    const now = Date.now()
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const side = x < 0.33 ? -1 : x > 0.67 ? 1 : 0
    const dbl = now - t.t < 280 && t.side === side
    clearTimeout(t.timer)
    if (e.pointerType === 'mouse') {
      togglePlay()
      if (dbl) toggleFs()
      t.t = dbl ? 0 : now
      t.side = side
      return
    }
    if (side && (dbl || now - fbAt.current < 700)) {
      t.t = 0
      seek(side * 10, true)
      return
    }
    if (dbl) {
      t.t = 0
      togglePlay()
      return
    }
    t.t = now
    t.side = side
    t.timer = window.setTimeout(() => {
      t.t = 0
      if (st.current.show) {
        clearTimeout(hideT.current)
        setShow(false)
      } else poke()
    }, 280)
  }

  /* ── seek bar ── */
  const frac = (e: RPointerEvent) => {
    const r = bar.current!.getBoundingClientRect()
    return clamp((e.clientX - r.left) / r.width, 0, 1)
  }
  const sDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dur) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrub(frac(e) * dur)
  }
  const sMove = (e: RPointerEvent<HTMLDivElement>) => {
    const f = frac(e)
    setHover(f)
    if (scrub !== null) setScrub(f * dur)
  }
  const sUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (scrub === null) return
    const t = frac(e) * dur
    if (vid.current) vid.current.currentTime = t
    setTime(t)
    setScrub(null)
    poke()
  }

  const shown = scrub ?? time
  const pct = dur ? clamp((shown / dur) * 100, 0, 100) : 0
  const tipF = scrub !== null ? scrub / dur : hover
  const vShown = muted ? 0 : vol
  const fs = isFs || fake
  const adj = (d: number) => setOffset((o) => Math.round((o + d) * 10) / 10)
  const avail = availableEpisodes ?? totalEpisodes
  const target = fs ? (root.current ?? document.body) : document.body
  const seg = (s: Seg) => (s && dur > 0 && s.end > s.start ? { left: `${(s.start / dur) * 100}%`, width: `${((s.end - s.start) / dur) * 100}%` } : null)
  const si = seg(intro)
  const so = seg(outro)

  return (
    <div
      ref={root}
      data-zk-player
      className={cx('zp', fs && 'zp-fs', fake && 'zp-fake', (show || tour) && 'show', !playing && 'zp-paused', fb && !show && 'zp-mini')}
      onPointerMove={(e) => e.pointerType === 'mouse' && poke()}
    >
      <video
        ref={vid}
        className="zp-v"
        style={{ ...aspectStyle(ar) }}
        playsInline
        preload="auto"
        onTimeUpdate={onTime}
        onDurationChange={() => setDur(vid.current?.duration || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBusy(true)}
        onCanPlay={() => setBusy(false)}
        onPlaying={() => setBusy(false)}
        onVolumeChange={() => {
          const v = vid.current
          if (!v) return
          setVol(v.volume)
          setMuted(v.muted)
        }}
        onEnded={() => {
          try {
            localStorage.removeItem(posKey(animeId, episode))
          } catch {
            /* ignore */
          }
          onEnded?.()
        }}
      />
      {up && !upErr && <canvas ref={cv} className="zp-v" style={{ ...aspectStyle(ar), opacity: upInt / 100, pointerEvents: 'none' }} />}
      <div className="zp-g" onPointerUp={onTap} />

      <div className="zp-in">
        {busy && !err && <div className="zp-spn" />}
        {switching && <LoadingGrid label="Loading episode" className="pointer-events-none absolute bottom-16 left-4 z-30 text-white/70" />}

        {card && !err && (
          <div className="zp-card">
            <h3>{title}</h3>
            <p>
              Episode {episode}
              {episodeTitle ? ` · ${episodeTitle}` : ''}
              {episodeKind ? ` · ${episodeKind === 'mixed' ? 'Mixed canon' : episodeKind === 'recap' ? 'Recap' : 'Filler'}` : ''}
              {audioMode ? ` · ${audioMode.toUpperCase()}` : ''}
            </p>
          </div>
        )}

        {fb && (
          <div key={fb.k} className={cx('zp-fb', fb.side < 0 ? 'l' : 'r')}>
            {fb.side < 0 ? <RotateCcw /> : <RotateCw />}
            <span>{fb.n} seconds</span>
          </div>
        )}

        {cue && (
          <div className="zp-sub" style={{ '--sp': `${cs.pos}%` } as CSSProperties}>
            <span
              style={{
                fontSize: `max(13px, calc(var(--u) * ${SUB_SIZE[cs.size]}))`,
                color: cs.color,
                background: `rgba(8,8,10,${cs.bg / 100})`,
                textShadow: CAP_EDGE[cs.edge],
              }}
            >
              {cue}
            </span>
          </div>
        )}

        {skip && (
          <button className="zp-sk" onClick={doSkip}>
            <FastForward />
            <span>{skip.label}</span>
            <kbd>Tab</kbd>
          </button>
        )}
        {upNext && (
          <button className="zp-sk" onClick={onNextEpisode}>
            <SkipForward />
            <span>Next · Ep {nextEpisode ?? episode + 1}</span>
          </button>
        )}
        {skipFill && (
          <div className="zp-sk zp-ask" role="group" aria-label={`Skip ${episodeKind}?`}>
            <span>Skip {episodeKind}?</span>
            <button type="button" className="y" onClick={() => (setFillAsk(false), onNextEpisode?.())}>Yes</button>
            <button type="button" onClick={() => setFillAsk(false)}>No</button>
          </div>
        )}

        <div className="zp-ui">
          <div className="zp-sc" />

          <div className="zp-top">
            <div className="zp-ti">
              <h3>{title}</h3>
              <p>
                Episode {episode}
                {episodeTitle ? ` · ${episodeTitle}` : ''}
              </p>
            </div>
            <div className="zp-ac">
              <button className={cx('zp-b', caps && tracks.length > 0 && 'on')} data-tour="p-cc" onClick={() => setSheet('subs')} aria-label="Subtitles" title="Subtitles [C]">
                <span className="zp-t">CC</span>
              </button>
              {audioTracks.length > 1 && (
                <button className="zp-b pill" data-tour="p-audio" onClick={() => setSheet('aud')} title="Audio track" aria-label="Audio track">
                  <Languages />
                  <em>{audioTracks.find((t) => t.i === audioIdx)?.label ?? 'Audio'}</em>
                </button>
              )}
              {onAudio && audioTracks.length < 2 && (
                <button className="zp-b pill" data-tour="p-audio" onClick={() => onAudio(audioMode === 'sub' ? 'dub' : 'sub')} title="Switch audio" aria-label="Switch audio">
                  <Music />
                  <em>{audioMode.toUpperCase()}</em>
                </button>
              )}
              {servers && servers.length > 0 && (
                <button className="zp-b" data-tour="p-srv" onClick={() => setSheet('srv')} aria-label="Servers" title="Servers">
                  <Server />
                </button>
              )}
              {onSelectEpisode && totalEpisodes > 1 && (
                <button className="zp-b" onClick={() => setSheet('eps')} aria-label="Episodes" title="Episodes">
                  <List />
                </button>
              )}
              <button className="zp-b" data-tour="p-set" onClick={() => setSheet('set')} aria-label="Settings" title="Settings">
                <Settings />
              </button>
            </div>
          </div>

          <div className="zp-mid">
            <button className="zp-b zp-pn" disabled={!hasPrevEpisode} onClick={() => onPrevEpisode?.()} aria-label="Previous episode" title="Previous episode">
              <SkipBack />
            </button>
            <button className="zp-b zp-sd" onClick={() => seek(-10)} aria-label="Back 10 seconds" title="Back 10s [J]">
              <RotateCcw />
              <span className="zp-n">10</span>
            </button>
            <button className="zp-b zp-hero" data-tour="p-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause [Space]">
              <Play className={cx('zp-ic pl', playing && 'off')} fill="currentColor" />
              <Pause className={cx('zp-ic', !playing && 'off')} fill="currentColor" />
            </button>
            <button className="zp-b zp-sd" onClick={() => seek(10)} aria-label="Forward 10 seconds" title="Forward 10s [L]">
              <RotateCw />
              <span className="zp-n">10</span>
            </button>
            <button className="zp-b zp-pn" disabled={!hasNextEpisode} onClick={() => onNextEpisode?.()} aria-label="Next episode" title="Next episode">
              <SkipForward />
            </button>
          </div>

          <div className="zp-bot">
            <div className="zp-sr">
              <span className="zp-tm">{fmt(shown)}</span>
              <div
                ref={bar}
                data-tour="p-seek"
                className={cx('zp-seek', scrub !== null && 'drag')}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={Math.round(dur)}
                aria-valuenow={Math.round(shown)}
                onPointerDown={sDown}
                onPointerMove={sMove}
                onPointerUp={sUp}
                onPointerCancel={() => setScrub(null)}
                onPointerLeave={() => setHover(null)}
              >
                <div className="zp-tr">
                  <i className="zp-bf" style={{ width: `${buf * 100}%` }} />
                  {si && <i className="zp-seg" style={si} />}
                  {so && <i className="zp-seg" style={so} />}
                  <i className="zp-pl" style={{ width: `${pct}%` }} />
                  <i className="zp-th" style={{ left: `${pct}%` }} />
                </div>
                {tipF != null && dur > 0 && (
                  <div className="zp-tip" style={{ '--x': `${tipF * 100}%` } as React.CSSProperties}>
                    {fmt(tipF * dur)}
                  </div>
                )}
              </div>
              <span className="zp-tm r">{fmt(dur)}</span>
            </div>

            <div className="zp-cr">
              <div className="zp-vg">
                <button className="zp-b" onClick={toggleMute} aria-label={vShown === 0 ? 'Unmute' : 'Mute'} title="Mute [M]">
                  {vShown === 0 ? <VolumeX /> : vShown < 0.5 ? <Volume1 /> : <Volume2 />}
                </button>
                <input
                  className="zp-vol"
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={vShown}
                  style={{ '--p': `${vShown * 100}%` } as React.CSSProperties}
                  onChange={(e) => setVolume(+e.target.value)}
                  aria-label="Volume"
                />
              </div>
              <button className="zp-b pill" onClick={() => setSheet('set')} aria-label="Playback speed" title="Playback speed">
                {speed}×
              </button>
              <span className="zp-flex" />
              {pip && (
                <button className="zp-b" onClick={togglePiP} aria-label="Picture in picture" title="Picture in picture">
                  <PictureInPicture2 />
                </button>
              )}
              <button className="zp-b" data-tour="p-fs" onClick={toggleFs} aria-label={fs ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen [F]">
                {fs ? <Minimize /> : <Maximize />}
              </button>
            </div>
          </div>
        </div>

        {err && (
          <div className="zp-er">
            <p>This stream couldn't be loaded.</p>
            <div className="zp-two" style={{ pointerEvents: 'auto' }}>
              <button className="zp-b pill" onClick={() => setRetry((n) => n + 1)}>
                Try again
              </button>
              {servers && servers.length > 0 && (
                <button className="zp-b pill" onClick={() => setSheet('srv')}>
                  Switch server
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {sheet === 'subs' && (
        <Sheet title="Subtitles" onClose={() => setSheet(null)} target={target}>
          <button className="zp-row" onClick={() => setCaps((c) => !c)}>
            <span>Show subtitles</span>
            <i className={cx('zp-tg', caps && 'on')} />
          </button>

          <p className="zp-sec">Sync (subtitle delay)</p>
          <div className="zp-off">
            {[-0.5, -0.1].map((d) => (
              <button key={d} className="zp-pi" onClick={() => adj(d)} aria-label={`Subtitles ${-d}s earlier`}>
                {d}
              </button>
            ))}
            <span>
              {offset > 0 ? '+' : ''}
              {offset.toFixed(1)}s
            </span>
            {[0.1, 0.5].map((d) => (
              <button key={d} className="zp-pi" onClick={() => adj(d)} aria-label={`Subtitles ${d}s later`}>
                +{d}
              </button>
            ))}
            <button className="zp-pi" onClick={() => setOffset(0)} disabled={offset === 0}>
              Reset
            </button>
          </div>

          <p className="zp-sec">Languages</p>
          {loadingSubs && <p className="zp-note">Searching for subtitles…</p>}
          {!loadingSubs && tracks.length === 0 && <p className="zp-note">No subtitles found. Upload your own below.</p>}
          {subErr && <p className="zp-note">{subErr}</p>}
          {tracks.map((t) => (
            <button key={t.id} className={cx('zp-row', t.id === trackId && 'on')} onClick={() => void pick(t)}>
              <span>
                {t.label}
                {t.source && <small>{t.source}</small>}
              </span>
              {t.id === trackId && <Check />}
            </button>
          ))}
          <button className="zp-row" onClick={() => file.current?.click()}>
            <Upload />
            <span>Upload subtitle file</span>
          </button>
          <input ref={file} type="file" accept=".srt,.vtt,.txt" hidden onChange={uploadSub} />

          <p className="zp-sec">Text size</p>
          <div className="zp-pg">
            {(Object.keys(SUB_SIZE) as (keyof typeof SUB_SIZE)[]).map((k) => (
              <button key={k} className={cx('zp-pi', cs.size === k && 'on')} onClick={() => setCs({ size: k })}>
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>

          <p className="zp-sec">Text color</p>
          <div className="zp-pg">
            {CAP_COLORS.map((c) => (
              <button
                key={c}
                className={cx('zp-pi zp-sw-c', cs.color === c && 'on')}
                style={{ '--c': c } as CSSProperties}
                onClick={() => setCs({ color: c })}
                aria-label={`Caption color ${c}`}
              />
            ))}
          </div>

          <p className="zp-sec">Text edge</p>
          <div className="zp-pg">
            {(Object.keys(CAP_EDGE) as (keyof typeof CAP_EDGE)[]).map((k) => (
              <button key={k} className={cx('zp-pi', cs.edge === k && 'on')} onClick={() => setCs({ edge: k })}>
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>

          <p className="zp-sec">Background opacity ({cs.bg}%)</p>
          <input
            type="range" className="zp-rg" min={0} max={100} step={5} value={cs.bg}
            style={{ '--p': `${cs.bg}%` } as CSSProperties}
            onChange={(e) => setCs({ bg: +e.target.value })}
            aria-label="Caption background opacity"
          />

          <p className="zp-sec">Vertical position ({cs.pos}% up from bottom)</p>
          <input
            type="range" className="zp-rg" min={0} max={70} step={5} value={cs.pos}
            style={{ '--p': `${(cs.pos / 70) * 100}%` } as CSSProperties}
            onChange={(e) => setCs({ pos: +e.target.value })}
            aria-label="Caption vertical position"
          />

          <button className="zp-pi" onClick={() => setCs(CAP_DEFAULT)}>
            Reset style
          </button>
        </Sheet>
      )}

      {tour && (
        <Tour
          steps={PLAYER_TOUR}
          container={target}
          video={() => vid.current}
          onDone={() => {
            setTour(false)
            tourDone('player')
          }}
        />
      )}

      {sheet === 'aud' && audioTracks.length > 0 && (
        <Sheet title="Audio" onClose={() => setSheet(null)} target={target}>
          <p className="zp-sec">Audio track</p>
          <div className="zp-rows">
            {audioTracks.map((t) => (
              <button
                key={t.i}
                className={cx('zp-row', t.i === audioIdx && 'on')}
                onClick={() => {
                  setAudioTrack(t)
                  setSheet(null)
                }}
              >
                <span>
                  {t.label}
                  {t.lang && t.lang.toLowerCase() !== t.label.toLowerCase() && <small>{t.lang}</small>}
                </span>
                {t.i === audioIdx && <Check />}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'set' && (
        <Sheet title="Settings" onClose={() => setSheet(null)} target={target}>
          <p className="zp-sec">Speed</p>
          <div className="zp-pg">
            {SPEEDS.map((s) => (
              <button key={s} className={cx('zp-pi', speed === s && 'on')} onClick={() => setRate(s)}>
                {s === 1 ? 'Normal' : `${s}×`}
              </button>
            ))}
          </div>
          {levels.length > 0 && (
            <>
              <p className="zp-sec">Quality</p>
              <button className={cx('zp-row', lvl === -1 && 'on')} onClick={() => setQuality(-1)}>
                <span>Auto</span>
                {lvl === -1 && <Check />}
              </button>
              {levels.map((l) => (
                <button key={l.i} className={cx('zp-row', lvl === l.i && 'on')} onClick={() => setQuality(l.i)}>
                  <span>{l.label}</span>
                  {lvl === l.i && <Check />}
                </button>
              ))}
            </>
          )}
          <p className="zp-sec">4K upscaler (GPU)</p>
          <button className="zp-row" disabled={!gpuSupported} onClick={() => setUp(!up)}>
            <span>Anime4K upscaling</span>
            <i className={cx('zp-tg', up && !upErr && 'on')} />
          </button>
          {up && !upErr && (
            <>
              <p className="zp-sec">Intensity ({upInt}%)</p>
              <input
                type="range" className="zp-rg" min={0} max={100} step={5} value={upInt}
                style={{ '--p': `${upInt}%` } as CSSProperties}
                onChange={(e) => setUpInt(+e.target.value)}
                aria-label="Upscaler intensity"
              />
            </>
          )}
          <p className="zp-note">
            {!gpuSupported
              ? 'This browser has no WebGPU, so the upscaler is unavailable.'
              : upErr
                ? `Upscaler off: ${upErr}.`
                : 'Runs on your GPU (Anime4K Mode A, up to 2× / 4K). Best on 720p–1080p sources.'}
          </p>
          <p className="zp-sec">Aspect ratio</p>
          <div className="zp-pg">
            {ASPECTS.map((a) => (
              <button key={a} className={cx('zp-pi', ar === a && 'on')} onClick={() => setAr(a)}>
                {a}
              </button>
            ))}
          </div>
          <p className="zp-sec">Playback</p>
          {onAutoNext && (
            <button className="zp-row" onClick={() => onAutoNext(!autoNext)}>
              <span>Autoplay next episode</span>
              <i className={cx('zp-tg', autoNext && 'on')} />
            </button>
          )}
          {onAutoSkip && (
            <button className="zp-row" onClick={() => onAutoSkip(!autoSkip)}>
              <span>Auto-skip intro &amp; outro</span>
              <i className={cx('zp-tg', autoSkip && 'on')} />
            </button>
          )}
          {onSkipFiller && (
            <button className="zp-row" onClick={() => onSkipFiller(!skipFiller)}>
              <span>Skip filler episodes</span>
              <i className={cx('zp-tg', skipFiller && 'on')} />
            </button>
          )}
        </Sheet>
      )}

      {sheet === 'srv' && servers && (
        <Sheet title="Servers" onClose={() => setSheet(null)} target={target}>
          {onAudio && (
            <>
              <p className="zp-sec">Audio</p>
              <div className="zp-two">
                {(['sub', 'dub'] as const).map((m) => (
                  <button key={m} className={cx('zp-pi', audioMode === m && 'on')} onClick={() => onAudio(m)}>
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="zp-sec">Source</p>
          <div className="zp-rows">
            {servers.map((s) => (
              <button
                key={s.id}
                className={cx('zp-row', s.id === serverId && 'on', s.disabled && 'dis')}
                onClick={() => {
                  onServer?.(s.id)
                  setSheet(null)
                }}
              >
                <span>
                  {s.name}
                  <small>{s.note}</small>
                </span>
                {s.id === serverId && <Check />}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'eps' && onSelectEpisode && (
        <Sheet title="Episodes" onClose={() => setSheet(null)} target={target}>
          <Episodes
            total={totalEpisodes}
            available={avail}
            current={episode}
            onPick={(n) => {
              onSelectEpisode(n)
              setSheet(null)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
