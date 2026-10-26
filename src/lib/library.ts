import { useSyncExternalStore } from 'react'
import type { CardItem } from '../types/anime'

/**
 * Local-only library: continue-watching history, the watchlist and the last-used player prefs.
 * Everything lives in localStorage (no account) and is shared across tabs via the `storage` event.
 */
export type Meta = Pick<CardItem, 'id' | 'title' | 'image' | 'color' | 'score' | 'format' | 'episodes' | 'year'>
export type Audio = 'sub' | 'dub'
export type ListStatus = 'watching' | 'planning' | 'completed' | 'paused' | 'dropped'

export interface HistoryItem extends Meta {
  ep: number
  server: string
  audio: Audio
  /** seconds into `ep` and its length (0 when unknown, e.g. iframe servers) */
  pos: number
  dur: number
  /** last watched, ms */
  t: number
}
export interface ListItem extends Meta {
  status: ListStatus
  addedAt: number
  updatedAt?: number
  /** episodes watched (kept in step with AniList when connected) */
  progress?: number
}
export interface Prefs {
  server?: string
  audio?: Audio
}

export const STATUS_LABEL: Record<ListStatus, string> = { watching: 'Watching', planning: 'Plan to watch', completed: 'Completed', paused: 'On hold', dropped: 'Dropped' }
const MAX_HISTORY = 100

/** Filled in by lib/anilist.ts (avoids an import cycle): local changes are mirrored to AniList through these. */
export interface SyncPatch {
  status?: ListStatus
  progress?: number
  label?: string
}
export const syncHooks: { active?: () => boolean; push?: (id: number, p: SyncPatch) => void; remove?: (id: number) => void } = {}

/** A tiny observable localStorage cell. Snapshots are cached so useSyncExternalStore stays stable. */
export function cell<T>(key: string, empty: T) {
  let raw: string | null | undefined
  let val = empty
  let memOnly = false // storage blocked (private mode): keep working in memory
  const subs = new Set<() => void>()
  const notify = () => subs.forEach((f) => f())

  const get = (): T => {
    if (memOnly) return val
    let r: string | null = null
    try {
      r = localStorage.getItem(key)
    } catch {
      memOnly = true
      return val
    }
    if (r !== raw) {
      raw = r
      try {
        val = r ? (JSON.parse(r) as T) : empty
      } catch {
        val = empty // corrupt value: start clean instead of crashing the app
      }
    }
    return val
  }
  const set = (v: T) => {
    val = v
    try {
      raw = JSON.stringify(v)
      localStorage.setItem(key, raw)
    } catch {
      memOnly = true
    }
    notify()
  }
  const subscribe = (f: () => void) => {
    subs.add(f)
    const onStorage = (e: StorageEvent) => e.key === key && notify()
    window.addEventListener('storage', onStorage)
    return () => {
      subs.delete(f)
      window.removeEventListener('storage', onStorage)
    }
  }
  return { get, set, subscribe }
}

const emptyHistory: HistoryItem[] = []
const emptyList: ListItem[] = []
const history = cell<HistoryItem[]>('zk:history', emptyHistory)
const list = cell<ListItem[]>('zk:list', emptyList)
const prefs = cell<Prefs>('zk:prefs', {})

export const useHistory = () => {
  const raw = useSyncExternalStore(history.subscribe, history.get)
  return isArr(raw, emptyHistory).slice().sort((a, b) => (b.t ?? 0) - (a.t ?? 0))
}
export const useList = () => {
  const raw = useSyncExternalStore(list.subscribe, list.get)
  return isArr(raw, emptyList).slice().sort((a, b) => (b.updatedAt ?? b.addedAt ?? 0) - (a.updatedAt ?? a.addedAt ?? 0))
}
export const useListItem = (id: number) => useList().find((i) => i.id === id)

const isArr = <T,>(v: unknown, empty: T[]): T[] => (Array.isArray(v) ? (v as T[]) : empty)
const hist = () => isArr(history.get(), emptyHistory)
const items = () => isArr(list.get(), emptyList)

export const meta = (c: Meta): Meta => ({ id: c.id, title: c.title, image: c.image, color: c.color ?? null, score: c.score, format: c.format ?? null, episodes: c.episodes ?? null, year: c.year ?? null })

/* ---------- prefs ---------- */
export const getPrefs = (): Prefs => prefs.get()
export function savePrefs(p: Prefs) {
  const cur = prefs.get()
  if (p.server === cur.server && p.audio === cur.audio) return
  prefs.set({ ...cur, ...p })
}

/* ---------- history ---------- */
export const getHistory = (id: number) => hist().find((h) => h.id === id)

