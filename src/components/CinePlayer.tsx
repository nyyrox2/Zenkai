import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import Hls from 'hls.js'
import {
  AudioLines, Check, CheckCircle2, ChevronDown, FastForward, Flag, Languages, List, Loader2, Maximize, Minimize, Music, Pause, PictureInPicture2, Play, RotateCcw, RotateCw,
  Search, Server, Settings, SkipBack, SkipForward, TriangleAlert, Upload, Volume1, Volume2, VolumeX, X,
} from 'lucide-react'
import { apiUrl, fetchStream, type EpInfo, type EpKind } from '../services/api'
import { KIND } from './EpisodeList'
import { LoadingGrid } from './LoadingGrid'
import { Tour, tourDone, tourSeen, type TourStep } from './Tour'
import { gpuSupported, startUpscale, type Anime4KMode } from '../lib/upscale'
import { findActiveCue, parseSubtitleText, type Cue } from '../lib/subtitles'
import { submitStreamReport } from '../lib/supabase'
import { toast } from '../lib/toast'
import './cineplayer.css'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const HOLD_RATE = 2 // press-and-hold on the video
const isEn = (t: { language: string; label: string }) => /^en\b|^eng|english/i.test(t.language) || /english/i.test(t.label)
const ISO: Record<string, string> = { en: 'English', eng: 'English', ar: 'Arabic', ara: 'Arabic', es: 'Spanish', spa: 'Spanish', fr: 'French', fre: 'French', fra: 'French', de: 'German', ger: 'German', deu: 'German', it: 'Italian', ita: 'Italian', pt: 'Portuguese', por: 'Portuguese', pob: 'Portuguese', ru: 'Russian', rus: 'Russian', hi: 'Hindi', hin: 'Hindi', ja: 'Japanese', jpn: 'Japanese', zh: 'Chinese', chi: 'Chinese', zho: 'Chinese', id: 'Indonesian', ind: 'Indonesian', th: 'Thai', tha: 'Thai', vi: 'Vietnamese', vie: 'Vietnamese', ko: 'Korean', kor: 'Korean', tr: 'Turkish', tur: 'Turkish', pl: 'Polish', pol: 'Polish', nl: 'Dutch', dut: 'Dutch', nld: 'Dutch' }
/** "Arabic - Arabic", "English #2", "eng" all fold into one language name so the menu can count them */
const langName = (t: { language: string; label: string }) => {
  const raw = (t.language || t.label || '').split(/[-–(#]/)[0].trim()
  return ISO[raw.toLowerCase()] ?? (raw ? raw[0].toUpperCase() + raw.slice(1) : 'Unknown')
}
function formatTrackSubLabel(label: string, lang: string): string {
  let s = (label || '').trim()
  if (!s) return 'Default'
  const langEsc = lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const prefixRegex = new RegExp(`^${langEsc}\\s*[-–:#]?\\s*`, 'i')
  if (prefixRegex.test(s)) {
    s = s.replace(prefixRegex, '').trim()
  }
  if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1).trim()
  }
  s = s.replace(/([a-zA-Z])\(([^)]+)\)/g, '$1 ($2)')
  if (!s || s.toLowerCase() === lang.toLowerCase()) {
    return 'Default'
  }
  return s
}
const sourceReferer = (id?: string) => (id?.startsWith('flixcloud') ? 'https://flixcloud.cc/' : 'https://megaplay.buzz/')

const SUB_SIZE = {
  tiny: 0.9,
  small: 1.15,
  medium: 1.45,
  large: 1.8,
  xlarge: 2.2,
} as const

// Web fonts only (loaded in index.html) — system stacks render as garbage on some Android OEM fonts.
const SUB_FONT_LIST = [
  ['sans', 'Inter', '"Inter", Arial, sans-serif'],
  ['fansub', 'Roboto', '"Roboto", Arial, sans-serif'],
  ['rounded', 'Rounded', '"Outfit", "Nunito", sans-serif'],
  ['nunito', 'Nunito', '"Nunito", sans-serif'],
  ['poppins', 'Poppins', '"Poppins", Arial, sans-serif'],
  ['montserrat', 'Montserrat', '"Montserrat", Arial, sans-serif'],
  ['oswald', 'Oswald', '"Oswald", Impact, sans-serif'],
  ['bebas', 'Bebas Neue', '"Bebas Neue", Impact, sans-serif'],
  ['atkinson', 'Hyperlegible', '"Atkinson Hyperlegible", Arial, sans-serif'],
  ['serif', 'Serif', '"Merriweather", Georgia, serif'],
  ['mono', 'Mono', '"Roboto Mono", "Courier New", monospace'],
  ['comic', 'Comic', '"Comic Neue", "Comic Sans MS", cursive'],
  ['bangers', 'Bangers', '"Bangers", Impact, cursive'],
] as const
type SubFont = (typeof SUB_FONT_LIST)[number][0]
const SUB_FONTS = Object.fromEntries(SUB_FONT_LIST.map(([k, , f]) => [k, f])) as Record<SubFont, string>
const SUB_FONT_LABELS = Object.fromEntries(SUB_FONT_LIST.map(([k, l]) => [k, l])) as Record<SubFont, string>

const CAP_COLORS = [
  '#ffffff', // White
  '#ffe14d', // Yellow
  '#5fe3ff', // Cyan
  '#7dff9b', // Mint
  '#ff9f43', // Amber
  '#ff78c4', // Pink
]

const EDGE_KEYS = ['none', 'shadow', 'outline', 'heavy', 'glow'] as const
type EdgeKey = (typeof EDGE_KEYS)[number]
const capEdge = (k: EdgeKey, c: string) =>
  ({
    none: 'none',
    shadow: `0 2px 4px ${c}e6, 0 1px 2px ${c}`,
    outline: `-1px -1px 0 ${c}, 1px -1px 0 ${c}, -1px 1px 0 ${c}, 1px 1px 0 ${c}`,
    heavy: `-2px -2px 0 ${c}, 2px -2px 0 ${c}, -2px 2px 0 ${c}, 2px 2px 0 ${c}, 0 2px 6px ${c}`,
    glow: `0 0 6px currentColor, 0 0 12px ${c}e6, 0 2px 4px ${c}`,
  })[k] ?? 'none'

const EDGE_COLORS = ['#000000', '#ffffff', '#dc143c', '#1e66ff', '#7a3cff']
const BG_COLORS = ['#08080a', '#000000', '#1c1c24', '#0b1d4d', '#4d0b14', '#ffffff']
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0).join(',')

const CAP_BOX = {
  pill: 'Pill',
  block: 'Block',
  none: 'None',
} as const

const CAP_DEFAULT = {
  size: 'medium' as keyof typeof SUB_SIZE,
  font: 'sans' as SubFont,
  weight: 700,
  spacing: 'normal' as 'normal' | 'wide' | 'tight',
  bg: 65,
  boxStyle: 'pill' as keyof typeof CAP_BOX,
  pos: 0,
  color: '#ffffff',
  edge: 'shadow' as EdgeKey,
  scale: 100,
  italic: false,
  upper: false,
  edgeColor: '#000000',
  bgColor: '#08080a',
  opacity: 100,
  lh: 135,
  width: 100,
  blur: 0,
  align: 'center' as 'left' | 'center' | 'right',
}
type CapStyle = typeof CAP_DEFAULT

