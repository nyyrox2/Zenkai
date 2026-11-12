import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isPlayerPath } from '../lib/sections'

const ZONE = '12249470'
const SRC = 'https://n6wxm.com/vignette.min.js'
const ID = 'zk-ad-tag'

/** Paths where the ad tag must never run: video / manga / novel players, watch party, calls, chats, API docs. */
const blocked = (p: string) =>
  isPlayerPath(p) ||
  p === '/call' || p.startsWith('/watchparty') || p.startsWith('/watchtogether') ||
  p.startsWith('/messages') || p === '/api' || p.startsWith('/api') || p === '/docs'

/** Loads the Monetag tag on browsing pages only. It is added when you are on a normal page and removed when you open a player. */
export function AdTag() {
  const { pathname } = useLocation()
  const off = blocked(pathname)

  useEffect(() => {
    const existing = document.getElementById(ID)
    if (off) {
      existing?.remove()
      return
    }
    if (existing) return
    const s = document.createElement('script')
    s.id = ID
    s.dataset.zone = ZONE
    s.src = SRC
    ;(document.body || document.documentElement).appendChild(s)
  }, [off])

  return null
}