/** Record what is being watched. Moving to another episode resets the position. */
export function touchHistory(m: Meta, p: { ep: number; server: string; audio: Audio; pos?: number; dur?: number }) {
  const all = hist().filter((h) => h.id !== m.id)
  const old = getHistory(m.id)
  const same = old?.ep === p.ep
  const next: HistoryItem = {
    ...meta(m),
    ep: p.ep,
    server: p.server,
    audio: p.audio,
    pos: p.pos ?? (same ? old?.pos ?? 0 : 0),
    dur: p.dur ?? (same ? old?.dur ?? 0 : 0),
    t: Date.now(),
  }
  history.set([next, ...all].slice(0, MAX_HISTORY))
  // watched far enough (direct servers) → count the episode
  if (next.dur > 0 && next.pos / next.dur >= 0.85) markProgress(m, p.ep)
  // moved on to the very next episode on a server that reports no position (iframes) → the previous one was watched
  else if (old && old.ep + 1 === p.ep && old.dur === 0) markProgress(m, old.ep)
  // starting something from the watchlist moves it to "Watching"
  const li = items().find((i) => i.id === m.id)
  if (li && li.status === 'planning') setStatus(m.id, 'watching')
  else markProgress(m, p.ep)
}

export function removeHistory(id: number) {
  history.set(hist().filter((h) => h.id !== id))
}

/** Episode finished: queue up the next one, or finish the series. */
export function finishEpisode(m: Meta, ep: number, hasNext: boolean) {
  const all = hist().filter((h) => h.id !== m.id)
  const old = getHistory(m.id)
  const nextEp = hasNext ? ep + 1 : ep
  const dur = old?.dur || 1440
  const p = getPrefs()
  const nextItem: HistoryItem = {
    ...meta(m),
    server: old?.server ?? p.server ?? 'flixcloud',
    audio: old?.audio ?? p.audio ?? 'sub',
    ...old,
    ep: nextEp,
    pos: hasNext ? 0 : dur,
    dur: dur,
    t: Date.now(),
  }
  history.set([nextItem, ...all].slice(0, MAX_HISTORY))
  markProgress(m, ep, !hasNext)
}

/** An episode counts as watched: update the list entry (and AniList). Never moves progress backwards. */
export function markProgress(m: Meta, ep: number, last = false) {
  const li = items().find((i) => i.id === m.id)
  if (li && (li.progress ?? 0) >= ep && !last) return
  if (li?.status === 'completed' && !last) return // re-watching a finished show: leave it alone
  const total = m.episodes ?? 0
  const done = last || (total > 0 && ep >= total)
  const status: ListStatus = done ? 'completed' : 'watching'
  const progress = done && total > 0 ? total : ep
  const now = Date.now()
  if (li) list.set([{ ...li, status, progress, updatedAt: now }, ...items().filter((i) => i.id !== m.id)])
  else list.set([{ ...meta(m), status, progress, addedAt: now, updatedAt: now }, ...items()])
  syncHooks.push?.(m.id, { status, progress, label: `${m.title} · ep ${ep}` })
}

/* ---------- watchlist ---------- */
export function addToList(m: Meta, status: ListStatus = 'planning') {
  if (items().some((i) => i.id === m.id)) return
  const now = Date.now()
  list.set([{ ...meta(m), status, addedAt: now, updatedAt: now }, ...items()])
  syncHooks.push?.(m.id, { status })
}
export function removeFromList(id: number) {
  list.set(items().filter((i) => i.id !== id))
  syncHooks.remove?.(id)
}
export function setStatus(id: number, status: ListStatus) {
  const li = items().find((i) => i.id === id)
  if (!li || li.status === status) return
  const progress = status === 'completed' && li.episodes ? li.episodes : li.progress
  const rest = items().filter((i) => i.id !== id)
  list.set([{ ...li, status, progress, updatedAt: Date.now() }, ...rest])
  syncHooks.push?.(id, { status })
}

/* ---------- AniList pull (no hooks, so nothing is pushed back) ---------- */
export interface RemoteEntry {
  meta: Meta
  status: ListStatus
  progress: number
  /** last changed on AniList, ms */
  updated: number
}

/** Merge the AniList list in: statuses and progress follow AniList; "Watching" shows are queued in Continue Watching at the next episode. */
export function applyRemote(entries: RemoteEntry[], server: string, audio: Audio) {
  const cur = items()
  const byId = new Map(cur.map((i) => [i.id, i]))
  for (const e of entries) {
    const old = byId.get(e.meta.id)
    byId.set(e.meta.id, { ...meta(e.meta), status: e.status, progress: e.progress, addedAt: old?.addedAt ?? e.updated, updatedAt: e.updated })
  }
  list.set([...byId.values()].sort((a, b) => (b.updatedAt ?? b.addedAt ?? 0) - (a.updatedAt ?? a.addedAt ?? 0)))

  const h = new Map(hist().map((x) => [x.id, x]))
  for (const e of entries) {
    if (e.status === 'completed' || e.status === 'dropped') h.delete(e.meta.id)
    else if (e.status === 'watching') {
      const next = e.progress + 1
      const total = e.meta.episodes ?? 0
      const old = h.get(e.meta.id)
      if (total > 0 && next > total) continue
      if (!old || old.ep < next) h.set(e.meta.id, { ...meta(e.meta), ep: next, server: old?.server ?? server, audio: old?.audio ?? audio, pos: 0, dur: 0, t: e.updated })
    }
  }
  history.set([...h.values()].sort((a, b) => b.t - a.t).slice(0, MAX_HISTORY))
}
export function toggleList(m: Meta) {
  if (items().some((i) => i.id === m.id)) removeFromList(m.id)
  else addToList(m)
}
