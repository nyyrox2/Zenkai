import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../lib/profile'
import { toast } from '../lib/toast'
import { makeDriftCheck } from '../lib/partySync'
import {
  WatchTogetherRoom,
  generateWatchRoomId,
  type PeerMember,
  type WatchChatMessage,
  type WatchReaction,
} from '../lib/webrtcWatchTogether'
import {
  createWatchRoom,
  deleteWatchRoom,
  getMyHostIdentifier,
  getWatchRoom,
  movieRoomOf,
  movieRoomPath,
  movieServerTag,
  packEp,
  touchWatchRoom,
  unpackEp,
  updateWatchRoom,
} from '../lib/watchRooms'

type Cur = { s: number; e: number; p: string }
type Patch = Partial<Cur> & { d?: string }
type Control = { action: 'play' | 'pause' | 'seek'; time: number; token: number }

/** Watch Together for movies / TV: same room engine as anime, rooms stored in the existing watch_rooms table (see watchRooms.ts). */
export function useMovieParty(o: {
  type: 'movie' | 'tv'
  id: number
  title: string
  season: number
  episode: number
  provider: string
  /** selected audio version (MovieBox dub id), if the server has several */
  dub?: string | null
  roomParam: string | null
  setRoomParam: (r: string | null) => void
  /** the host changed season / episode / server: apply it here */
  apply: (patch: Patch) => void
  navigate: NavigateFunction
}) {
  const { user } = useAuth()
  const me = useProfile()
  const [room, setRoom] = useState<WatchTogetherRoom | null>(null)
  const [peers, setPeers] = useState<PeerMember[]>([])
  const [chat, setChat] = useState<WatchChatMessage[]>([])
  const [reactions, setReactions] = useState<WatchReaction[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'p2p' | 'disconnected'>('disconnected')
  const [external, setExternal] = useState<Control | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [seen, setSeen] = useState(0)
  const video = useRef<HTMLVideoElement | null>(null)
  const noticeT = useRef<number | null>(null)
  const joining = useRef<string | null>(null)
  const remote = useRef(false) // true while applying the host's change, so the guest guard lets it through
  const cur = useRef<Cur>({ s: o.season, e: o.episode, p: o.provider })
  cur.current = { s: o.season, e: o.episode, p: o.provider }
  const latest = useRef(o)
  latest.current = o

  const userProfile = useMemo(
    () => ({
      id: user?.id,
      username: (user?.user_metadata?.username as string) || (user?.email ? user.email.split('@')[0] : `otaku_${Math.random().toString(36).slice(2, 6)}`),
      displayName: me.name || (user?.user_metadata?.full_name as string) || 'Otaku',
      avatar: me.avatar,
    }),
    [user, me],
  )

  const flash = (m: string) => {
    setNotice(m)
    if (noticeT.current) window.clearTimeout(noticeT.current)
    noticeT.current = window.setTimeout(() => setNotice(null), 2000)
  }

  const run = (patch: Patch) => {
    remote.current = true
    try {
      latest.current.apply(patch)
    } finally {
      remote.current = false
    }
  }

  const connect = useCallback(
    (roomId: string, isHost: boolean) => {
      const x = latest.current
      const r = new WatchTogetherRoom({
        roomId,
        isHost,
        animeId: x.id,
        episode: packEp(cur.current.s, cur.current.e),
        animeTitle: x.title,
        server: cur.current.p,
        user: userProfile,
      })
      const drift = makeDriftCheck()
      r.onSync((p) => {
        if ((p.type === 'HEARTBEAT' || p.type === 'STATE') && !r.isHost && p.episode) {
          // same season / episode / server / audio as the host? (late joiner, or a different pick by accident)
          const { s, e } = unpackEp(p.episode)
          const c = cur.current
          const wantEp = s !== c.s || e !== c.e
          const wantP = !!p.server && p.server !== c.p
          const wantD = !wantP && c.p === 'moviebox' && !!p.dub && !!latest.current.dub && p.dub !== latest.current.dub
          if (drift([wantEp && `e${p.episode}`, wantP && `p${p.server}`, wantD && `d${p.dub}`].filter(Boolean).join('|'))) {
            flash('Synced with the party host')
            run({ ...(wantEp ? { s, e } : {}), ...(wantP ? { p: p.server } : {}), ...(wantD ? { d: p.dub as string } : {}) })
          }
        }
        if (p.type === 'PLAY' || p.type === 'PAUSE' || p.type === 'SEEK') {
          setExternal({ action: p.type.toLowerCase() as Control['action'], time: p.currentTime, token: Date.now() })
          flash(p.type === 'PLAY' ? 'Party playing' : p.type === 'PAUSE' ? 'Party paused' : 'Party seeked')
        } else if (p.type === 'HEARTBEAT') {
          const v = video.current
          if (!v) return
          const expected = p.currentTime + (Date.now() - p.timestamp) / 1000
          const stateOff = Boolean(p.paused) !== v.paused && !v.seeking
          if (Math.abs(v.currentTime - expected) > 1.4 || stateOff) {
            setExternal({ action: p.paused ? 'pause' : 'play', time: p.paused ? p.currentTime : expected, token: Date.now() })
          }
        }
      })
      r.onEpisodeChange((n) => {
        const { s, e } = unpackEp(n)
        if (s === cur.current.s && e === cur.current.e) return
        flash(latest.current.type === 'tv' ? `Party moved to S${s} E${e}` : 'Party changed')
        run({ s, e })
      })
      r.onServerChange((p) => {
        if (p === cur.current.p) return
        flash('Party host switched server')
        run({ p })
      })
      r.onPeersChange(setPeers)
      r.onChat((m) => setChat((prev) => [...prev.slice(-80), m]))
      r.onReaction((x2) => setReactions((prev) => [...prev.slice(-30), x2]))
      r.onConnectionStatusChange(setStatus)
      setRoom(r)
      setPeers(r.getPeers())
      toast(isHost ? `Watch Party started! Code: ${roomId}` : `Joined Watch Party ${roomId}!`, 'success')
    },
    [userProfile],
  )

  // join / restore from ?room=
  useEffect(() => {
    const code = o.roomParam
    if (!code || room || !o.title || joining.current === code) return
    joining.current = code // render churn must not open the same room twice (duplicate presence = ghost members)
    void (async () => {
      const rec = await getWatchRoom(code)
      if (!rec) return connect(code, false) // expired record: join as a plain peer
      const m = movieRoomOf(rec)
      if (!m || m.type !== o.type || m.id !== o.id) {
        joining.current = null
        return o.navigate(movieRoomPath(rec, code), { replace: true })
      }
      const host = rec.host_id === getMyHostIdentifier(user?.id)
      connect(code, host)
      if (!host && (m.s !== cur.current.s || m.e !== cur.current.e || (m.provider && m.provider !== cur.current.p))) {
        run({ s: m.s, e: m.e, ...(m.provider ? { p: m.provider } : {}) })
      }
    })()
  }, [o.roomParam, room, o.title, o.type, o.id, user?.id, connect])

  // host heartbeat + keep the record alive
  useEffect(() => {
    if (!room) return
    const t = window.setInterval(() => {
      const v = video.current
      const c = cur.current
      const state = { episode: packEp(c.s, c.e), server: c.p, dub: latest.current.dub ?? null }
      if (room.isHost && v && !v.ended) room.sendSync('HEARTBEAT', v.currentTime, v.paused, state)
      else if (room.isHost && !v) room.sendSync('STATE', 0, undefined, state) // embed server: nothing to time, still say what we are on
      if (room.isHost) void touchWatchRoom(room.roomId)
    }, 3000)
    return () => clearInterval(t)
  }, [room])

  useEffect(() => () => room?.destroy(), [room])
  useEffect(() => {
    if (!room) setChatOpen(false)
  }, [room])
  useEffect(() => {
    if (chatOpen) setSeen(Date.now())
  }, [chatOpen, chat])

  const create = async () => {
    const id = generateWatchRoomId()
    await createWatchRoom({
      roomId: id,
      hostId: getMyHostIdentifier(user?.id),
      hostUsername: userProfile.username,
      hostDisplayName: userProfile.displayName,
      hostAvatar: userProfile.avatar,
      animeId: o.id,
      animeTitle: o.title,
      episode: packEp(o.season, o.episode),
      server: movieServerTag(o.type, o.provider),
      audio: 'sub',
    })
    joining.current = id
    connect(id, true)
    o.setRoomParam(id)
  }

  const join = async (code: string) => {
    const c = code.trim().toLowerCase()
    const rec = await getWatchRoom(c)
    const m = rec ? movieRoomOf(rec) : null
    if (rec && (!m || m.type !== o.type || m.id !== o.id)) return o.navigate(movieRoomPath(rec, c))
    joining.current = c
    connect(c, rec ? rec.host_id === getMyHostIdentifier(user?.id) : false)
    o.setRoomParam(c)
  }

  const leave = () => {
    if (!room) return
    joining.current = null
    if (room.isHost) void deleteWatchRoom(room.roomId)
    room.destroy()
    setRoom(null)
    setPeers([])
    setChat([])
    setReactions([])
    o.setRoomParam(null)
    toast('Left Watch Party', 'info')
  }

  /** host: tell the room about a season / episode / server change */
  const announce = (next: Cur) => {
    if (!room?.isHost) return
    const was = cur.current
    if (next.s !== was.s || next.e !== was.e) room.sendEpisodeChange(packEp(next.s, next.e))
    if (next.p !== was.p) room.sendServerChange(next.p)
    void updateWatchRoom(room.roomId, { episode: packEp(next.s, next.e), server: movieServerTag(o.type, next.p) })
  }

  const onPlayerAction = (a: { type: 'play' | 'pause' | 'seek'; time: number }) => {
    if (!room || (room.hostOnlyControl && !room.isHost)) return
    room.sendSync(a.type.toUpperCase() as 'PLAY' | 'PAUSE' | 'SEEK', a.time)
  }

  const forceSync = () => {
    const v = video.current
    if (room && v) {
      room.sendSync('SEEK', v.currentTime)
      flash('Sent force sync to all peers')
    }
  }

  const sendChat = (text: string) => {
    if (!room) return
    setChat((prev) => [...prev.slice(-80), room.sendChat(text, userProfile)])
  }
  const react = (emoji: string) => {
    if (!room) return
    setReactions((prev) => [...prev.slice(-30), room.sendReaction(emoji, userProfile.displayName, userProfile.avatar)])
  }

  const shareUrl = room
    ? `${window.location.origin}/movies/watch/${o.type}/${o.id}?${new URLSearchParams({
        s: String(o.season),
        e: String(o.episode),
        room: room.roomId,
        host: userProfile.displayName.slice(0, 40),
        t: o.title.slice(0, 120),
        ...(userProfile.avatar && /^https?:\/\//i.test(userProfile.avatar) ? { pfp: userProfile.avatar } : {}),
      })}`
    : ''

  const unread = room ? chat.filter((m) => m.timestamp > seen && m.senderId !== room.peerId).length : 0
  /** a guest may not change season / episode / server by hand */
  const guestLocked = () => Boolean(room && !room.isHost && !remote.current)

  return {
    room, peers, chat, reactions, notice, status, external, chatOpen, setChatOpen, unread, shareUrl,
    setVideo: (v: HTMLVideoElement | null) => { video.current = v },
    create, join, leave, announce, onPlayerAction, forceSync, sendChat, react, guestLocked,
  }
}