const capCss = (cs: CapStyle, u: string): CSSProperties => {
  const plain = cs.boxStyle === 'none' || cs.bg === 0
  return {
    fontSize: `max(13px, calc(${u} * ${(SUB_SIZE[cs.size] ?? 1.45) * (cs.scale / 100)}))`,
    fontFamily: SUB_FONTS[cs.font] ?? SUB_FONTS.sans,
    fontWeight: cs.weight ?? 700,
    fontStyle: cs.italic ? 'italic' : 'normal',
    textTransform: cs.upper ? 'uppercase' : 'none',
    letterSpacing: cs.spacing === 'wide' ? '0.06em' : cs.spacing === 'tight' ? '-0.02em' : 'normal',
    color: `rgba(${hexRgb(cs.color)},${cs.opacity / 100})`,
    lineHeight: cs.lh / 100,
    maxWidth: `${cs.width}%`,
    textAlign: cs.align,
    backdropFilter: !plain && cs.blur ? `blur(${cs.blur}px)` : undefined,
    WebkitBackdropFilter: !plain && cs.blur ? `blur(${cs.blur}px)` : undefined,
    background: plain ? 'transparent' : `rgba(${hexRgb(cs.bgColor)},${cs.bg / 100})`,
    textShadow: capEdge(cs.edge, cs.edgeColor),
    padding: plain ? '0.1em 0.35em' : '0.25em 0.7em',
    borderRadius: cs.boxStyle === 'block' ? '2px' : '0.45em',
  }
}

const CAP_PRESETS: [string, Partial<CapStyle>][] = [
  ['Default', CAP_DEFAULT],
  ['Netflix', { font: 'fansub', weight: 500, edge: 'shadow', boxStyle: 'none', bg: 0 }],
  ['Fansub', { font: 'fansub', color: '#ffe14d', edge: 'heavy', boxStyle: 'none', bg: 0 }],
  ['Cinema', { font: 'serif', weight: 400, edge: 'outline', boxStyle: 'none', bg: 0 }],
  ['Comic', { font: 'bangers', upper: true, spacing: 'wide', edge: 'heavy', boxStyle: 'none', bg: 0 }],
  ['Glass', { font: 'rounded', boxStyle: 'pill', bg: 35, blur: 8 }],
  ['Accessible', { font: 'atkinson', size: 'large', color: '#ffe14d', boxStyle: 'block', bg: 90, bgColor: '#000000', edge: 'none' }],
]

const loadCap = (): CapStyle => {
  try {
    return { ...CAP_DEFAULT, ...JSON.parse(localStorage.getItem('zp-cap') || '{}') }
  } catch {
    return CAP_DEFAULT
  }
}

export type VideoFilterPreset = 'off' | 'vibrant' | 'cinema' | 'sharp' | 'warm'

const VIDEO_FILTER_DEFAULTS = {
  preset: 'off' as VideoFilterPreset,
  brightness: 100,
  contrast: 100,
  saturation: 100,
}
type VideoFilters = typeof VIDEO_FILTER_DEFAULTS

const loadVideoFilters = (): VideoFilters => {
  try {
    return { ...VIDEO_FILTER_DEFAULTS, ...JSON.parse(localStorage.getItem('zp-vfx') || '{}') }
  } catch {
    return VIDEO_FILTER_DEFAULTS
  }
}

const ANIME4K_MODES: Array<{ id: Anime4KMode; label: string; desc: string }> = [
  { id: 'modeA', label: 'Mode A', desc: 'Balanced restoration & 2× upscale (Best for 720p/1080p anime)' },
  { id: 'modeB', label: 'Mode B', desc: 'Soft restoration (Reduces compression ringing & artifacts)' },
  { id: 'modeC', label: 'Mode C', desc: 'Sharp outlines & high detail for crisp modern animation' },
  { id: 'modeAA', label: 'Mode AA', desc: 'Double-pass ultra restoration for maximum clean detail' },
  { id: 'denoise', label: 'Denoise', desc: 'Artifact removal & debanding + 2× CNN upscale' },
  { id: 'fast', label: 'Fast CNN', desc: 'Lightweight 2× neural net (low battery / integrated GPU)' },
]
const EP_PAGE = 25
const fmtAir = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null)
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
type SheetName = null | 'subs' | 'set' | 'eps' | 'report'
type PopName = null | 'spd' | 'q' | 'cc' | 'aud' | 'srv'
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
  episodesInfo?: Map<number, EpInfo>
  fallbackImg?: string | null
  defaultRuntime?: number | null
  kinds?: Map<number, EpKind>
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

