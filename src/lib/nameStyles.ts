import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface NameStyle { effect: string; font: string; color: string | null }

const TTL = 5 * 60_000
const cache = new Map<string, { at: number; s: NameStyle | null }>()
let fontColumn = true
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)

async function fetchStyles(ids: string[]): Promise<Record<string, NameStyle>> {
  const out: Record<string, NameStyle> = {}
  const base = 'id, name_color, equipped_text_effect'
  const q = (cols: string) => supabase.from('profiles').select(cols as any).in('id', ids) as unknown as PromiseLike<{ data: any[] | null; error: unknown }>
  let res = await q(fontColumn ? `${base}, equipped_font_style` : base)
  if (res.error && fontColumn) {
    fontColumn = false
    res = await q(base)
  }
  for (const r of res.data || []) {
    out[r.id] = { effect: r.equipped_text_effect || 'none', font: r.equipped_font_style || 'default', color: r.name_color && r.name_color !== 'default' ? r.name_color : null }
  }
  return out
}

/** Equipped name effect / font / colour for each user id (guest ids are skipped). Fetched once per TTL, new ids in one batch. */
export function useNameStyles(userIds: (string | undefined)[]): Record<string, NameStyle> {
  const [, bump] = useState(0)
  const key = [...new Set(userIds.filter((x): x is string => !!x && isUuid(x)))].sort().join(',')
  useEffect(() => {
    const now = Date.now()
    const ids = key.split(',').filter((id) => id && (!cache.get(id) || now - cache.get(id)!.at > TTL))
    if (!ids.length) return
    ids.forEach((id) => cache.set(id, { at: now, s: cache.get(id)?.s ?? null }))
    void fetchStyles(ids)
      .then((got) => {
        ids.forEach((id) => cache.set(id, { at: Date.now(), s: got[id] ?? cache.get(id)?.s ?? null }))
        bump((n) => n + 1)
      })
      .catch(() => ids.forEach((id) => cache.delete(id)))
  }, [key])
  const map: Record<string, NameStyle> = {}
  cache.forEach((c, id) => { if (c.s) map[id] = c.s })
  return map
}
