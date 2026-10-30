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
  const arr = isArr(raw, emptyHistory)
  const seen = new Set<number>()
  const deduped: HistoryItem[] = []
  const sorted = arr.slice().sort((a, b) => (Number(b.t) || 0) - (Number(a.t) || 0))
  for (const item of sorted) {
    const id = Number(item.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    deduped.push({ ...item, id })
  }
  return deduped
}
export const useList = () => {
  const raw = useSyncExternalStore(list.subscribe, list.get)
  const arr = isArr(raw, emptyList)
  const seen = new Set<number>()
  const deduped: ListItem[] = []
  const sorted = arr.slice().sort((a, b) => (Number(b.updatedAt ?? b.addedAt) || 0) - (Number(a.updatedAt ?? a.addedAt) || 0))
  for (const item of sorted) {
    const id = Number(item.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    deduped.push({ ...item, id })
  }
  return deduped
}
export const useListItem = (id: number) => {
  const nid = Number(id)
  return useList().find((i) => Number(i.id) === nid)
}

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
export const getHistory = (id: number) => {
  const nid = Number(id)
  return hist().find((h) => Number(h.id) === nid)
}

/** Record what is being watched. Moving to another episode resets the position. */
export function touchHistory(m: Meta, p: { ep: number; server: string; audio: Audio; pos?: number; dur?: number }) {
  const mid = Number(m.id)
  const all = hist().filter((h) => Number(h.id) !== mid)
  const old = getHistory(mid)
  const same = old?.ep === p.ep
  const next: HistoryItem = {
    ...meta(m),
    id: mid,
    ep: p.ep,
    server: p.server,
    audio: p.audio,
    pos: p.pos ?? (same ? old?.pos ?? 0 : 0),
    dur: p.dur ?? (same ? old?.dur ?? 0 : 0),
    t: Date.now(),
  }
  // Newly touched/watched anime is immediately at index 0
  history.set([next, ...all].slice(0, MAX_HISTORY))

  // Update watchlist & sync to AniList
  const li = items().find((i) => Number(i.id) === mid)
  const total = m.episodes ?? 0
  const isDone = next.dur > 0 && next.pos / next.dur >= 0.85
  const status: ListStatus = isDone && total > 0 && p.ep >= total ? 'completed' : 'watching'
  const curProg = li?.progress ?? 0
  const progress = Math.max(curProg, p.ep)

  const needUpdate = !li || li.status !== status || progress > curProg
  if (needUpdate) {
    const now = Date.now()
    const updatedItem: ListItem = {
      ...(li ?? meta(m)),
      id: mid,
      status,
      progress,
      addedAt: li?.addedAt ?? now,
      updatedAt: now,
    }
    list.set([updatedItem, ...items().filter((i) => Number(i.id) !== mid)])
    syncHooks.push?.(mid, { status, progress, label: `${m.title} · ep ${p.ep}` })
  }
}

export function removeHistory(id: number) {
  const nid = Number(id)
  history.set(hist().filter((h) => Number(h.id) !== nid))
}

/** Episode finished: queue up the next one, or finish the series. */
export function finishEpisode(m: Meta, ep: number, hasNext: boolean) {
  const mid = Number(m.id)
  const all = hist().filter((h) => Number(h.id) !== mid)
  const old = getHistory(mid)
  const nextEp = hasNext ? ep + 1 : ep
  const dur = old?.dur || 1440
  const p = getPrefs()
  const nextItem: HistoryItem = {
    ...meta(m),
    id: mid,
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
  const mid = Number(m.id)
  const li = items().find((i) => Number(i.id) === mid)
  const total = m.episodes ?? 0
  const done = last || (total > 0 && ep >= total)
  const status: ListStatus = done ? 'completed' : 'watching'
  const progress = done && total > 0 ? total : Math.max(li?.progress ?? 0, ep)
  const now = Date.now()
  const updatedItem: ListItem = {
    ...(li ?? meta(m)),
    id: mid,
    status,
    progress,
    addedAt: li?.addedAt ?? now,
    updatedAt: now,
  }
  list.set([updatedItem, ...items().filter((i) => Number(i.id) !== mid)])
  syncHooks.push?.(mid, { status, progress, label: `${m.title} · ep ${ep}` })
}

/* ---------- watchlist ---------- */
export function addToList(m: Meta, status: ListStatus = 'planning') {
  const mid = Number(m.id)
  if (items().some((i) => Number(i.id) === mid)) return
  const now = Date.now()
  list.set([{ ...meta(m), id: mid, status, addedAt: now, updatedAt: now }, ...items()])
  syncHooks.push?.(mid, { status, progress: 0 })
}
export function removeFromList(id: number) {
  const mid = Number(id)
  list.set(items().filter((i) => Number(i.id) !== mid))
  syncHooks.remove?.(mid)
}
export function setStatus(id: number, status: ListStatus) {
  const mid = Number(id)
  const li = items().find((i) => Number(i.id) === mid)
  if (!li || li.status === status) return
  const progress = status === 'completed' && li.episodes ? li.episodes : li.progress
  const rest = items().filter((i) => Number(i.id) !== mid)
  list.set([{ ...li, id: mid, status, progress, updatedAt: Date.now() }, ...rest])
  syncHooks.push?.(mid, { status, progress })
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
  const byId = new Map(cur.map((i) => [Number(i.id), i]))
  for (const e of entries) {
    const eid = Number(e.meta.id)
    const old = byId.get(eid)
    byId.set(eid, {
      ...meta(e.meta),
      id: eid,
      status: e.status,
      progress: e.progress,
      addedAt: old?.addedAt ?? e.updated,
      updatedAt: Math.max(old?.updatedAt ?? 0, e.updated || 0),
    })
  }
  list.set([...byId.values()].sort((a, b) => (Number(b.updatedAt ?? b.addedAt) || 0) - (Number(a.updatedAt ?? a.addedAt) || 0)))

  const h = new Map(hist().map((x) => [Number(x.id), x]))
  for (const e of entries) {
    const eid = Number(e.meta.id)
    if (e.status === 'completed' || e.status === 'dropped') {
      const total = e.meta.episodes ?? 0
      if (e.status === 'dropped' || (total > 0 && (e.progress ?? 0) >= total)) {
        h.delete(eid)
      }
    } else if (e.status === 'watching') {
      const next = (e.progress ?? 0) + 1
      const total = e.meta.episodes ?? 0
      const old = h.get(eid)
      if (total > 0 && next > total) continue
      // Ensure remote timestamp is never set to the current time so freshly watched shows stay first
      const remoteT = Math.min(Number(e.updated) || 1, Date.now() - 1000)
      if (!old) {
        h.set(eid, {
          ...meta(e.meta),
          id: eid,
          ep: next,
          server: server,
          audio: audio,
          pos: 0,
          dur: 0,
          t: remoteT,
        })
      } else if (old.ep < next) {
        // Newer episode tracked on AniList
        h.set(eid, {
          ...old,
          ...meta(e.meta),
          id: eid,
          ep: next,
          pos: 0,
          dur: 0,
          t: Math.max(old.t ?? 0, remoteT),
        })
      }
      // If old exists and old.ep >= next, leave it untouched so local watch time and position stay first!
    }
  }
  history.set([...h.values()].sort((a, b) => (Number(b.t) || 0) - (Number(a.t) || 0)).slice(0, MAX_HISTORY))
}
export function toggleList(m: Meta) {
  const mid = Number(m.id)
  if (items().some((i) => Number(i.id) === mid)) removeFromList(mid)
  else addToList(m)
}
