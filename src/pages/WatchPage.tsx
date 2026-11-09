import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useBackToDetails } from '../lib/backToDetails'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flag,
  Info,
  Loader2,
  Lock,
  Unlock,
  ShieldCheck,
  Users,
  X,
  MonitorPlay,
  Radio,
  Copy,
  Check,
  Film,
  Smile,
  EyeOff,
  LogOut,
  MessageSquare,
  List,
  Crown,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Languages,
} from 'lucide-react'
import { WatchTogetherRoom, generateWatchRoomId, type PeerMember, type WatchChatMessage, type WatchReaction } from '../lib/webrtcWatchTogether'
import {
  createWatchRoom,
  getWatchRoom,
  updateWatchRoom,
  touchWatchRoom,
  deleteWatchRoom,
  getMyHostIdentifier,
} from '../lib/watchRooms'
import { WatchTogetherModal } from '../components/WatchTogetherModal'
import { LiveReactionsOverlay } from '../components/LiveReactionsOverlay'
import { ChangeShowModal } from '../components/ChangeShowModal'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../lib/profile'
import { submitStreamReport } from '../lib/supabase'
import { fetchAnimeLite } from '../services/anilist'
import { acdnMapped, fetchAnimeSalt, fetchStream, fetchEpisodeServers, type ServerAudioMap, tmdbImg } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useTmdb } from '../hooks/useTmdb'
import { useEpisodes } from '../hooks/useEpisodes'
import { useFiller } from '../hooks/useFiller'
import { useFlag } from '../hooks/useFlag'
import { SERVERS, DIRECT, serverById, type EmbedCtx } from '../lib/servers'
import { episodeCounts } from '../lib/episodes'
import { lastEpisode, saveEpisode } from '../lib/progress'
import { toast } from '../lib/toast'
import { partyShareUrl } from '../lib/share'
import { finishEpisode, getHistory, getPrefs, savePrefs, touchHistory } from '../lib/library'
import { mediaToCard } from '../lib/mappers'
import { ListButton } from '../components/ListButton'
import { cn, formatLabel, formatStatus, pickTitle, stripHtml } from '../lib/utils'
import { requestMicrophoneStream } from '../lib/microphone'
import CinePlayer from '../components/CinePlayer'
import { EpisodeList } from '../components/EpisodeList'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import { LoadingGrid } from '../components/LoadingGrid'
import { LogoFill } from '../components/LogoFill'
import { LOGO_URL } from '../lib/constants'
import { Tour, tourDone, tourSeen, type TourStep } from '../components/Tour'
import { ServerPopup, type ServerOpt } from '../components/ServerPopup'
import { useShieldVerified, useShield, getToken } from '../lib/shield'
import { StreamProblem } from '../components/StreamProblem'


function Frame({ children }: { children: React.ReactNode }) {
  return <div data-tour="w-player" className="relative aspect-video w-full overflow-hidden bg-black lg:shadow-2xl lg:shadow-black/40 lg:ring-1 lg:ring-white/10">{children}</div>
}

/** Loading (episode, first load and server switch): the show's logo fills from dim to full colour. No logo: the Zenkai logo fills smoothly, plus quiet server switch. */
function Loading({ quiet, logo }: { quiet?: boolean; logo: string | null }) {
  return (
    <Frame>
      <div className="absolute inset-0 grid place-items-center">
        <LogoFill src={logo || LOGO_URL} />
      </div>
      {!quiet && <LoadingGrid className="absolute bottom-3 left-3 text-white/60 sm:bottom-4 sm:left-4" />}
    </Frame>
  )
}

/** Unavailable server: friendly mascot scene. The raw reason is kept off-screen (data-reason) so users never see backend wording. */
function Problem({ message, onReconnect, children }: { message?: string; onReconnect?: () => void; children?: React.ReactNode }) {
  return (
    <Frame>
      <StreamProblem reason={message} onReconnect={onReconnect}>
        {children}
      </StreamProblem>
    </Frame>
  )
}

const WATCH_TOUR: TourStep[] = [
  { target: '[data-tour="w-player"]', title: 'Your player', text: 'Tap the video for its controls. Everything below changes what plays here.' },
  { target: '[data-tour="w-audio"]', title: 'Audio', text: 'Pick sub or dub. On multi-audio servers every language in the stream is listed here.' },
  { target: '[data-tour="w-servers"]', title: 'Direct servers', text: 'Select a server from here. If one is slow or empty, try another.' },
  { target: '[data-tour="w-more"]', title: 'More servers', text: 'Multi-audio and embed servers are one tap away too.' },
  { target: '[data-tour="w-eps"]', title: 'Episodes', text: 'Jump to any episode from this list.' },
]

const pill = 'rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95'

