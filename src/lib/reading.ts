import { useSyncExternalStore } from 'react'

/**
 * Local-only reading library for novels and manga: "continue reading" shelf + reader preferences.
 * Same approach as lib/library.ts — plain localStorage, shared across tabs, memory fallback when blocked.
 */
export type ReadKind = 'novel' | 'manga'

export interface ReadingItem {
  kind: ReadKind
  /** novel: `${source}:${slug}`; manga: worker id */
  id: string
  title: string
  cover: string
  /** link to the details page */
  href: string
  /** link that resumes reading */
  resume: string
  /** human label, e.g. "Chapter 12" */
  label: string
  /** 0..1 within the chapter */
  progress: number
  t: number
}

const KEY = 'zk:reading:v1'
const MAX = 30

let mem: ReadingItem[] | null = null
let raw: string | null | undefined
let snap: ReadingItem[] = []
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())

function read(): ReadingItem[] {
  if (mem) return mem
  let r: string | null = null
  try {
    r = localStorage.getItem(KEY)
  } catch {
    mem = []
    return mem
  }
  if (r === raw) return snap
  raw = r
  try {
    const parsed = r ? (JSON.parse(r) as ReadingItem[]) : []
    snap = Array.isArray(parsed) ? parsed : []
  } catch {
    snap = []
  }
  return snap
}

function write(next: ReadingItem[]) {
  snap = next
  try {
    const s = JSON.stringify(next)
    localStorage.setItem(KEY, s)
    raw = s
  } catch {
    mem = next
  }
  notify()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) notify()
  })
}

export function saveReading(item: Omit<ReadingItem, 't'>) {
  const rest = read().filter((x) => !(x.kind === item.kind && x.id === item.id))
  write([{ ...item, t: Date.now() }, ...rest].slice(0, MAX))
}

export function removeReading(kind: ReadKind, id: string) {
  write(read().filter((x) => !(x.kind === kind && x.id === id)))
}

export function getReading(kind: ReadKind, id: string): ReadingItem | undefined {
  return read().find((x) => x.kind === kind && x.id === id)
}

export function useReading(kind?: ReadKind): ReadingItem[] {
  const all = useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    read,
    () => [],
  )
  return kind ? all.filter((x) => x.kind === kind) : all
}

/* ---------------- reader preferences ---------------- */
export interface NovelPrefs {
  theme: 'dark' | 'sepia' | 'light' | 'black'
  font: 'serif' | 'sans'
  size: number // px
  line: number // line-height
  width: 'narrow' | 'normal' | 'wide'
}
export interface MangaPrefs {
  mode: 'webtoon' | 'ltr' | 'rtl'
  fit: 'width' | 'height' | 'original'
  bg: 'black' | 'dark' | 'light' | 'sepia'
  /** page dimming, 40..100 (%) */
  brightness: number
  /** webtoon column width */
  width: 'narrow' | 'medium' | 'wide' | 'full'
  /** space between pages in webtoon mode */
  gap: 'none' | 'small' | 'large'
  /** tap the screen edges to turn pages (paged modes) */
  tapZones: boolean
  /** swap which edge goes forward */
  invertTap: boolean
  /** show info/progress bar */
  infoBar: boolean
  /** show a small page counter while the bars are hidden */
  pageBadge: boolean
  /** keep the screen on while reading */
  keepAwake: boolean
  /** go to the next chapter by itself at the end (paged modes) */
  autoNext: boolean
  /** auto scroll speed in webtoon mode, 1..10 */
  autoSpeed: number
  /** seconds per page for auto page turning in paged modes, 2..30 */
  autoSecs: number
  /** greyscale pages */
  grayscale: boolean
}

export const DEFAULT_NOVEL: NovelPrefs = { theme: 'dark', font: 'serif', size: 19, line: 1.85, width: 'normal' }
export const DEFAULT_MANGA: MangaPrefs = {
  mode: 'webtoon',
  fit: 'width',
  bg: 'black',
  brightness: 100,
  width: 'medium',
  gap: 'none',
  tapZones: true,
  invertTap: false,
  infoBar: true,
  pageBadge: true,
  keepAwake: false,
  autoNext: false,
  autoSpeed: 4,
  autoSecs: 8,
  grayscale: false,
}

export function loadPrefs<T extends object>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...fallback, ...(JSON.parse(v) as Partial<T>) } : fallback
  } catch {
    return fallback
  }
}
export function savePrefs<T>(key: string, v: T) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* blocked storage: preference lasts for this session only */
  }
}