function Sheet({
  title,
  onClose,
  target,
  className,
  bodyClassName,
  children,
}: {
  title: string
  onClose: () => void
  target: HTMLElement
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return createPortal(
    <div className="zp-sw" onClick={onClose}>
      <div className={cx('zp-sh', className)} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="zp-sh-h">
          <h4>{title}</h4>
          <button className="zp-b" style={{ '--s': '40px' } as React.CSSProperties} onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className={cx('zp-sh-b', bodyClassName)}>{children}</div>
      </div>
    </div>,
    target,
  )
}

function Episodes({
  total,
  available,
  current,
  episodesInfo,
  fallbackImg,
  defaultRuntime,
  kinds,
  onPick,
}: {
  total: number
  available: number
  current: number
  episodesInfo?: Map<number, EpInfo>
  fallbackImg?: string | null
  defaultRuntime?: number | null
  kinds?: Map<number, EpKind>
  onPick: (n: number) => void
}) {
  const pages = Math.ceil(total / EP_PAGE)
  const [page, setPage] = useState(() => Math.max(0, Math.min(pages - 1, Math.floor(((current ?? 1) - 1) / EP_PAGE))))
  const [q, setQ] = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const currentItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!dropOpen) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [dropOpen])

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page, q])

  useEffect(() => {
    if (currentItemRef.current) {
      currentItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [])

  const from = page * EP_PAGE + 1
  const to = Math.min(total, from + EP_PAGE - 1)

  const ranges = useMemo(() => {
    return Array.from({ length: pages }, (_, i) => ({
      index: i,
      label: `Episodes ${i * EP_PAGE + 1} – ${Math.min(total, (i + 1) * EP_PAGE)}`,
      short: `${i * EP_PAGE + 1} – ${Math.min(total, (i + 1) * EP_PAGE)}`,
    }))
  }, [pages, total])

  const nums = useMemo(() => {
    const term = q.trim().toLowerCase()
    let list = Array.from({ length: total }, (_, i) => i + 1)
    if (term) {
      const numMatch = term.replace(/^ep(isode)?\s*/i, '').trim()
      list = list
        .filter((n) => {
          if (numMatch && String(n) === numMatch) return true
          if (String(n) === term) return true
          const epName = episodesInfo?.get(n)?.name
          return epName ? epName.toLowerCase().includes(term) : false
        })
        .slice(0, 100)
    } else {
      list = list.slice(from - 1, to)
    }
    return list
  }, [q, total, from, to, episodesInfo])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="relative z-20 shrink-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search episode or title…"
              aria-label="Search episodes"
              className="h-8 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-7 text-xs text-white placeholder:text-white/40 outline-none transition focus:border-white/30"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-white/40 hover:text-white"
                aria-label="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {pages > 1 && !q && (
            <div ref={dropRef} className="relative shrink-0 sm:w-44">
              <button
                type="button"
                onClick={() => setDropOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={dropOpen}
                className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-white transition hover:bg-white/10"
              >
                <span className="truncate">{ranges[page]?.short ?? 'Range'}</span>
                <ChevronDown className={cx('size-3.5 shrink-0 text-white/50 transition-transform duration-200', dropOpen && 'rotate-180')} />
              </button>

              {dropOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 top-full mt-1.5 z-30 max-h-56 w-48 overflow-y-auto rounded-lg border border-white/10 bg-[#0c0c10]/70 backdrop-blur-xl p-1 shadow-xl scrollbar-thin"
                >
                  {ranges.map((r) => (
                    <button
                      key={r.index}
                      role="option"
                      aria-selected={r.index === page}
                      type="button"
                      onClick={() => {
                        setPage(r.index)
                        setDropOpen(false)
                        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={cx(
                        'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                        r.index === page
                          ? 'bg-white/10 font-semibold text-white'
                          : 'text-white/75 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <span>{r.label}</span>
                      {r.index === page && <Check className="size-3 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-white/45 px-0.5">
          <span>{q ? `${nums.length} match${nums.length === 1 ? '' : 'es'} found` : `Showing ${from}–${to} of ${total} episodes`}</span>
          {pages > 1 && !q && <span className="text-[10px] uppercase tracking-wider text-white/35">Page {page + 1}/{pages}</span>}
        </div>
      </div>

      <div
        ref={listRef}
        tabIndex={0}
        aria-label="Episodes list"
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-1 scrollbar-thin outline-none"
      >
        {nums.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-white/40">
            No episodes found matching "{q}".
          </div>
        ) : (
          nums.map((n) => {
            const e = episodesInfo?.get(n)
            const aired = n <= available
            const on = n === current
            const img = e?.image ?? fallbackImg ?? null
            const mins = e?.runtime ?? defaultRuntime
            const air = fmtAir(e?.air ?? null)
            const kind = kinds?.get(n)
            const name = e?.name ?? `Episode ${n}`

            return (
              <button
                key={n}
                ref={on ? currentItemRef : undefined}
                type="button"
                onClick={() => onPick(n)}
                disabled={!aired}
                aria-current={on ? 'true' : undefined}
                className={cx(
                  'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition',
                  on
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:bg-white/5 hover:text-white',
                  !aired && 'cursor-not-allowed opacity-35 hover:bg-transparent'
                )}
              >
                <div className="relative aspect-video w-24 sm:w-28 shrink-0 overflow-hidden rounded-md bg-white/5">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={cx(
                        'h-full w-full object-cover transition-opacity duration-200',
                        !e?.image && 'opacity-60'
                      )}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/5 text-[10px] font-bold text-white/40">
                      EP {n}
                    </div>
                  )}
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  {kind && KIND[kind] && (
                    <span
                      className={cx(
                        'absolute left-1 top-1 rounded px-1 py-0.2 text-[8.5px] font-bold uppercase',
                        KIND[kind].cls
                      )}
                    >
                      {KIND[kind].label}
                    </span>
                  )}
                  <span className="absolute bottom-1 left-1.5 font-display text-xs font-bold text-white">
                    {n}
                  </span>
                  {aired && (
                    <span
                      className={cx(
                        'absolute bottom-1 right-1 grid size-5 place-items-center rounded bg-black/60 text-white',
                        on && 'bg-[var(--a,#dc143c)] text-white'
                      )}
                    >
                      {on ? <AudioLines className="size-2.5" /> : <Play className="size-2 fill-current" />}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 py-0.5">
                  <p
                    className={cx(
                      'line-clamp-1 text-xs sm:text-sm leading-snug font-medium',
                      on ? 'text-white font-semibold' : 'text-white/90 group-hover:text-white'
                    )}
                  >
                    {name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/45">
                    <span>Ep {n}</span>
                    {mins ? <span>· {mins}m</span> : null}
                    {air && <span>· {air}</span>}
                    {kind && KIND[kind] && (
                      <span className="text-[10px] font-medium text-amber-400">
                        · {KIND[kind].label}
                      </span>
                    )}
                    {!aired && (
                      <span className="text-[10px] text-white/30">
                        · Not aired
                      </span>
                    )}
                    {on && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--a2,#ff4d6a)]">
                        · Playing
                      </span>
                    )}
                  </div>
                  {e?.overview && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-white/35">
                      {e.overview}
                    </p>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
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

function findTrackForMode(
  tracks: { i: number; label: string; lang: string }[],
  mode: 'sub' | 'dub' = 'sub',
  savedLang?: string,
) {
  if (!tracks.length) return null

  if (mode === 'dub') {
    // 1. Look for explicit English / Dub track
    const dub = tracks.find((t) => {
      const l = t.label.toLowerCase()
      const g = t.lang.toLowerCase()
      return (
        g === 'en' ||
        g === 'eng' ||
        l.includes('english') ||
        l.includes('dub') ||
        l.includes('eng')
      )
    })
    if (dub) return dub

    // 2. Fallback to any non-Japanese/non-native track
    const nonJpn = tracks.find((t) => {
      const l = t.label.toLowerCase()
      const g = t.lang.toLowerCase()
      return g !== 'ja' && g !== 'jpn' && !l.includes('japanese') && !l.includes('native') && !l.includes('sub')
    })
    if (nonJpn) return nonJpn
  } else {
    // mode === 'sub' -> Look for Japanese / Native / Original track
    const sub = tracks.find((t) => {
      const l = t.label.toLowerCase()
      const g = t.lang.toLowerCase()
      return (
        g === 'ja' ||
        g === 'jpn' ||
        l.includes('japanese') ||
        l.includes('native') ||
        l.includes('sub') ||
        l.includes('original') ||
        l.includes('jp')
      )
    })
    if (sub) return sub
  }

  // 3. If a saved language was chosen specifically and matches
  if (savedLang) {
    const s = savedLang.toLowerCase()
    const hit = tracks.find((t) => t.lang.toLowerCase() === s || t.label.toLowerCase() === s)
    if (hit) return hit
  }

  return tracks[0]
}

/** Preferred quality (Profile page): 0 = auto. */
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
  episodesInfo, fallbackImg, defaultRuntime, kinds,
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
  const st = useRef({ playing: false, sheet: null as SheetName, pop: null as PopName, show: true })
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
  const pv = useRef<HTMLVideoElement>(null) // seek-bar preview video (muted, lowest quality, starts on first hover)
  const pvT = useRef<number | null>(null)
  const [pvOn, setPvOn] = useState(false)
  const [pvRdy, setPvRdy] = useState(false)
  const [scrub, setScrub] = useState<number | null>(null)
  const [levels, setLevels] = useState<{ i: number; label: string }[]>([])
  const [lvl, setLvl] = useState(-1)
  const [audioTracks, setAudioTracks] = useState<{ i: number; label: string; lang: string }[]>([])
  const [audioIdx, setAudioIdx] = useState(0)
  const [fb, setFb] = useState<{ side: number; n: number; k: number } | null>(null)
  const [sheet, setSheet] = useState<SheetName>(null)
  const [pop, setPopRaw] = useState<PopName>(null)
  const [grp, setGrp] = useState<string | null>('English')
  const [subSearch, setSubSearch] = useState('')
  const [note, setNote] = useState<{ k: 'load' | 'ok' | 'err'; msg: string } | null>(null)
  const [srcLeft, setSrcLeft] = useState(0) // other servers still being asked for captions
  const noteTimer = useRef(0)
  const [held, setHeld] = useState(false)
  const hold = useRef({ timer: 0, on: false, prev: 1 })
  const setPop = (p: PopName) => setPopRaw((c) => (c === p ? null : p))
  const [reportIssue, setReportIssue] = useState('Broken / Won\'t Play')
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportSuccess, setReportSuccess] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [trackId, setTrackId] = useState<string | null>(null)
  const [cues, setCues] = useState<Cue[]>([])
  const [caps, setCaps] = useState(true)
  const [offset, setOffset] = useState(0) // subtitle delay in seconds (+ = later)
  const [up, setUpRaw] = useState(() => gpuSupported && readNum('zp-up', 0) === 1)
  const [upInt, setUpIntRaw] = useState(() => readNum('zp-upi', 100))
  const [upMode, setUpModeRaw] = useState<Anime4KMode>(() => {
    const m = (typeof localStorage !== 'undefined' ? localStorage.getItem('zp-upm') : null) as Anime4KMode
    return m && ['modeA', 'modeB', 'modeC', 'modeAA', 'denoise', 'fast'].includes(m) ? m : 'modeA'
  })
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
  const setUpMode = (m: Anime4KMode) => {
    setUpErr(null)
    setUpModeRaw(m)
    try {
      localStorage.setItem('zp-upm', m)
    } catch {}
  }
  const [vfx, setVfxRaw] = useState<VideoFilters>(loadVideoFilters)
  const setVfx = (patch: Partial<VideoFilters>) => {
    setVfxRaw((p) => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem('zp-vfx', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const videoFilterStyle = useMemo(() => {
    const list: string[] = []
    if (vfx.preset === 'vibrant') {
      list.push('saturate(1.28) contrast(1.06) brightness(1.02)')
    } else if (vfx.preset === 'cinema') {
      list.push('contrast(1.18) saturate(1.1) brightness(0.98)')
    } else if (vfx.preset === 'sharp') {
      list.push('contrast(1.14) brightness(1.02)')
    } else if (vfx.preset === 'warm') {
      list.push('sepia(0.2) saturate(1.08) brightness(0.98)')
    }
    if (vfx.brightness !== 100) list.push(`brightness(${vfx.brightness}%)`)
    if (vfx.contrast !== 100) list.push(`contrast(${vfx.contrast}%)`)
    if (vfx.saturation !== 100) list.push(`saturate(${vfx.saturation}%)`)
    return list.length ? list.join(' ') : undefined
  }, [vfx])
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
const slider = (label: string, key: 'opacity' | 'lh' | 'width' | 'blur' | 'scale', min: number, max: number, step: number, unit = '%') => (
    <>
      <p className="zp-sec">{label} ({cs[key]}{unit})</p>
      <input
        type="range" className="zp-rg" min={min} max={max} step={step} value={cs[key]}
        style={{ '--p': `${((cs[key] - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => setCs({ [key]: +e.target.value })}
        aria-label={label}
      />
    </>
  )
  const swatch = (list: string[], key: 'color' | 'bgColor' | 'edgeColor') => (
    <>
      {list.map((c) => (
        <button
          key={c}
          className={cx('zp-pi zp-sw-c', cs[key] === c && 'on')}
          style={{ '--c': c, backgroundColor: c } as CSSProperties}
          onClick={() => setCs({ [key]: c })}
          aria-label={`${key} ${c}`}
        />
      ))}
      <label
        className="zp-pi zp-sw-c"
        style={{ '--c': 'conic-gradient(#f33,#fd3,#3f6,#3df,#36f,#f3d,#f33)', position: 'relative' } as CSSProperties}
        aria-label="Custom color"
      >
        <input
          type="color" value={cs[key]}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
          onChange={(e) => setCs({ [key]: e.target.value })}
        />
      </label>
    </>
  )

  st.current = { playing, sheet, pop, show }

  /* ── controls visibility ── */
  const poke = useCallback(() => {
    setShow(true)
    clearTimeout(hideT.current)
    const s = st.current
    if (s.playing && !s.sheet && !s.pop) hideT.current = window.setTimeout(() => setShow(false), 3200)
  }, [])
  useEffect(() => {
    poke()
    return () => clearTimeout(hideT.current)
  }, [playing, sheet, pop, poke])

  /* ── seek preview: tiny second video on the lowest level, only loads after the first hover ── */
  useEffect(() => {
    const p = pv.current
    setPvRdy(false)
    if (!pvOn || !p || !streamUrl) return
    const url = noSeg ? streamUrl.replace('&seg=1', '') : streamUrl
    let h: Hls | null = null
    if (!isFileSrc(streamUrl) && Hls.isSupported()) {
      h = new Hls({ enableWorker: false, startLevel: 0, maxBufferLength: 2, maxMaxBufferLength: 4, backBufferLength: 0, capLevelToPlayerSize: false })
      h.loadSource(url)
      h.attachMedia(p)
      h.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!h || !h.levels.length) return
        let low = 0
        h.levels.forEach((l: any, i: number) => {
          if ((l.bitrate || 0) < (h!.levels[low].bitrate || 0)) low = i
        })
        h.currentLevel = low
      })
      h.on(Hls.Events.ERROR, (_: any, d: any) => {
        if (d.fatal) {
          h?.destroy()
          h = null
        }
      })
    } else {
      p.src = url
    }
    return () => {
      h?.destroy()
      p.removeAttribute('src')
      p.load()
    }
  }, [pvOn, streamUrl, retry])

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
        const all = (d.levels || []).map((l: any, i: number) => ({ i, h: l.height || 0, br: l.bitrate || 0, label: l.height ? `${l.height}p` : `Level ${i + 1}` }))
        // one entry per height (a stream can list several codecs of the same size): keep the richest
        const list = all.filter((l: any) => !l.h || !all.some((o: any) => o.h === l.h && o.br > l.br)).sort((a: any, b: any) => b.h - a.h)
        setLevels(list)
        // Profile → "Preferred quality": start locked on that height (or the closest one below it); Auto stays one tap away
        const want = readMaxQuality()
        const pick = want ? list.find((l: any) => l.h && l.h <= want) ?? list[list.length - 1] : null
        if (pick && h) {
          h.currentLevel = pick.i
          setLvl(pick.i)
        }
        v.play().catch(() => {})
      })
      // Multi-audio streams (ACDN, FlixCloud, etc.): list the renditions, match audioMode or language
      h.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_: any, d: any) => {
        const list = (d.audioTracks || []).map((t: any, i: number) => ({ i, label: t.name || t.lang || `Track ${i + 1}`, lang: t.lang || '' }))
        setAudioTracks(list)
        const target = findTrackForMode(list, audioMode, readAlang())
        if (target && h) {
          if (h.audioTrack !== target.i) h.audioTrack = target.i
          setAudioIdx(target.i)
        } else {
          setAudioIdx(h ? h.audioTrack : 0)
        }
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

  /** top-of-player notification; loading stays until replaced, results fade after a moment */
  const flash = (k: 'load' | 'ok' | 'err', msg: string) => {
    window.clearTimeout(noteTimer.current)
    setNote({ k, msg })
    if (k !== 'load') noteTimer.current = window.setTimeout(() => setNote(null), k === 'ok' ? 2600 : 4200)
  }
  useEffect(() => () => window.clearTimeout(noteTimer.current), [])

  const pick = async (t: Track, quiet = false): Promise<boolean> => {
    const my = ++tok.current
    const name = `${langName(t)}${t.source ? ` · ${t.source}` : ''}`
    setTrackId(t.id)
    setCaps(true)
    setSubErr(null)
    setCues([])
    if (t.cues) {
      setCues(t.cues)
      if (!quiet) flash('ok', `Subtitles: ${name}`)
      return true
    }
    if (!quiet) flash('load', `Downloading ${name}…`)
    const ok = await loadTrack(t.url, my, t.referer)
    if (my === tok.current) {
      if (ok) {
        if (!quiet) flash('ok', `Subtitles: ${name}`)
      } else {
        setSubErr(`Couldn't load "${t.label}". Try another track.`)
        if (!quiet) flash('err', `Couldn't load ${name}. Try another track or source.`)
      }
    }
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
        source: servers?.find((x) => x.id === serverId)?.name ?? 'Stream',
        referer: sourceReferer(serverId),
      }))
      try {
        const q = new URLSearchParams({ title, ep: String(episode), id: String(animeId), format: format ?? '' })
        const res = await fetch(apiUrl(`/api/subtitles?${q}`))
        if (res.ok) {
          const data = (await res.json()) as { subtitles?: Track[] }
          for (const s of data.subtitles ?? []) if (!all.some((c) => c.url === s.url)) all.push(s) // every source, not one per language
        }
      } catch {
        /* OpenSubtitles is optional */
      }
      if (dead) return
      setTracks(all)
      setLoadingSubs(false)

      // ask every other direct server for its captions too; they trickle into the menu as each answers
      const seen = new Set(all.map((t) => t.url))
      const others = (servers ?? []).filter((x) => x.id !== serverId && x.id !== 'acdn') // ponytail: ACDN carries no caption files; add it here if that changes
      setSrcLeft(others.length)
      for (const x of others) {
        fetchStream({ id: animeId, ep: episode, server: x.id, audio: audioMode, title, format })
          .then((r) => {
            const add: Track[] = r.subtitles
              .filter((s) => s.file && !seen.has(s.file))
              .map((s, i) => ({ id: `${x.id}_${i}_${s.file}`, label: s.label, language: s.label, url: s.file, source: x.name, referer: sourceReferer(x.id) }))
            add.forEach((t) => seen.add(t.url))
            if (!dead && add.length) setTracks((p) => [...p, ...add])
          })
          .catch(() => {
            /* that server has nothing for this episode */
          })
          .finally(() => !dead && setSrcLeft((n) => Math.max(0, n - 1)))
      }

      const def = all.find(isEn) || all[0]
      if (!def) return setTrackId(null)
      // a broken default must not hide the rest: walk the list until one actually loads
      for (const t of [def, ...all.filter((x) => x !== def)]) {
        if (dead || (await pick(t, true))) break
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

  // every language with how many captions it has, English first
  const langs = (() => {
    const m = new Map<string, Track[]>()
    for (const t of tracks) m.set(langName(t), [...(m.get(langName(t)) ?? []), t])
    return [...m].sort(([a], [b]) => (a === 'English' ? -1 : b === 'English' ? 1 : a.localeCompare(b)))
  })()

  const filteredLangs = useMemo(() => {
    const q = subSearch.trim().toLowerCase()
    if (!q) return langs
    return langs.filter(
      ([name, list]) =>
        name.toLowerCase().includes(q) ||
        list.some((t) => t.label.toLowerCase().includes(q) || (t.source && t.source.toLowerCase().includes(q)))
    )
  }, [langs, subSearch])

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
    setUpErr(null)
    startUpscale(v, c, {
      mode: upMode,
      onSlow: (reason) => {
        if (!dead && reason) setUpErr(reason)
      },
    })
      .then((s) => (dead ? s() : (stop = s)))
      .catch((e: unknown) => {
        if (dead) return
        setUpErr(e instanceof Error ? e.message : 'Upscaler initialization failed')
      })
    return () => {
      dead = true
      stop?.()
    }
  }, [up, upMode, vkey])

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
    flash('ok', `Audio: ${t.label}`)
    if (hls.current) hls.current.audioTrack = t.i
    setAudioIdx(t.i)
    const l = t.label.toLowerCase()
    const g = t.lang.toLowerCase()
    const isDub = g === 'en' || g === 'eng' || l.includes('english') || l.includes('dub')
    const isSub = g === 'ja' || g === 'jpn' || l.includes('native') || l.includes('japanese')
    if (isDub && onAudio && audioMode !== 'dub') {
      onAudio('dub')
    } else if (isSub && onAudio && audioMode !== 'sub') {
      onAudio('sub')
    }
    try {
      localStorage.setItem(ALANG, t.lang || t.label)
    } catch {
      /* storage unavailable */
    }
  }

  // Live switch HLS audio track when audioMode ('sub' | 'dub') changes from the parent
  useEffect(() => {
    if (!audioTracks.length || !hls.current) return
    const target = findTrackForMode(audioTracks, audioMode)
    if (target && hls.current.audioTrack !== target.i) {
      hls.current.audioTrack = target.i
      setAudioIdx(target.i)
    }
  }, [audioMode, audioTracks])
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
      if (tv && arrow && (st.current.sheet || st.current.pop)) return // an open menu: the D-pad moves through it
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
      else if (k === 'escape' && (st.current.sheet || st.current.pop)) h = () => (setSheet(null), setPopRaw(null))
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
    if (st.current.pop) return setPopRaw(null)
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

  /* ── hold to speed up: press and hold the video, release to go back ── */
  const holdStart = (e: RPointerEvent) => {
    if (e.button !== 0) return
    const h = hold.current
    window.clearTimeout(h.timer)
    h.timer = window.setTimeout(() => {
      const v = vid.current
      if (!v || v.paused || st.current.pop) return
      h.on = true
      h.prev = v.playbackRate
      v.playbackRate = HOLD_RATE
      setHeld(true)
    }, 400)
  }
  const holdEnd = () => {
    const h = hold.current
    window.clearTimeout(h.timer)
    if (!h.on) return false
    h.on = false
    if (vid.current) vid.current.playbackRate = h.prev
    setHeld(false)
    return true
  }

  /* ── seek bar ── */
  const frac = (e: RPointerEvent) => {
    const r = bar.current!.getBoundingClientRect()
    return clamp((e.clientX - r.left) / r.width, 0, 1)
  }
  // one seek at a time on the preview video; always lands on the newest hovered time
  const pvGo = () => {
    const p = pv.current
    if (!p || pvT.current == null || p.seeking || p.readyState < 1) return
    const t = pvT.current
    pvT.current = null
    p.currentTime = t
  }
  const pvSeek = (t: number) => {
    if (!dur || (navigator as any).connection?.saveData) return
    if (!pvOn) setPvOn(true)
    pvT.current = clamp(t, 0, Math.max(0, dur - 0.5))
    pvGo()
  }
  const sDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!dur) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrub(frac(e) * dur)
    pvSeek(frac(e) * dur)
  }
  const sMove = (e: RPointerEvent<HTMLDivElement>) => {
    const f = frac(e)
    setHover(f)
    pvSeek(f * dur)
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
        style={{ ...aspectStyle(ar), filter: videoFilterStyle }}
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
      {up && !upErr && <canvas ref={cv} className="zp-v" style={{ ...aspectStyle(ar), opacity: upInt / 100, pointerEvents: 'none', filter: videoFilterStyle }} />}
      <div className="zp-g" onPointerDown={holdStart} onPointerUp={(e) => holdEnd() || onTap(e)} onPointerCancel={holdEnd} onPointerLeave={holdEnd} onContextMenu={(e) => e.preventDefault()} />

      <div className="zp-in">
        {busy && !err && <div className="zp-spn" />}
        {switching && <LoadingGrid label="Loading episode" className="pointer-events-none absolute bottom-16 left-4 z-30 text-white/70" />}
        {(note || switching) && (
          <div className={cx('zp-toast', (note?.k ?? 'load') === 'err' && 'err', (note?.k ?? 'load') === 'ok' && 'ok')} role="status" aria-live="polite" key={note?.msg ?? 'sw'}>
            {(note?.k ?? 'load') === 'load' ? <Loader2 className="size-3.5 animate-spin shrink-0 text-white" /> : note?.k === 'ok' ? <CheckCircle2 /> : <TriangleAlert />}
            <span>{note?.msg ?? 'Switching stream…'}</span>
          </div>
        )}

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

        {held && (
          <div className="zp-hold">
            <FastForward />
            <span>{HOLD_RATE}×</span>
          </div>
        )}

        {fb && (
          <div key={fb.k} className={cx('zp-fb', fb.side < 0 ? 'l' : 'r')}>
            {fb.side < 0 ? <RotateCcw /> : <RotateCw />}
            <span>{fb.n} seconds</span>
          </div>
        )}

        {cue && (
          <div className="zp-sub" style={{ '--sp': `${cs.pos}%`, justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[cs.align] } as CSSProperties}>
            <span
              style={capCss(cs, 'var(--u)')}
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
              {audioTracks.length > 1 && (
                <button className="zp-b pill" data-tour="p-audio" onClick={() => setPop('aud')} title="Audio track" aria-label="Audio track">
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
                <button className="zp-b" data-tour="p-srv" onClick={() => setPop('srv')} aria-label="Servers" title="Servers">
                  <Server />
                </button>
              )}
              {onSelectEpisode && totalEpisodes > 1 && (
                <button className="zp-b" onClick={() => setSheet('eps')} aria-label="Episodes" title="Episodes">
                  <List />
                </button>
              )}
              <button
                className="zp-b"
                onClick={() => {
                  setReportSuccess(null)
                  setSheet('report')
                }}
                aria-label="Report Issue"
                title="Report playback or stream issue"
              >
                <Flag />
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
                  <i className="zp-pl" style={{ width: `${pct}%` }} />
                  {si && <i className="zp-seg" style={si} />}
                  {so && <i className="zp-seg" style={so} />}
                  <i className="zp-th" style={{ left: `${pct}%` }} />
                </div>
                <div className={cx('zp-tip', tipF != null && dur > 0 && 'on', pvRdy && 'rdy')} style={{ '--x': `${(tipF ?? 0) * 100}%` } as CSSProperties} aria-hidden="true">
                  <video
                    ref={pv}
                    className="zp-pv"
                    muted
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    tabIndex={-1}
                    onLoadedMetadata={pvGo}
                    onSeeked={() => {
                      setPvRdy(true)
                      pvGo()
                    }}
                  />
                  <b>{fmt((tipF ?? 0) * dur)}</b>
                </div>
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
              <span className="zp-flex" />
              <button className={cx('zp-b pill', pop === 'spd' && 'on')} onClick={() => setPop('spd')} aria-label="Playback speed" title="Playback speed">
                {speed}×
              </button>
              {levels.length > 0 && (
                <button className={cx('zp-b pill', pop === 'q' && 'on')} onClick={() => setPop('q')} aria-label="Quality" title="Quality">
                  {lvl === -1 ? 'Auto' : levels.find((l) => l.i === lvl)?.label}
                </button>
              )}
              <button className={cx('zp-b', (pop === 'cc' || (caps && tracks.length > 0)) && 'on')} data-tour="p-cc" onClick={() => setPop('cc')} aria-label="Subtitles" title="Subtitles [C]">
                <span className="zp-t">CC</span>
              </button>
              <button className="zp-b" data-tour="p-set" onClick={() => (setPopRaw(null), setSheet('set'))} aria-label="Settings" title="Settings">
                <Settings />
              </button>
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


        {pop && (
          <div className={cx('zp-pop', pop === 'cc' && 'zp-pop-cc')} role="menu" aria-label={pop}>
            {pop === 'spd' && (
              <>
                <p className="zp-ph">Speed</p>
                {SPEEDS.map((x) => (
                  <button key={x} className={cx('zp-row', speed === x && 'on')} onClick={() => (setRate(x), setPopRaw(null))}>
                    <span>{x === 1 ? 'Normal' : `${x}×`}</span>
                    {speed === x && <Check className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </>
            )}
            {pop === 'q' && (
              <>
                <p className="zp-ph">Quality</p>
                <button className={cx('zp-row', lvl === -1 && 'on')} onClick={() => (setQuality(-1), setPopRaw(null))}>
                  <span>Auto</span>
                  {lvl === -1 && <Check className="size-3.5 shrink-0" />}
                </button>
                {levels.map((l) => (
                  <button key={l.i} className={cx('zp-row', lvl === l.i && 'on')} onClick={() => (setQuality(l.i), setPopRaw(null))}>
                    <span>{l.label}</span>
                    {lvl === l.i && <Check className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </>
            )}
            {pop === 'aud' && (
              <>
                <p className="zp-ph">Audio</p>
                {audioTracks.map((t) => (
                  <button key={t.i} className={cx('zp-row', t.i === audioIdx && 'on')} onClick={() => (setAudioTrack(t), setPopRaw(null))}>
                    <span>{t.label}</span>
                    {t.i === audioIdx && <Check className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </>
            )}
            {pop === 'srv' && servers && (
              <>
                <p className="zp-ph">Servers</p>
                {onAudio && (
                  <div className="zp-two zp-pad">
                    {(['sub', 'dub'] as const).map((m) => (
                      <button key={m} className={cx('zp-pi', audioMode === m && 'on')} onClick={() => (flash('load', `Switching to ${m.toUpperCase()}…`), onAudio(m))}>
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
                {servers.map((x) => (
                  <button key={x.id} className={cx('zp-row', x.id === serverId && 'on')} onClick={() => (x.id !== serverId && flash('load', `Switching to ${x.name}…`), onServer?.(x.id), setPopRaw(null))}>
                    <span>{x.name}</span>
                    {x.id === serverId && <Check className="size-3.5 shrink-0" />}
                  </button>
                ))}
              </>
            )}
            {pop === 'cc' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between border-b border-white/10 px-2 py-1 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Languages className="size-3.5 text-white/70" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">Subtitles</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPopRaw(null)
                      setSheet('subs')
                    }}
                    title="Customize subtitle styling & sync"
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-white/50 hover:text-white transition"
                  >
                    <Settings className="size-3" />
                    <span>Settings</span>
                  </button>
                </div>

                {langs.length > 4 && (
                  <div className="relative my-1 px-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={subSearch}
                      onChange={(e) => setSubSearch(e.target.value)}
                      placeholder="Filter languages…"
                      aria-label="Filter languages"
                      className="h-7 w-full rounded-md border border-white/10 bg-white/5 pl-7 pr-6 text-xs text-white placeholder:text-white/40 outline-none transition focus:border-white/30"
                    />
                    {subSearch && (
                      <button
                        type="button"
                        onClick={() => setSubSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-white/40 hover:text-white"
                        aria-label="Clear filter"
                      >
                        <X className="size-2.5" />
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCaps(false)
                    setPopRaw(null)
                  }}
                  className={cx(
                    'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition',
                    !caps
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <span>Off</span>
                  {!caps && <Check className="size-3.5 text-white shrink-0" />}
                </button>

                {loadingSubs && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-white/50">
                    <Loader2 className="size-3 animate-spin text-[var(--a,#dc143c)]" />
                    <span>Searching for subtitles…</span>
                  </div>
                )}
                {!loadingSubs && tracks.length === 0 && srcLeft === 0 && (
                  <p className="px-2.5 py-1.5 text-xs text-white/50">No subtitles found.</p>
                )}
                {subErr && <p className="px-2.5 py-1 text-xs text-amber-400">{subErr}</p>}

                <div className="flex flex-col gap-0.5">
                  {filteredLangs.map(([name, list]) => {
                    const isSingle = list.length === 1
                    const isLangActive = caps && list.some((t) => t.id === trackId)
                    const isExpanded = grp === name

                    if (isSingle) {
                      const t = list[0]
                      const isSelected = caps && t.id === trackId
                      const subLabel = formatTrackSubLabel(t.label, name)
                      const displayName = subLabel !== 'Default' ? `${name} (${subLabel})` : name

                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            void pick(t)
                            setPopRaw(null)
                          }}
                          className={cx(
                            'group flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition',
                            isSelected
                              ? 'bg-white/10 text-white font-semibold'
                              : 'text-white/80 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="truncate text-xs">{displayName}</span>
                            {t.source && <span className="block text-[10px] text-white/40">{t.source}</span>}
                          </div>
                          {isSelected && <Check className="size-3.5 shrink-0 text-white" />}
                        </button>
                      )
                    }

                    return (
                      <div key={name} className="flex flex-col">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => setGrp(isExpanded ? null : name)}
                          className={cx(
                            'group flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition',
                            isLangActive
                              ? 'text-white font-semibold bg-white/5'
                              : 'text-white/80 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-xs">{name}</span>
                            <span className="text-[10px] text-white/40">({list.length})</span>
                            {isLangActive && (
                              <span className="size-1.5 rounded-full bg-[var(--a,#dc143c)] shrink-0" />
                            )}
                          </div>
                          <ChevronDown
                            className={cx(
                              'size-3.5 text-white/40 transition-transform duration-200 shrink-0',
                              isExpanded && 'rotate-180 text-white'
                            )}
                          />
                        </button>

                        {isExpanded && (
                          <div className="my-0.5 ml-3.5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                            {list.map((t) => {
                              const isSelected = caps && t.id === trackId
                              const subLabel = formatTrackSubLabel(t.label, name)
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    void pick(t)
                                    setPopRaw(null)
                                  }}
                                  className={cx(
                                    'group flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left transition',
                                    isSelected
                                      ? 'text-white font-semibold bg-white/10'
                                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                                  )}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate text-xs">{subLabel}</span>
                                      {isSelected && <span className="size-1 rounded-full bg-[var(--a,#dc143c)] shrink-0" />}
                                    </div>
                                    {t.source && (
                                      <span className="block text-[10px] text-white/40">
                                        {t.source}
                                      </span>
                                    )}
                                  </div>
                                  {isSelected && <Check className="size-3 shrink-0 text-white" />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {srcLeft > 0 && (
                  <p className="px-2.5 py-1 text-[10px] text-white/40">
                    Checking {srcLeft} more source{srcLeft > 1 ? 's' : ''}…
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {err && (
          <div className="zp-er">
            <p>This stream couldn't be loaded.</p>
            <div className="zp-two" style={{ pointerEvents: 'auto' }}>
              <button className="zp-b pill" onClick={() => setRetry((n) => n + 1)}>
                Try again
              </button>
              {servers && servers.length > 0 && (
                <button className="zp-b pill" onClick={() => setPopRaw('srv')}>
                  Switch server
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {sheet === 'subs' && (
        <Sheet title="Subtitles" onClose={() => setSheet(null)} target={target}>
          {/* Live Interactive Preview */}
          <div className="zp-prev relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-black/80 to-black/95 p-3 text-center">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-white/40 block mb-1.5">Live Preview</span>
            <div className="flex items-center justify-center min-h-[44px]">
              <span
                style={capCss(cs, '14px')}
              >
                I'm gonna be King of the Pirates!
              </span>
            </div>
          </div>

          <p className="zp-sec">Presets</p>
          <div className="zp-pg">
            {CAP_PRESETS.map(([n, v]) => (
              <button key={n} className="zp-pi" onClick={() => setCs({ ...CAP_DEFAULT, pos: cs.pos, ...v })}>
                {n}
              </button>
            ))}
          </div>

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

          <button className="zp-row" onClick={() => file.current?.click()}>
            <Upload />
            <span>Upload subtitle file</span>
          </button>
          <input ref={file} type="file" accept=".srt,.vtt,.txt" hidden onChange={uploadSub} />

          <h5 className="zp-grp">Text</h5>
          <p className="zp-sec">Font Family</p>
          <div className="zp-fg">
            {SUB_FONT_LIST.map(([k]) => (
              <button
                key={k}
                className={cx('zp-pi', cs.font === k && 'on')}
                style={{ fontFamily: SUB_FONTS[k] }}
                onClick={() => setCs({ font: k })}
              >
                {SUB_FONT_LABELS[k]}
              </button>
            ))}
          </div>

          <p className="zp-sec">Text size</p>
          <div className="zp-pg seg">
            {(Object.keys(SUB_SIZE) as (keyof typeof SUB_SIZE)[]).map((k) => (
              <button key={k} className={cx('zp-pi', cs.size === k && 'on')} onClick={() => setCs({ size: k })}>
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>

          <p className="zp-sec">Font Weight</p>
          <div className="zp-pg seg">
            {[
              { w: 400, label: 'Light' },
              { w: 500, label: 'Normal' },
              { w: 700, label: 'Bold' },
              { w: 900, label: 'Heavy' },
            ].map(({ w, label }) => (
              <button key={w} className={cx('zp-pi', cs.weight === w && 'on')} onClick={() => setCs({ weight: w })}>
                {label}
              </button>
            ))}
          </div>

          <p className="zp-sec">Text color</p>
          <div className="zp-pg">
            {swatch(CAP_COLORS, 'color')}
          </div>

          {slider('Text opacity', 'opacity', 20, 100, 5)}
          {slider('Line height', 'lh', 100, 200, 5)}

          <h5 className="zp-grp">Edge</h5>
          <p className="zp-sec">Text edge / Outline</p>
          <div className="zp-pg">
            {EDGE_KEYS.map((k) => (
              <button key={k} className={cx('zp-pi', cs.edge === k && 'on')} onClick={() => setCs({ edge: k })}>
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>

          <p className="zp-sec">Edge color</p>
          <div className="zp-pg">{swatch(EDGE_COLORS, 'edgeColor')}</div>

          <h5 className="zp-grp">Background</h5>
          <p className="zp-sec">Background style</p>
          <div className="zp-pg">
            {(Object.keys(CAP_BOX) as (keyof typeof CAP_BOX)[]).map((k) => (
              <button key={k} className={cx('zp-pi', cs.boxStyle === k && 'on')} onClick={() => setCs({ boxStyle: k })}>
                {CAP_BOX[k]}
              </button>
            ))}
          </div>

          {cs.boxStyle !== 'none' && (
            <>
              <p className="zp-sec">Background opacity ({cs.bg}%)</p>
              <input
                type="range" className="zp-rg" min={0} max={100} step={5} value={cs.bg}
                style={{ '--p': `${cs.bg}%` } as CSSProperties}
                onChange={(e) => setCs({ bg: +e.target.value })}
                aria-label="Caption background opacity"
              />
            </>
          )}

          {cs.boxStyle !== 'none' && (
            <>
              <p className="zp-sec">Background color</p>
              <div className="zp-pg">{swatch(BG_COLORS, 'bgColor')}</div>
              {slider('Background blur', 'blur', 0, 20, 1, 'px')}
            </>
          )}

          <p className="zp-sec">Style</p>
          <div className="zp-pg">
            <button className={cx('zp-pi', cs.italic && 'on')} onClick={() => setCs({ italic: !cs.italic })}>Italic</button>
            <button className={cx('zp-pi', cs.upper && 'on')} onClick={() => setCs({ upper: !cs.upper })}>UPPERCASE</button>
          </div>

          <p className="zp-sec">Size fine-tune ({cs.scale}%)</p>
          <input
            type="range" className="zp-rg" min={50} max={200} step={5} value={cs.scale}
            style={{ '--p': `${((cs.scale - 50) / 150) * 100}%` } as CSSProperties}
            onChange={(e) => setCs({ scale: +e.target.value })}
            aria-label="Caption size fine-tune"
          />

          <p className="zp-sec">Letter Spacing</p>
          <div className="zp-pg seg">
            {[
              { id: 'tight', label: 'Tight' },
              { id: 'normal', label: 'Normal' },
              { id: 'wide', label: 'Wide' },
            ].map(({ id, label }) => (
              <button key={id} className={cx('zp-pi', cs.spacing === id && 'on')} onClick={() => setCs({ spacing: id as any })}>
                {label}
              </button>
            ))}
          </div>

          <h5 className="zp-grp">Position</h5>
          <p className="zp-sec">Alignment</p>
          <div className="zp-pg seg">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} className={cx('zp-pi', cs.align === a && 'on')} onClick={() => setCs({ align: a })}>
                {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
          {slider('Max width', 'width', 30, 100, 5)}

          <p className="zp-sec">Vertical position ({cs.pos}% up from bottom)</p>
          <input
            type="range" className="zp-rg" min={0} max={70} step={5} value={cs.pos}
            style={{ '--p': `${(cs.pos / 70) * 100}%` } as CSSProperties}
            onChange={(e) => setCs({ pos: +e.target.value })}
            aria-label="Caption vertical position"
          />

          <button className="zp-pi" style={{ marginTop: '8px' }} onClick={() => setCs(CAP_DEFAULT)}>
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

      {sheet === 'set' && (
        <Sheet title="Settings" onClose={() => setSheet(null)} target={target}>
          <p className="zp-sec">4K upscaler (GPU)</p>
          <button className="zp-row" disabled={!gpuSupported} onClick={() => { setUpErr(null); setUp(!up); }}>
            <span>Anime4K WebGPU upscaling</span>
            <i className={cx('zp-tg', up && 'on')} />
          </button>
          {up && (
            <>
              <p className="zp-sec">Anime4K Model / Shader Preset</p>
              <div className="zp-pg">
                {ANIME4K_MODES.map((m) => (
                  <button
                    key={m.id}
                    className={cx('zp-pi', upMode === m.id && 'on')}
                    onClick={() => setUpMode(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="zp-note" style={{ marginTop: '4px' }}>
                {ANIME4K_MODES.find((m) => m.id === upMode)?.desc}
              </p>

              <p className="zp-sec">Upscale Intensity ({upInt}%)</p>
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
                ? `Upscaler note: ${upErr}. Try selecting another preset or re-toggling.`
                : 'Runs in real-time on your GPU with WebGPU neural shaders. Best on 720p–1080p anime.'}
          </p>

          <p className="zp-sec">Visual Enhancements &amp; Shaders</p>
          <div className="zp-pg">
            {[
              { id: 'off', label: 'Default' },
              { id: 'vibrant', label: 'Vibrance' },
              { id: 'cinema', label: 'Cinema HDR' },
              { id: 'sharp', label: 'Crisp Lines' },
              { id: 'warm', label: 'Warm (Eye Care)' },
            ].map(({ id, label }) => (
              <button
                key={id}
                className={cx('zp-pi', vfx.preset === id && 'on')}
                onClick={() => setVfx({ preset: id as VideoFilterPreset })}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="zp-sec">Brightness ({vfx.brightness}%)</p>
          <input
            type="range" className="zp-rg" min={70} max={130} step={2} value={vfx.brightness}
            style={{ '--p': `${((vfx.brightness - 70) / (130 - 70)) * 100}%` } as CSSProperties}
            onChange={(e) => setVfx({ brightness: +e.target.value })}
            aria-label="Video brightness"
          />

          <p className="zp-sec">Contrast ({vfx.contrast}%)</p>
          <input
            type="range" className="zp-rg" min={70} max={140} step={2} value={vfx.contrast}
            style={{ '--p': `${((vfx.contrast - 70) / (140 - 70)) * 100}%` } as CSSProperties}
            onChange={(e) => setVfx({ contrast: +e.target.value })}
            aria-label="Video contrast"
          />

          <p className="zp-sec">Color Saturation ({vfx.saturation}%)</p>
          <input
            type="range" className="zp-rg" min={70} max={160} step={5} value={vfx.saturation}
            style={{ '--p': `${((vfx.saturation - 70) / (160 - 70)) * 100}%` } as CSSProperties}
            onChange={(e) => setVfx({ saturation: +e.target.value })}
            aria-label="Video saturation"
          />

          {(vfx.preset !== 'off' || vfx.brightness !== 100 || vfx.contrast !== 100 || vfx.saturation !== 100) && (
            <button
              className="zp-pi"
              style={{ marginTop: '8px' }}
              onClick={() => setVfx(VIDEO_FILTER_DEFAULTS)}
            >
              Reset visual shaders
            </button>
          )}

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

      {sheet === 'eps' && onSelectEpisode && (
        <Sheet title="Episodes" onClose={() => setSheet(null)} target={target} className="zp-sh-wide" bodyClassName="zp-sh-b-eps">
          <Episodes
            total={totalEpisodes}
            available={avail}
            current={episode}
            episodesInfo={episodesInfo}
            fallbackImg={fallbackImg}
            defaultRuntime={defaultRuntime}
            kinds={kinds}
            onPick={(n) => {
              onSelectEpisode(n)
              setSheet(null)
            }}
          />
        </Sheet>
      )}

      {sheet === 'report' && (
        <Sheet title="Report Stream Issue" onClose={() => setSheet(null)} target={target}>
          {reportSuccess ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div style={{ display: 'grid', placeItems: 'center', width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <CheckCircle2 style={{ width: '28px', height: '28px' }} />
              </div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '6px' }}>Report Submitted</h4>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', maxWidth: '280px', margin: '0 auto 16px' }}>
                Thank you! Issue #{reportSuccess.slice(0, 8)} has been logged. Our curators have been alerted.
              </p>
              <button
                className="zp-b pill"
                style={{ margin: '0 auto', background: 'var(--accent)', color: 'white', padding: '8px 24px' }}
                onClick={() => setSheet(null)}
              >
                Done
              </button>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setReportSubmitting(true)
                try {
                  const sName = servers?.find((s) => s.id === serverId)?.name ?? serverId ?? 'Auto'
                  const res = await submitStreamReport({
                    anime_id: animeId ? String(animeId) : undefined,
                    anime_title: title || 'Anime Episode',
                    episode: String(episode || '1'),
                    server: sName,
                    audio_type: audioMode,
                    issue_type: reportIssue,
                    details: reportDetails.trim() || undefined,
                    playback_time: fmt(shown),
                  })
                  if (res.success && res.id) {
                    setReportSuccess(res.id)
                    toast('Report submitted successfully! Thank you.', 'info')
                  } else {
                    toast(res.error || 'Failed to submit report', 'error')
                  }
                } finally {
                  setReportSubmitting(false)
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px' }}
            >
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', fontSize: '11px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.4' }}>
                <div><strong>Anime:</strong> {title}</div>
                <div><strong>Episode:</strong> {episode} &bull; <strong>Server:</strong> {servers?.find((s) => s.id === serverId)?.name ?? serverId ?? 'Auto'} &bull; <strong>Audio:</strong> {audioMode.toUpperCase()} &bull; <strong>Time:</strong> {fmt(shown)}</div>
              </div>

              <div>
                <p className="zp-sec" style={{ margin: '0 0 6px' }}>Select Issue Type</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {[
                    'Broken / Won\'t Play',
                    'Audio Desync',
                    'Wrong Episode',
                    'Missing Subtitles',
                    'Buffering / Lag',
                    'Other Problem',
                  ].map((iss) => (
                    <button
                      type="button"
                      key={iss}
                      className={cx('zp-pi', reportIssue === iss && 'on')}
                      style={{ fontSize: '11px', padding: '8px 6px', textAlign: 'center', height: 'auto' }}
                      onClick={() => setReportIssue(iss)}
                    >
                      {iss}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="zp-sec" style={{ margin: '0 0 6px' }}>Additional Details (Optional)</p>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="e.g. Audio is 2 seconds ahead after the intro..."
                  style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', color: 'white', padding: '8px', fontSize: '11px', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="zp-b pill"
                  onClick={() => setSheet(null)}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="zp-b pill"
                  style={{ background: 'var(--accent)', color: 'white', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold' }}
                >
                  {reportSubmitting ? 'Sending...' : 'Send Report'}
                </button>
              </div>
            </form>
          )}
        </Sheet>
      )}
    </div>
  )
}