export default function WatchPage() {
  const id = Number(useParams().id)
  const backTo = useBackToDetails()
  const [sp, setSp] = useSearchParams()
  const [autoNext, setAutoNext] = useFlag('zk:autonext', true)
  const [autoSkip, setAutoSkip] = useFlag('zk:autoskip', false)
  const [skipFiller, setSkipFiller] = useFlag('zk:skipfiller', false)

  // Watch Together State (WebRTC + Supabase Broadcast Signaling)
  const { user } = useAuth()
  const me = useProfile()
  const [watchModalOpen, setWatchModalOpen] = useState(false)
  const [room, setRoom] = useState<WatchTogetherRoom | null>(null)
  const [peers, setPeers] = useState<PeerMember[]>([])
  const [chatMessages, setChatMessages] = useState<WatchChatMessage[]>([])
  const [reactions, setReactions] = useState<WatchReaction[]>([])
  const [syncNotice, setSyncNotice] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'p2p' | 'disconnected'>('disconnected')
  const [externalControl, setExternalControl] = useState<{ action: 'play' | 'pause' | 'seek'; time: number; token: number } | null>(null)
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const navigate = useNavigate()
  const [hideEmojiOverlay, setHideEmojiOverlay] = useState(false)
  const [hostTab, setHostTab] = useState<'chat' | 'episodes' | 'servers'>('chat')
  const [changeShowOpen, setChangeShowOpen] = useState(false)
  const [inlineChatText, setInlineChatText] = useState('')
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [, setControlModeKey] = useState(0)
  const [isMicActive, setIsMicActive] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const EMOJI_REACTIONS = ['🔥', '😱', '❤️', '😂', '👏', '⚡', '🍿', '⚔️']

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const showNotice = (msg: string) => {
    setSyncNotice(msg)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setSyncNotice(null), 2000)
  }

  const userProfile = useMemo(() => ({
    id: user?.id,
    username: (user?.user_metadata?.username as string) || (user?.email ? user.email.split('@')[0] : `otaku_${Math.random().toString(36).slice(2, 6)}`),
    displayName: me.name || user?.user_metadata?.full_name || 'Otaku',
    avatar: me.avatar,
  }), [user, me])



  const shieldOk = useShieldVerified()
  // once verified, stay verified: a token refresh mid-session must not unmount the player (that kicks it out of fullscreen)
  const [everOk, setEverOk] = useState(shieldOk)
  useEffect(() => {
    if (shieldOk) setEverOk(true)
  }, [shieldOk])
  const sessionVerified = shieldOk || everOk
  const shieldFailed = useShield().failed
  useEffect(() => {
    if (shieldOk) return
    void getToken()
    // keep trying: one failed fetch must never leave the player locked until a manual reload
    const t = window.setInterval(() => void getToken(), 6000)
    return () => window.clearInterval(t)
  }, [shieldOk])
  const [loadKind, setLoadKind] = useState<'episode' | 'server'>('episode')
  const [aud, setAud] = useState<{ tracks: { i: number; label: string; lang: string }[]; active: number }>({ tracks: [], active: 0 })
  const [tourOn, setTourOn] = useState(false)
  const [pageTourDone, setPageTourDone] = useState(() => tourSeen('watch'))
  const [audSel, setAudSel] = useState<{ i: number } | null>(null)
  /** audio rendition the party host picked; applied here as soon as this server's track list has it */
  const [partyTrack, setPartyTrack] = useState<{ label: string; lang: string; token: number } | null>(null)
  const applyingPartyAudio = useRef(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportIssue, setReportIssue] = useState("Broken / Won't Play")
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const anime = useAsync(() => fetchAnimeLite(id), [id])
  const a = anime.data
  const title = a ? pickTitle(a.title) : ''
  const { total, available } = a ? episodeCounts(a) : { total: 0, available: 0 }

  const rawEp = Number(sp.get('ep')) || lastEpisode(id) || 1
  const ep = a ? Math.min(Math.max(1, rawEp), Math.max(available, 1)) : rawEp
  // URL wins, then what this title last used, then the last server/audio used anywhere
  const saved = useMemo(() => ({ ...getPrefs(), ...getHistory(id) }), [id])
  const acdn = useAsync(() => acdnMapped(id), [id]).data
  const serverAudioQuery = useAsync(
    () => (a ? fetchEpisodeServers(id, ep, title) : Promise.resolve({} as ServerAudioMap)),
    [id, ep, title, sessionVerified]
  )
  const serverAudio = serverAudioQuery.data
  const defaultServer = id >= 900000 ? 'acdn' : (saved.server ?? 'megaplay')
  const wanted = serverById(sp.get('server') ?? defaultServer)
  const server = wanted.id === 'acdn' && acdn === false ? serverById('megaplay') : wanted
  const directList = DIRECT.filter((s) => s.id !== 'acdn' || acdn === true)
  const audio: 'sub' | 'dub' = (sp.get('audio') ?? saved.audio) === 'dub' ? 'dub' : 'sub'
  // Where "try another" (button or plugging Plugo in) sends people when the current server has nothing
  const altId = server.kind === 'animesalt' ? (server.id === 'animesalt-1' ? 'animesalt-2' : 'megaplay') : (directList.find((s) => s.id !== server.id)?.id ?? 'megaplay')
  const altName = serverById(altId).name

  function go(patch: { ep?: number; server?: string; audio?: string }, replace = true, fromPartySync = false) {
    if (room) {
      if (!room.isHost && !fromPartySync) {
        if (patch.server && patch.server !== server.id) {
          toast('Only the party host can change servers', 'info')
          return
        }
        if (patch.audio && patch.audio !== audio) {
          toast('Only the party host can change audio', 'info')
          return
        }
        if (patch.ep !== undefined && patch.ep !== ep) {
          toast('Only the party host can change episodes', 'info')
          return
        }
      }
      if (room.isHost && !fromPartySync) {
        if (patch.server && patch.server !== server.id) {
          room.sendServerChange(patch.server)
          void updateWatchRoom(room.roomId, { server: patch.server })
        }
        if (patch.audio && (patch.audio === 'sub' || patch.audio === 'dub') && patch.audio !== audio) {
          room.sendAudioChange(patch.audio)
          void updateWatchRoom(room.roomId, { audio: patch.audio })
        }
        if (patch.ep !== undefined && patch.ep !== ep) {
          room.sendEpisodeChange(patch.ep)
          void updateWatchRoom(room.roomId, { episode: patch.ep })
        }
      }
    }
    setLoadKind(patch.server ? 'server' : 'episode')
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('ep', String(patch.ep ?? ep))
        n.set('server', patch.server ?? server.id)
        n.set('audio', patch.audio ?? audio)
        return n
      },
      { replace },
    )
  }


  const connectToRoom = useCallback((roomId: string, isHost: boolean) => {
    if (room) {
      room.destroy()
    }

    const newRoom = new WatchTogetherRoom({
      roomId,
      isHost,
      animeId: id,
      episode: ep,
      animeTitle: title,
      server: server.id,
      user: userProfile,
    })

    newRoom.onSync((payload) => {
      if (payload.type === 'PLAY') {
        setExternalControl({ action: 'play', time: payload.currentTime, token: Date.now() })
        showNotice('Party playing')
      } else if (payload.type === 'PAUSE') {
        setExternalControl({ action: 'pause', time: payload.currentTime, token: Date.now() })
        showNotice('Party paused')
      } else if (payload.type === 'SEEK') {
        setExternalControl({ action: 'seek', time: payload.currentTime, token: Date.now() })
        const m = Math.floor(payload.currentTime / 60)
        const sec = Math.floor(payload.currentTime % 60)
        showNotice(`Seeked to ${m}:${sec < 10 ? '0' : ''}${sec}`)
      } else if (payload.type === 'HEARTBEAT') {
        const v = videoElRef.current
        if (v) {
          const expected = payload.currentTime + (Date.now() - payload.timestamp) / 1000
          const stateOff = Boolean(payload.paused) !== v.paused && !v.seeking
          if (Math.abs(v.currentTime - expected) > 1.4 || stateOff) {
            // also covers a guest who just (re)joined: pick up the host's position and play/pause state
            setExternalControl({
              action: payload.paused ? 'pause' : 'play',
              time: payload.paused ? payload.currentTime : expected,
              token: Date.now(),
            })
          }
        }
      }
    })

    newRoom.onEpisodeChange((newEp) => {
      if (newEp !== ep) {
        showNotice(`Party changed to Episode ${newEp}`)
        go({ ep: newEp }, false, true)
      }
    })

    newRoom.onShowChange((newAnimeId, newTitle, newEp) => {
      showNotice(`Party host switched show to ${newTitle}`)
      navigate(`/watch/${newAnimeId}?room=${roomId}&ep=${newEp || 1}`)
    })

    newRoom.onServerChange((newServer) => {
      showNotice(`Party host switched server to ${newServer}`)
      go({ server: newServer }, false, true)
    })

    newRoom.onAudioChange((newAudio) => {
      showNotice(`Party host switched audio to ${newAudio.toUpperCase()}`)
      go({ audio: newAudio }, false, true)
    })

    newRoom.onAudioTrackChange((t) => {
      showNotice(`Party host switched audio to ${t.label || t.lang || 'another track'}`)
      setPartyTrack({ ...t, token: Date.now() })
    })

    newRoom.onPeersChange((p) => setPeers(p))
    newRoom.onChat((msg) => setChatMessages((prev) => [...prev.slice(-80), msg]))
    newRoom.onReaction((r) => setReactions((prev) => [...prev.slice(-30), r]))
    newRoom.onConnectionStatusChange((st) => setConnectionStatus(st))
    newRoom.onLocalMicChange((active) => setIsMicActive(active))

    setRoom(newRoom)
    setPeers(newRoom.getPeers())
    setIsMicActive(newRoom.getIsMicActive())
    toast(isHost ? `Watch Party started! Code: ${roomId}` : `Joined Watch Party ${roomId}!`, 'success')
  }, [room, id, ep, title, server.id, userProfile, go, navigate])

  /** Coming back from a member's profile: reopen the party panel (the room itself is rejoined from the URL). */
  const reopenAfterProfile = (roomId: string) => {
    try {
      if (sessionStorage.getItem('zk:party-return') === roomId) {
        sessionStorage.removeItem('zk:party-return')
        setWatchModalOpen(true)
      }
    } catch {
      /* storage unavailable */
    }
  }

  // Auto-connect and restore host status from Supabase if room param is present in URL
  const urlRoom = sp.get('room')
  const joiningRoom = useRef<string | null>(null)
  useEffect(() => {
    if (urlRoom && !room && title && joiningRoom.current !== urlRoom) {
      joiningRoom.current = urlRoom // render churn must not open the same room twice (duplicate presence = ghost members)
      void (async () => {
        const record = await getWatchRoom(urlRoom)
        const myHostId = getMyHostIdentifier(user?.id)
        if (record) {
          const amHost = record.host_id === myHostId
          if (record.anime_id !== id) {
            joiningRoom.current = null
            navigate(`/watch/${record.anime_id}?room=${urlRoom}&ep=${record.episode}&server=${record.server}&audio=${record.audio}`, { replace: true })
            return
          }
          connectToRoom(urlRoom, amHost)
          reopenAfterProfile(urlRoom)
        } else {
          // If room record was deleted or expired (>30m inactive), join as standard peer
          connectToRoom(urlRoom, false)
          reopenAfterProfile(urlRoom)
        }
      })()
    }
  }, [urlRoom, room, title, id, user?.id, connectToRoom, navigate])

  // Periodic heartbeat when host + touch Supabase record to refresh 30-min window
  useEffect(() => {
    if (!room) return
    const interval = window.setInterval(() => {
      const v = videoElRef.current
      if (v && !v.ended && room.isHost) {
        room.sendSync('HEARTBEAT', v.currentTime, v.paused)
      }
      if (room.isHost) {
        void touchWatchRoom(room.roomId)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [room])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) room.destroy()
    }
  }, [room])

  const handleCreateRoom = async () => {
    const newId = generateWatchRoomId()
    const myHostId = getMyHostIdentifier(user?.id)

    // Save temporary room record to Supabase with 30-minute auto-expiry
    await createWatchRoom({
      roomId: newId,
      hostId: myHostId,
      hostUsername: userProfile.username,
      hostDisplayName: userProfile.displayName,
      hostAvatar: userProfile.avatar,
      animeId: id,
      animeTitle: title,
      episode: ep,
      server: server.id,
      audio,
    })

    joiningRoom.current = newId
    connectToRoom(newId, true)
    setSp((prev) => {
      const n = new URLSearchParams(prev)
      n.set('room', newId)
      return n
    }, { replace: true })
  }

  const handleJoinRoom = async (code: string) => {
    const cleanCode = code.trim().toLowerCase()
    const record = await getWatchRoom(cleanCode)
    const myHostId = getMyHostIdentifier(user?.id)
    const amHost = record ? record.host_id === myHostId : false

    if (record && record.anime_id !== id) {
      navigate(`/watch/${record.anime_id}?room=${cleanCode}&ep=${record.episode}&server=${record.server}&audio=${record.audio}`)
      return
    }

    joiningRoom.current = cleanCode
    connectToRoom(cleanCode, amHost)
    setSp((prev) => {
      const n = new URLSearchParams(prev)
      n.set('room', cleanCode)
      return n
    }, { replace: true })
  }

  const handleLeaveRoom = () => {
    joiningRoom.current = null
    if (room) {
      if (room.isHost) {
        void deleteWatchRoom(room.roomId)
      }
      room.destroy()
      setRoom(null)
      setPeers([])
      setChatMessages([])
      setReactions([])
      setSp((prev) => {
        const n = new URLSearchParams(prev)
        n.delete('room')
        return n
      }, { replace: true })
      toast('Left Watch Party', 'info')
    }
  }

  const handlePlayerAction = (action: { type: 'play' | 'pause' | 'seek'; time: number }) => {
    if (!room) return
    if (room.hostOnlyControl && !room.isHost) return
    if (action.type === 'play') {
      room.sendSync('PLAY', action.time)
    } else if (action.type === 'pause') {
      room.sendSync('PAUSE', action.time)
    } else if (action.type === 'seek') {
      room.sendSync('SEEK', action.time)
    }
  }

  const handleChangeShow = (newAnimeId: number, newTitle: string) => {
    if (room && room.isHost) {
      room.sendShowChange(newAnimeId, newTitle, 1)
      void updateWatchRoom(room.roomId, {
        anime_id: newAnimeId,
        anime_title: newTitle,
        episode: 1,
      })
      navigate(`/watch/${newAnimeId}?room=${room.roomId}&ep=1`)
    }
  }

  const handleCopyInvite = async () => {
    if (!room) return
    const url = partyShareUrl(id, ep, room.roomId, userProfile.displayName, title, userProfile.avatar)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedInvite(true)
      toast('Copied Watch Party invite link!')
      setTimeout(() => setCopiedInvite(false), 2000)
    } catch {
      toast('Failed to copy link', 'error')
    }
  }

  const handleForceSync = () => {
    if (!room) return
    const v = videoElRef.current
    if (v) {
      room.sendSync('SEEK', v.currentTime)
      showNotice('Sent force sync to all peers')
    }
  }

  const bundle = useTmdb(a?.id, title, a?.format)
  const logo = tmdbImg(bundle?.tmdb?.logo, 'w500')
  const eps = useEpisodes(bundle?.tmdb ?? null, a?.streamingEpisodes)
  const kinds = useFiller(a)
  const ctx: EmbedCtx = useMemo(
    () => ({
      anilistId: id,
      malId: bundle?.mapping?.mal ?? a?.idMal ?? null,
      tmdb: bundle?.mapping?.tmdb ?? (bundle?.tmdb ? { id: bundle.tmdb.id, type: bundle.tmdb.type, season: bundle.tmdb.season } : null),
      episode: ep,
      audio,
      isMovie: a?.format === 'MOVIE',
    }),
    [id, bundle, a, ep, audio],
  )

  const stream = useAsync(
    async () => (a && sessionVerified && server.kind === 'direct' ? fetchStream({ id, ep, server: server.id, audio, title, format: a.format }) : null),
    [a?.id, ep, server.id, audio, sessionVerified],
  )
  const salt = useAsync(
    async () => (a && sessionVerified && server.kind === 'animesalt' ? fetchAnimeSalt({ id, ep, title, format: a.format, server: server.salt ?? '1' }) : null),
    [a?.id, ep, server.id, sessionVerified],
  )
  // Keep the player mounted across episode / audio changes: last good stream stays until the new one lands
  const [held, setHeld] = useState<{ d: NonNullable<typeof stream.data>; ep: number; audio: 'sub' | 'dub'; sid: string } | null>(null)
  useEffect(() => {
    if (stream.data) setHeld({ d: stream.data, ep, audio, sid: server.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.data])
  const cur = stream.data ? { d: stream.data, ep, audio } : held && held.sid === server.id && !stream.error ? held : null
  const serverBusy = loadKind === 'server' && (stream.loading || salt.loading)
  const embedSrc = sessionVerified && server.kind === 'embed' ? (server.url?.(ctx) ?? null) : null

  useEffect(() => {
    if (a) saveEpisode(id, ep)
  }, [a, id, ep])

  const ready = !!(a && (server.kind === 'direct' ? stream.data : server.kind === 'animesalt' ? salt.data : embedSrc))
  // Save episode, prefs and touch continue watching immediately so this show is instantly first
  useEffect(() => {
    if (!a) return
    touchHistory(mediaToCard(a), { ep, server: server.id, audio })
    savePrefs({ server: server.id, ...(server.audio ? { audio } : {}) })
  }, [a, ep, server.id, server.audio, audio])
  useEffect(() => {
    if (title) document.title = `${title} · Episode ${ep} — Zenkai`
  }, [title, ep])

  const playerServers = useMemo(
    () =>
      directList.map((s) => {
        const info = serverAudio?.[s.id]
        let tags: string[] = []
        if (serverAudioQuery.loading) {
          tags = ['CHECKING…']
        } else if (info) {
          if (info.sub) tags.push('SUB')
          if (info.dub) tags.push('DUB')
          if (tags.length === 0) tags.push('N/A')
        }
        return {
          id: s.id,
          name: s.name,
          note: tags.length ? tags.join(' · ') : s.note,
          tags,
        }
      }),
    [directList, serverAudio, serverAudioQuery.loading]
  )
  const tracks = (server.multi || aud.tracks.length > 1) ? aud.tracks : []
  const activeTrack = aud.tracks.find((t) => t.i === aud.active)
  // Party host: whatever rendition is playing (picked in the player or from the panel) is broadcast to everyone
  useEffect(() => {
    if (!room?.isHost || !activeTrack) return
    room.sendAudioTrackChange({ label: activeTrack.label, lang: activeTrack.lang })
  }, [room, activeTrack?.label, activeTrack?.lang])
  // Party guest: switch to the host's rendition once this server's track list contains it
  useEffect(() => {
    if (!partyTrack || !room || room.isHost) return
    const n = (x: string) => x.trim().toLowerCase()
    const hit =
      aud.tracks.find((t) => n(t.label) === n(partyTrack.label) && n(t.lang) === n(partyTrack.lang)) ??
      aud.tracks.find((t) => partyTrack.lang && n(t.lang) === n(partyTrack.lang)) ??
      aud.tracks.find((t) => n(t.label) === n(partyTrack.label))
    if (!hit) return
    setPartyTrack(null)
    if (hit.i === aud.active) return
    applyingPartyAudio.current = true
    setAudSel({ i: hit.i })
    window.setTimeout(() => { applyingPartyAudio.current = false }, 800)
  }, [partyTrack, aud.tracks, aud.active, room])
  const pickTrack = (t: { i: number; label: string; lang: string }) => {
    setAudSel({ i: t.i })
    const l = t.label.toLowerCase()
    const g = t.lang.toLowerCase()
    const isDub = g === 'en' || g === 'eng' || l.includes('english') || l.includes('dub')
    const isSub = g === 'ja' || g === 'jpn' || l.includes('native') || l.includes('japanese')
    if (isDub && audio !== 'dub') go({ audio: 'dub' })
    else if (isSub && audio !== 'sub') go({ audio: 'sub' })
  }
  // first visit: pause and walk through the page once the player area has rendered
  useEffect(() => {
    if (!ready || pageTourDone || tourOn) return
    const t = window.setTimeout(() => setTourOn(true), 800)
    return () => window.clearTimeout(t)
  }, [ready, pageTourDone, tourOn])
  const hrefFor = (n: number) => `/watch/${id}?ep=${n}&server=${server.id}&audio=${audio}${room ? `&room=${room.roomId}` : ''}`
  // Next / prev jump over filler and recap episodes while "skip filler" is on (mixed episodes are never skipped)
  const step = (d: 1 | -1) => {
    for (let n = ep + d; n >= 1 && n <= available; n += d) {
      const k = kinds.get(n)
      if (!skipFiller || (k !== 'filler' && k !== 'recap')) return n
    }
  }
  const next = step(1)
  const prev = step(-1)
  const hasNext = next !== undefined
  const hasPrev = prev !== undefined
  const sequel = a?.relations.edges.find((e) => e.relationType === 'SEQUEL' && e.node.type === 'ANIME')

  if (anime.error) {
    return (
      <main className="grid min-h-[70svh] place-items-center px-4 pt-24">
        <ErrorState message={anime.error.message} onRetry={anime.reload} />
      </main>
    )
  }

  const direct: ServerOpt[] = directList.map((s) => {
    const info = serverAudio?.[s.id]
    let tags = serverAudioQuery.loading ? ['CHECKING…'] : ['SUB', 'DUB']
    if (info) {
      tags = []
      if (info.sub) tags.push('SUB')
      if (info.dub) tags.push('DUB')
      if (tags.length === 0) tags = ['N/A']
    }
    return {
      id: s.id,
      name: s.name,
      label: s.multi ? 'Zenkai player · Multi audio' : 'Zenkai player',
      tags,
    }
  })

  const currentServerInfo = serverAudio?.[server.id]
  const hasDub = currentServerInfo ? currentServerInfo.dub : false
  const hasSub = currentServerInfo ? currentServerInfo.sub : true

  // If currently selected server does not have DUB for this episode, auto fallback to SUB
  useEffect(() => {
    if (currentServerInfo && !currentServerInfo.dub && audio === 'dub' && currentServerInfo.sub) {
      go({ audio: 'sub' })
    }
  }, [currentServerInfo, audio])

  return (
    <main className="relative pb-10">
      <div className="mx-auto max-w-7xl lg:px-6 lg:pt-6">
        <div className="min-w-0">
          {/* Player */}
          {!sessionVerified ? (
            <Frame>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 text-center select-none">
                <div className="relative mb-3 grid size-16 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent shadow-xl shadow-black/50">
                  <Lock className="size-8 animate-pulse" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground">Media Playback Locked</h3>
                <p className="mt-1.5 max-w-sm text-xs text-muted leading-relaxed">
                  Verification challenge in progress. Complete the challenge to unlock high-speed streaming.
                </p>
                {shieldFailed && (
                  <button onClick={() => void getToken()} className="mt-4 rounded-full bg-white px-5 py-2 text-xs font-bold text-black active:scale-95">
                    Retry
                  </button>
                )}
              </div>
            </Frame>
          ) : !a ? (
            <Loading quiet={serverBusy} logo={logo} />
          ) : server.kind === 'direct' ? (
            !cur && stream.loading ? (
              <Loading quiet={serverBusy} logo={logo} />
            ) : !cur ? (
              <Problem message={stream.error?.message ?? 'No stream found.'} onReconnect={() => go({ server: altId })}>
                <button onClick={() => go({ server: altId })} className={cn(pill, 'border-transparent bg-white text-black')}>
                  Try {altName}
                </button>
                {server.audio && (
                  <button onClick={() => go({ audio: audio === 'sub' ? 'dub' : 'sub' })} className={cn(pill, 'border-white/15 bg-white/5 text-white')}>
                    {audio === 'sub' ? 'DUB' : 'SUB'} instead
                  </button>
                )}
              </Problem>
            ) : (
              <Frame>
                <CinePlayer
                  key={server.id}
                  hasDub={hasDub}
                  switching={stream.loading}
                  streamUrl={cur.d.streamUrl}
                  intro={cur.d.intro}
                  outro={cur.d.outro}
                  title={title}
                  episode={cur.ep}
                  totalEpisodes={total}
                  availableEpisodes={available}
                  animeId={id}
                  format={a.format}
                  directSubtitles={cur.d.subtitles.map((s, i) => ({ id: `s${i}`, label: s.label, lang: s.label, url: s.file }))}
                  audioMode={cur.audio}
                  onAudio={(m) => go({ audio: m }, true, applyingPartyAudio.current)}
                  onAudioTracks={(tracks, active) => setAud({ tracks, active })}
                  audioSel={audSel}
                  tourReady={pageTourDone}
                  servers={playerServers}
                  serverId={server.id}
                  onServer={(sid) => go({ server: sid })}
                  hasNextEpisode={hasNext}
                  hasPrevEpisode={hasPrev}
                  onNextEpisode={() => next && go({ ep: next }, false)}
                  onPrevEpisode={() => prev && go({ ep: prev }, false)}
                  nextEpisode={next}
                  episodeKind={kinds.get(ep)}
                  skipFiller={skipFiller}
                  onSkipFiller={setSkipFiller}
                  onSelectEpisode={(n) => go({ ep: n }, false)}
                  onPlay={() => touchHistory(mediaToCard(a), { ep: cur.ep, server: server.id, audio })}
                  onProgress={(pos, dur) => touchHistory(mediaToCard(a), { ep: cur.ep, server: server.id, audio, pos, dur })}
                  onEnded={() => {
                    finishEpisode(mediaToCard(a), ep, hasNext)
                    if (autoNext && next) go({ ep: next }, false)
                  }}
                  autoNext={autoNext}
                  onAutoNext={setAutoNext}
                  autoSkip={autoSkip}
                  onAutoSkip={setAutoSkip}
                  episodesInfo={eps}
                  fallbackImg={a.bannerImage ?? a.coverImage.extraLarge}
                  defaultRuntime={a.duration}
                  kinds={kinds}
                  onVideoRef={(v) => { videoElRef.current = v }}
                  onPlayerAction={handlePlayerAction}
                  externalControl={externalControl}
                  onWatchTogetherClick={() => setWatchModalOpen(true)}
                  watchPartyActive={Boolean(room)}
                  watchPartyPeersCount={peers.length}
                  isPartyGuest={Boolean(room && !room.isHost)}
                />
                <LiveReactionsOverlay reactions={reactions} syncNotice={syncNotice} enabled={!hideEmojiOverlay} />
              </Frame>
            )
          ) : server.kind === 'animesalt' ? (
            salt.loading ? (
              <Loading quiet={serverBusy} logo={logo} />
            ) : salt.error || !salt.data ? (
              <Problem message={salt.error?.message ?? 'Not found on AnimeSalt.'} onReconnect={() => go({ server: altId })}>
                <button onClick={() => go({ server: altId })} className={cn(pill, 'border-transparent bg-white text-black')}>
                  Try {altName}
                </button>
              </Problem>
            ) : (
              <Frame>
                <iframe key={salt.data} src={salt.data} title={title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen className="absolute inset-0 size-full border-0" />
              </Frame>
            )
          ) : embedSrc ? (
            <Frame>
              <iframe key={embedSrc} src={embedSrc} title={title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen className="absolute inset-0 size-full border-0" />
            </Frame>
          ) : bundle === null ? (
            <Loading quiet={serverBusy} logo={logo} />
          ) : (
            <Problem message={`${server.name} needs an id this title doesn't have.`} onReconnect={() => go({ server: altId })}>
              <button onClick={() => go({ server: altId })} className={cn(pill, 'border-transparent bg-white text-black')}>
                Try {altName}
              </button>
            </Problem>
          )}

          {/* Title + episode nav */}
          <div className="mt-4 flex px-3 sm:px-6 lg:px-0 flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {a ? (
                <>
                  <Link to={`/anime/${id}`} onClick={backTo(`/anime/${id}`)} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent">
                    <ChevronLeft className="size-3.5" /> Details
                  </Link>
                  <br />
                  <Link to={`/anime/${id}`} onClick={backTo(`/anime/${id}`)} className="font-display text-2xl font-black tracking-tight transition-colors hover:text-accent">
                    {title}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    Episode {ep}
                    {eps.get(ep)?.name && ` · ${eps.get(ep)?.name}`}
                    {total > 1 && ` of ${a.episodes ?? available}`} · {formatLabel(a.format)} · {formatStatus(a.status)}
                    {bundle?.tmdb?.certification && ` · ${bundle.tmdb.certification}`}
                  </p>
                  {bundle?.tmdb?.tagline && <p className="mt-1 text-sm italic text-muted">“{bundle.tmdb.tagline}”</p>}
                </>
              ) : (
                <Skeleton className="h-9 w-72" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWatchModalOpen(true)}
                className={cn(
                  pill,
                  'inline-flex items-center gap-2 border shadow-sm transition active:scale-95',
                  room
                    ? 'border-border bg-card-2 text-foreground'
                    : 'border-border bg-card/60 text-foreground hover:border-accent'
                )}
              >
                <Users className="size-4" />
                <span>{room ? `Party (${peers.length})` : 'Watch Together'}</span>
                {room && <span className="size-1.5 rounded-full bg-emerald-400" />}
              </button>
              <button
                disabled={!hasPrev || Boolean(room && !room.isHost)}
                onClick={() => prev && go({ ep: prev }, false)}
                title={room && !room.isHost ? 'Only party host can change episodes' : 'Previous episode'}
                className={cn(pill, 'inline-flex items-center gap-1.5 border-border bg-card/60 disabled:opacity-35', room && !room.isHost && 'cursor-not-allowed')}
              >
                <ChevronLeft className="size-4" /> Prev
              </button>
              <button
                disabled={!hasNext || Boolean(room && !room.isHost)}
                onClick={() => next && go({ ep: next }, false)}
                title={room && !room.isHost ? 'Only party host can change episodes' : 'Next episode'}
                className={cn(pill, 'inline-flex items-center gap-1.5 border-transparent bg-foreground text-background disabled:opacity-35', room && !room.isHost && 'cursor-not-allowed')}
              >
                Next <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

        </div>

        <div className="mt-2 grid gap-8 px-3 sm:px-6 lg:px-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {room ? (
            /* Watch Together Control Center & Live Chat below Player */
            <div className="mt-5 space-y-4">
              {/* Watch Together Control & Status Bar */}
              <div className="space-y-3 rounded-3xl border border-border bg-card/80 p-3.5 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-border bg-card-2 text-foreground">
                    <MonitorPlay className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm sm:text-base font-bold text-foreground">
                        Room {room.roomId}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Synced
                      </span>
                    </div>
                    <p className="text-[11px] text-muted">
                      {peers.length} {peers.length === 1 ? 'peer' : 'peers'} · {room.isHost ? 'You are Host' : 'Guest (Playback synced)'}
                    </p>
                    {activeTrack && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                        <Languages className="size-3" /> Audio: <span className="font-semibold text-foreground">{activeTrack.label}</span>
                        {!room.isHost && ' (set by host)'}
                      </p>
                    )}
                  </div>
                </div>
                  <button
                    type="button"
                    onClick={handleLeaveRoom}
                    title="Leave Watch Party"
                    aria-label="Leave Watch Party"
                    className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted transition hover:border-rose-500/40 hover:text-rose-400 active:scale-90"
                  >
                    <LogOut className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Voice Chat Mic Toggle */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!room) return
                      let preacquired: MediaStream | undefined
                      if (!isMicActive) {
                        try {
                          preacquired = await requestMicrophoneStream()
                        } catch (err: any) {
                          const msg = err?.message || ''
                          if (msg.includes('HTTPS')) {
                            toast(msg, 'error')
                            return
                          }
                          const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
                          toast(
                            isDenied
                              ? 'Microphone permission denied. Allow microphone in browser settings to speak.'
                              : 'Could not access microphone. Ensure microphone is connected.',
                            'error'
                          )
                          return
                        }
                      }
                      try {
                        const active = await room.toggleMic(preacquired)
                        setIsMicActive(active)
                        toast(active ? 'Microphone on - speaking to room' : 'Microphone muted', active ? 'success' : 'info')
                      } catch {
                        setIsMicActive(false)
                      }
                    }}
                    title={isMicActive ? 'Mute Microphone' : 'Enable Microphone'}
                    className={cn(
                      'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-95',
                      isMicActive
                        ? 'border-transparent bg-foreground text-background'
                        : 'border-border bg-card-2 text-muted hover:text-foreground hover:border-accent'
                    )}
                  >
                    {isMicActive ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
                    <span>{isMicActive ? 'Mic On' : 'Mic Off'}</span>
                  </button>

                  {/* Copy Invite Link */}
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card-2 px-3 text-xs font-semibold text-foreground transition hover:border-accent active:scale-95"
                  >
                    {copiedInvite ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    <span>{copiedInvite ? 'Copied' : 'Invite'}</span>
                  </button>

                  {/* Emoji Overlay On/Off Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !hideEmojiOverlay
                      setHideEmojiOverlay(next)
                      toast(next ? 'Reactions overlay hidden' : 'Reactions overlay visible', 'info')
                    }}
                    title={hideEmojiOverlay ? 'Show floating emoji reactions' : 'Hide floating emoji reactions'}
                    className={cn(
                      'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card-2 px-3 text-xs font-semibold transition active:scale-95',
                      hideEmojiOverlay ? 'text-muted' : 'text-foreground'
                    )}
                  >
                    {hideEmojiOverlay ? <EyeOff className="size-3.5" /> : <Smile className="size-3.5" />}
                    <span>{hideEmojiOverlay ? 'Emoji off' : 'Emoji'}</span>
                  </button>

                  {/* Host Controls: Change Show & Control Mode */}
                  {room.isHost && (
                    <>
                      <button
                        type="button"
                        onClick={() => setChangeShowOpen(true)}
                        className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card-2 px-3 text-xs font-semibold text-foreground transition hover:border-accent active:scale-95"
                      >
                        <Film className="size-3.5" />
                        <span>Change Show</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextMode = !room.hostOnlyControl
                          room.setHostOnlyControl(nextMode)
                          setControlModeKey((k) => k + 1)
                          toast(nextMode ? 'Playback Control: Host Only' : 'Playback Control: Free for All', 'info')
                        }}
                        title="Toggle playback control permission"
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card-2 px-3 text-xs font-semibold text-muted transition hover:text-foreground active:scale-95"
                      >
                        {room.hostOnlyControl ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                        <span>{room.hostOnlyControl ? 'Host Only' : 'Free Mode'}</span>
                      </button>
                    </>
                  )}

                </div>
              </div>

              {/* Connected Members & Voice Mute Strip */}
              {peers.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/50 bg-card-2/40 px-3 py-2 ">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Members ({peers.length}):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {peers.map((p) => {
                      const isSelf = p.peerId === room.peerId
                      return (
                        <div
                          key={p.peerId}
                          className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/90 px-2.5 py-1 text-xs shadow-sm"
                        >
                          <div className="relative">
                            <Avatar size={20} name={p.displayName} src={p.avatar} />
                            {p.isMicActive && (
                              <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-1 ring-card" />
                            )}
                          </div>
                          <span className="font-semibold text-foreground text-[11px] max-w-[100px] truncate">
                            {p.displayName}
                          </span>
                          {isSelf && (
                            <span className="rounded border border-border px-1 text-[9px] font-semibold text-muted">
                              You
                            </span>
                          )}
                          {p.isHost && (
                            <Crown className="size-2.5 text-foreground shrink-0" />
                          )}

                          {/* Speaking / Muted indicator */}
                          {p.isMicActive ? (
                            <Mic className="size-2.5 text-foreground shrink-0" />
                          ) : (
                            <MicOff className="size-2.5 text-muted/60 shrink-0" />
                          )}

                          {/* Local Mute/Unmute toggle for other peers */}
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                const isMuted = room.toggleMutePeer(p.peerId)
                                toast(isMuted ? `Muted @${p.username} locally` : `Unmuted @${p.username}`, 'info')
                              }}
                              title={p.isLocallyMuted ? `Unmute @${p.username}` : `Mute @${p.username} for you`}
                              className={cn(
                                'ml-0.5 grid size-5 place-items-center rounded-lg border transition active:scale-90',
                                p.isLocallyMuted
                                  ? 'border-rose-500/40 bg-rose-500/20 text-rose-400'
                                  : 'border-border/60 bg-card-2 text-muted hover:text-foreground'
                              )}
                            >
                              {p.isLocallyMuted ? <VolumeX className="size-2.5" /> : <Volume2 className="size-2.5" />}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* For Host: Switch between Live Chat and Episode selector tabs */}
              {room.isHost && (
                <div className="flex gap-2 border-b border-border/60 pb-2">
                  <button
                    type="button"
                    onClick={() => setHostTab('chat')}
                    className={cn(
                      'flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-95',
                      hostTab === 'chat'
                        ? 'bg-foreground text-background'
                        : 'bg-card-2 border border-border text-muted hover:text-foreground'
                    )}
                  >
                    <MessageSquare className="size-3.5" />
                    <span>Live Party Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHostTab('episodes')}
                    className={cn(
                      'flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-95',
                      hostTab === 'episodes'
                        ? 'bg-foreground text-background'
                        : 'bg-card-2 border border-border text-muted hover:text-foreground'
                    )}
                  >
                    <List className="size-3.5" />
                    <span>Episodes ({available})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHostTab('servers')}
                    className={cn(
                      'flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-95',
                      hostTab === 'servers'
                        ? 'bg-foreground text-background'
                        : 'bg-card-2 border border-border text-muted hover:text-foreground'
                    )}
                  >
                    <Radio className="size-3.5" />
                    <span>Servers & Audio</span>
                  </button>
                </div>
              )}

              {/* Chat View (always open for guests; for host, shown when hostTab === 'chat') */}
              {(!room.isHost || hostTab === 'chat') && (
                <div className="overflow-hidden rounded-3xl border border-border bg-card/85 p-3 sm:p-4 shadow-xl backdrop-blur-xl">
                  {/* Chat messages stream */}
                  <div className="h-64 sm:h-72 overflow-y-auto space-y-2 p-2.5 overscroll-contain rounded-2xl bg-card-2/60 border border-border/40">
                    {chatMessages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                        <div className="grid size-11 place-items-center rounded-2xl bg-card text-muted shadow-sm">
                          <MessageSquare className="size-5 text-accent" />
                        </div>
                        <p className="mt-2 text-xs font-bold text-foreground">Room Chat is Live</p>
                        <p className="text-[11px] text-muted max-w-xs leading-relaxed mt-0.5">
                          Messages and reactions stay in sync with everyone watching right now!
                        </p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg.id} className="flex items-start gap-2.5">
                          <Avatar size={28} name={msg.senderName} src={msg.avatar} />
                          <div className="min-w-0 max-w-[85%] rounded-2xl bg-card px-3 py-1.5 border border-border/60 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-[11px] text-muted truncate">
                                {msg.senderName}
                              </span>
                              <span className="text-[9px] text-muted shrink-0">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-foreground break-words mt-0.5">{msg.text}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Compact Mobile Reaction Emojis Palette */}
                  <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                    {EMOJI_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          if (room) {
                            const r = room.sendReaction(emoji, userProfile.displayName, userProfile.avatar)
                            setReactions((prev) => [...prev.slice(-30), r])
                          }
                        }}
                        className="grid size-8 shrink-0 place-items-center rounded-xl bg-card-2 hover:bg-accent/20 text-base transition active:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Chat message input form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!inlineChatText.trim() || !room) return
                      const msg = room.sendChat(inlineChatText, userProfile)
                      setChatMessages((prev) => [...prev.slice(-80), msg])
                      setInlineChatText('')
                    }}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      type="text"
                      value={inlineChatText}
                      onChange={(e) => setInlineChatText(e.target.value)}
                      placeholder="Chat with watch party…"
                      className="h-10 flex-1 rounded-xl border border-border bg-card-2 px-3.5 text-xs text-foreground outline-none transition focus-visible:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={!inlineChatText.trim()}
                      className="flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-xs font-bold text-accent-fg transition hover:brightness-110 active:scale-95 disabled:opacity-40 shadow-sm"
                    >
                      <Send className="size-3.5" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                </div>
              )}

              {/* Host Episodes View (when hostTab === 'episodes') */}
              {room.isHost && hostTab === 'episodes' && a && available > 0 && (
                <section data-tour="w-eps" className="mt-4" aria-label="Episodes">
                  <div className="mb-3 rounded-2xl border border-accent/30 bg-accent/10 p-3 text-xs text-accent font-semibold flex items-center gap-2">
                    <Crown className="size-4 shrink-0 text-foreground" />
                    <span>Host Control: Selecting an episode immediately syncs it for all peers in this party.</span>
                  </div>
                  <EpisodeList
                    total={total}
                    available={available}
                    current={ep}
                    hrefFor={hrefFor}
                    onPick={(n) => go({ ep: n }, false)}
                    info={eps}
                    kinds={kinds}
                    fallbackImg={a.bannerImage ?? a.coverImage.extraLarge}
                    defaultRuntime={a.duration}
                  />
                </section>
              )}

              {/* Host Servers & Audio View (when hostTab === 'servers') */}
              {room.isHost && hostTab === 'servers' && (
                <div className="rounded-3xl border border-border bg-card/85 p-4 sm:p-5 shadow-xl backdrop-blur-xl space-y-5">
                  <div className="rounded-2xl border border-accent/30 bg-accent/10 p-3 text-xs text-accent font-semibold flex items-center gap-2">
                    <Crown className="size-4 shrink-0 text-foreground" />
                    <span>Host Control: Switching server or audio (track / Sub / Dub) will instantly sync it for all peers in the room.</span>
                  </div>

                  {/* Audio options */}
                  <div data-tour="w-audio">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                      {tracks.length > 0 ? `Audio · ${server.name}` : 'Audio Mode'}
                    </span>
                    {tracks.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1 rounded-3xl border border-border p-1 w-fit max-w-full">
                        {tracks.map((t) => (
                          <button
                            key={t.i}
                            onClick={() => pickTrack(t)}
                            className={cn(
                              'rounded-full px-4 py-2 text-xs font-bold uppercase transition active:scale-95',
                              aud.active === t.i ? 'bg-foreground text-background shadow-sm' : 'text-muted hover:text-foreground'
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    ) : server.multi || server.kind === 'animesalt' ? (
                      <p className="mt-2 text-xs text-muted">{stream.loading || salt.loading ? 'Loading audio tracks…' : 'Audio tracks are chosen inside the player on this server.'}</p>
                    ) : (
                    <div className="mt-2 flex flex-wrap rounded-3xl border border-border p-1 w-fit">
                      {(['sub', 'dub'] as const).map((m) => (
                        <button
                          key={m}
                          disabled={!server.audio}
                          onClick={() => go({ audio: m })}
                          className={cn(
                            'rounded-full px-5 py-2 text-xs font-bold uppercase transition active:scale-95',
                            audio === m && server.audio ? 'bg-foreground text-background shadow-sm' : 'text-muted hover:text-foreground',
                            !server.audio && 'opacity-40'
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    )}
                  </div>

                  {/* Direct Servers */}
                  <div data-tour="w-servers">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted block mb-2">Direct Server</span>
                    <ServerPopup
                      servers={direct}
                      value={server.id}
                      onPick={(sid) => (go({ server: sid }), toast(`Switched to ${direct.find((d) => d.id === sid)?.name ?? 'new server'}`))}
                    />
                  </div>

                  {/* Multi-audio & Embeds */}
                  <div className="space-y-4">
                    {[
                      { label: 'Multi audio', items: SERVERS.filter((s) => s.kind === 'animesalt') },
                      { label: 'Embeds', items: SERVERS.filter((s) => s.kind === 'embed') },
                    ].map((g) => (
                      <div key={g.label}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{g.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {g.items.map((s) => (
                            <button
                              key={s.id}
                              disabled={s.kind === 'embed' && bundle !== null && !s.url?.(ctx)}
                              onClick={() => go({ server: s.id })}
                              title={s.note}
                              className={cn(
                                pill,
                                'disabled:opacity-35',
                                s.id === server.id ? 'border-transparent bg-accent text-accent-fg shadow-lg shadow-accent/30' : 'border-border bg-card hover:bg-card-2'
                              )}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Audio + servers */}
              <section className="mt-5 flex flex-wrap items-center gap-3" aria-label="Source">
                <div data-tour="w-audio" className="flex w-full items-center gap-2 sm:w-auto">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted">Audio</span>
                  <div className="flex flex-wrap rounded-3xl border border-border p-0.5">
                    {tracks.length > 0
                      ? tracks.map((t) => (
                          <button
                            key={t.i}
                            onClick={() => pickTrack(t)}
                            className={cn('rounded-full px-4 py-1.5 text-xs font-bold uppercase transition', aud.active === t.i ? 'bg-foreground text-background' : 'text-muted')}
                          >
                            {t.label}
                          </button>
                        ))
                      : (['sub', 'dub'] as const)
                          .filter((m) => (m === 'dub' ? hasDub : hasSub))
                          .map((m) => (
                          <button
                            key={m}
                            disabled={!server.audio}
                            onClick={() => go({ audio: m })}
                            className={cn('rounded-full px-4 py-1.5 text-xs font-bold uppercase transition', audio === m && server.audio ? 'bg-foreground text-background' : 'text-muted', !server.audio && 'opacity-40')}
                          >
                            {m}
                          </button>
                        ))}
                  </div>
                  {serverAudioQuery.loading && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <Loader2 className="size-3 animate-spin text-accent" /> Searching servers…
                    </span>
                  )}
                  {!server.audio && !tracks.length && !serverAudioQuery.loading && <span className="text-xs text-muted">{server.kind === 'animesalt' ? 'Multi audio' : server.multi ? (stream.loading ? 'Multi audio · loading tracks…' : 'Multi audio') : 'Set in player'}</span>}
                </div>
                <div data-tour="w-servers">
                  <ServerPopup servers={direct} value={server.id} onPick={(sid) => (go({ server: sid }), toast(`Switched to ${direct.find((d) => d.id === sid)?.name ?? 'new server'}`))} />
                </div>
                {serverBusy && <LoadingGrid label={`Loading ${server.name}`} />}
              </section>

              <div data-tour="w-more" className="mt-5 space-y-4">
                {[
                  { label: 'Multi audio', items: SERVERS.filter((s) => s.kind === 'animesalt') },
                  { label: 'Embeds', items: SERVERS.filter((s) => s.kind === 'embed') },
                ].map((g) => (
                  <div key={g.label}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{g.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map((s) => (
                        <button
                          key={s.id}
                          disabled={s.kind === 'embed' && bundle !== null && !s.url?.(ctx)}
                          onClick={() => go({ server: s.id })}
                          title={s.note}
                          className={cn(pill, 'disabled:opacity-35', s.id === server.id ? 'border-transparent bg-accent text-accent-fg shadow-lg shadow-accent/30' : 'border-border bg-card hover:bg-card-2')}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Episodes */}
              {a && available > 0 && (
                <section data-tour="w-eps" className="mt-8" aria-label="Episodes">
                  <EpisodeList total={total} available={available} current={ep} hrefFor={hrefFor} onPick={() => setLoadKind('episode')} info={eps} kinds={kinds} fallbackImg={a.bannerImage ?? a.coverImage.extraLarge} defaultRuntime={a.duration} />
                </section>
              )}
            </>
          )}
        </div>

        {/* Side card */}
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          {a ? (
            <div className="overflow-hidden rounded-3xl border border-border bg-card/60">
              <div className="flex gap-4 p-4">
                <img src={a.coverImage.large ?? ''} alt="" className="aspect-[2/3] w-24 shrink-0 rounded-2xl object-cover" />
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold leading-snug">{title}</p>
                  <p className="mt-1 text-xs text-muted">{[a.seasonYear, a.episodes ? `${a.episodes} eps` : null].filter(Boolean).join(' · ')}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.genres.slice(0, 3).map((g) => (
                      <span key={g} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="line-clamp-6 px-4 text-sm leading-relaxed text-muted">{stripHtml(a.description)}</p>
              <div className="flex flex-wrap gap-2 p-4">
                <ListButton item={mediaToCard(a)} className={pill} />
                <Link to={`/anime/${id}`} onClick={backTo(`/anime/${id}`)} className={cn(pill, 'inline-flex items-center gap-1.5 border-border hover:bg-foreground hover:text-background')}>
                  <Info className="size-4" /> Details
                </Link>
                {sequel && (
                  <Link to={`/watch/${sequel.node.id}`} className={cn(pill, 'border-transparent bg-accent text-accent-fg')}>
                    Next season →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className={cn(pill, 'inline-flex items-center gap-1.5 border-border bg-card hover:border-rose-500/40 hover:text-rose-400')}
                >
                  <Flag className="size-3.5" /> Report Issue
                </button>
              </div>
            </div>
          ) : (
            <Skeleton className="h-64 w-full rounded-3xl" />
          )}

          {/* Official Streams & Creator Support */}
          {bundle?.tmdb?.watchProviders?.providers && bundle.tmdb.watchProviders.providers.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-border bg-card/60 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  <span className="font-semibold text-xs uppercase tracking-wider text-muted">Official Places to Watch</span>
                </div>
                {bundle.tmdb.watchProviders.link && (
                  <a
                    href={bundle.tmdb.watchProviders.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-foreground"
                  >
                    <span>JustWatch</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted mb-3 leading-relaxed">
                We recommend watching on official licensed platforms to support the studios and animators.
              </p>
              <div className="flex flex-wrap gap-2">
                {bundle.tmdb.watchProviders.providers.map((p) => (
                  <a
                    key={p.id}
                    href={bundle.tmdb?.watchProviders?.link || `https://www.google.com/search?q=watch+${encodeURIComponent(title)}+on+${encodeURIComponent(p.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card-2/80 px-2.5 py-1.5 text-xs font-medium transition hover:border-foreground/30 active:scale-95"
                  >
                    {p.logo && (
                      <img
                        src={p.logo}
                        alt={p.name}
                        className="size-4 rounded object-cover shadow-sm"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                      />
                    )}
                    <span>{p.name}</span>
                    <ExternalLink className="size-2.5 text-muted" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
        </div>
      </div>
      {tourOn && !pageTourDone && (
        <Tour
          steps={WATCH_TOUR}
          video={() => document.querySelector<HTMLVideoElement>('.zp video')}
          resume={tourSeen('player')}
          onDone={() => {
            tourDone('watch')
            setTourOn(false)
            setPageTourDone(true)
          }}
        />
      )}

      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Flag className="size-4 text-rose-500" />
                <h3 className="font-display font-bold">Report Stream Issue</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="grid size-8 place-items-center rounded-full hover:bg-card-2 text-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setReportSubmitting(true)
                const res = await submitStreamReport({
                  anime_id: id ? String(id) : undefined,
                  anime_title: title || 'Unknown Anime',
                  episode: String(ep),
                  server: server.name || server.id,
                  audio_type: audio,
                  issue_type: reportIssue,
                  details: reportDetails.trim() || undefined,
                })
                setReportSubmitting(false)
                if (res.success) {
                  toast('Report submitted successfully! Thank you.', 'info')
                  setReportDetails('')
                  setReportOpen(false)
                } else {
                  toast(res.error || 'Failed to submit report', 'error')
                }
              }}
              className="p-4 space-y-4"
            >
              <div>
                <p className="text-xs text-muted mb-2">
                  Reporting <span className="font-semibold text-foreground">{title}</span> · Ep {ep} ({server.name}, {audio.toUpperCase()})
                </p>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">Issue Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Broken / Won't Play", 'Buffering / Slow', 'Wrong Audio / Subs Out of Sync', 'Incorrect Episode', 'Other'].map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setReportIssue(t)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-left text-xs font-medium transition',
                        reportIssue === t ? 'border-accent bg-accent/15 text-accent font-semibold' : 'border-border bg-card-2/50 text-muted hover:text-foreground'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Optional Details</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe playback timestamp or error (optional)..."
                  rows={3}
                  className="w-full rounded-2xl border border-border bg-background/60 p-3 text-xs outline-none focus:border-accent"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
                >
                  {reportSubmitting ? 'Submitting...' : 'Send Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <WatchTogetherModal
        open={watchModalOpen}
        onClose={() => setWatchModalOpen(false)}
        room={room}
        peers={peers}
        onSendReaction={(em) => {
          if (!room) return
          const r = room.sendReaction(em, userProfile.displayName, userProfile.avatar)
          setReactions((prev) => [...prev.slice(-30), r])
        }}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onLeaveRoom={handleLeaveRoom}
        onForceSync={handleForceSync}
        animeTitle={title}
        animeId={id}
        image={a ? (a.bannerImage ?? a.coverImage.extraLarge) : null}
        episode={ep}
        isHost={room ? room.isHost : false}
        connectionStatus={connectionStatus}
        onChangeShowClick={() => setChangeShowOpen(true)}
      />
      <ChangeShowModal
        open={changeShowOpen}
        onClose={() => setChangeShowOpen(false)}
        onSelectShow={handleChangeShow}
        currentAnimeId={id}
      />
    </main>
  )
}
