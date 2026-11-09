import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'framer-motion'
import { ArrowDown, Clapperboard, Crown, EyeOff, Flame, Heart, Loader2, MessageSquare, Pencil, Play, Search, Send, Shuffle, Sparkles, Trash2, Tv, Users, X } from 'lucide-react'
import { DiscordIcon, GithubIcon, TelegramIcon } from '../components/BrandIcons'
import { DISCORD_URL, REPO_URL, TELEGRAM_URL } from '../lib/app'
import { useAniList } from '../lib/anilist'
import { useProfile } from '../lib/profile'
import { useAuth } from '../context/AuthContext'
import { Avatar as RichAvatar } from '../components/Avatar'
import { toast } from '../lib/toast'
import { searchAnime } from '../services/anilist'
import type { AniMedia } from '../types/anime'
import { cn, pickTitle } from '../lib/utils'
import { createCommunityPost, deleteCommunityPost, getCommunityPosts, likeCommunityPost, updateCommunityPost, type CommunityPost } from '../lib/supabase'

/* ------------------------------------------------------------------ data */

const CHANNELS = [
  {
    id: 'General',
    label: 'general',
    icon: MessageSquare,
    desc: 'Anything anime, anytime',
    tint: '#f43f5e',
    starters: ['What are you watching right now?', 'Which anime made you cry the hardest?', 'Best opening of all time, go.', 'What anime did you drop and why?'],
  },
  {
    id: 'Episode Talk',
    label: 'episode-talk',
    icon: Tv,
    desc: 'React to the latest episodes',
    tint: '#38bdf8',
    starters: ['That episode… I have no words.', 'Rate this week’s episode out of 10.', 'Animation of the season so far?', 'Who stole the show this week?'],
  },
  {
    id: 'Recommendations',
    label: 'recommendations',
    icon: Flame,
    desc: 'Hidden gems and sure bets',
    tint: '#f59e0b',
    starters: ['Recommend me something short and great.', 'A hidden gem nobody talks about:', 'Best anime to start with for a newbie?', 'Something that feels like Frieren?'],
  },
  {
    id: 'Theories',
    label: 'theories',
    icon: Sparkles,
    desc: 'Lore, predictions, spoilers',
    tint: '#a78bfa',
    starters: ['My wildest prediction is…', 'Is the villain actually right?', 'A detail everyone missed:', 'How do you think it ends?'],
  },
] as const

type ChannelId = (typeof CHANNELS)[number]['id']

const NAMES = ['Goku_SSJ', 'Luffy_StrawHat', 'Tanjiro_Hashira', 'Gojo_Limitless', 'Zoro_Lost', 'Levi_Captain', 'Frieren_Mage', 'Killua_Lightning', 'Sasuke_Uchiha', 'Naruto_Hokage', 'Mikasa_Scout', 'Deku_OneForAll', 'Sukuna_King', 'Rengoku_Flame', 'Eren_Titan', 'Ichigo_Bankai']
const randomName = () => NAMES[Math.floor(Math.random() * NAMES.length)]
const EMOJIS = ['🔥', '❤️', '✨', '🍿', '😂', '😭', '💯', '👑', '🫡']
const MAX_LEN = 600
const POLL_MS = 4000

const LINKS = [
  { name: 'Discord', note: 'Voice chats and events', href: DISCORD_URL, brand: '#5865F2', icon: <DiscordIcon className="size-5" /> },
  { name: 'Telegram', note: 'Updates and requests', href: TELEGRAM_URL, brand: '#27A7E9', icon: <TelegramIcon className="size-5" /> },
  { name: 'GitHub', note: 'Report bugs, send ideas', href: REPO_URL, brand: '#8b949e', icon: <GithubIcon className="size-5" /> },
]

/* --------------------------------------------------------------- helpers */

function hue(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

const isTemp = (id: string) => id.startsWith('temp-')
const byTime = (a: CommunityPost, b: CommunityPost) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
const signature = (list: CommunityPost[]) => list.map((m) => `${m.id}:${m.likes}:${m.edited ? 1 : 0}:${m.content.length}`).join('|')

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the chat still works */
  }
}

type Row = { kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; msg: CommunityPost; first: boolean; last: boolean }

/** Same author, same day, within five minutes: bubbles stack under one name and avatar. */
function joins(a: CommunityPost | undefined, b: CommunityPost | undefined) {
  if (!a || !b || a.username !== b.username) return false
  const ta = new Date(a.created_at)
  const tb = new Date(b.created_at)
  return ta.toDateString() === tb.toDateString() && Math.abs(tb.getTime() - ta.getTime()) < 5 * 60e3
}

function buildRows(messages: CommunityPost[]): Row[] {
  const rows: Row[] = []
  messages.forEach((msg, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    if (!prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString()) {
      rows.push({ kind: 'day', key: `day-${msg.id}`, label: dayLabel(msg.created_at) })
    }
    rows.push({ kind: 'msg', key: msg.id, msg, first: !joins(prev, msg), last: !joins(msg, next) })
  })
  return rows
}

/* ------------------------------------------------------------ small bits */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

function Avatar({ name, src, frame, size = 36, animateFrame }: { name: string; src?: string | null; frame?: string | null; size?: number; animateFrame?: boolean }) {
  if (src || frame) {
    return <RichAvatar size={size} src={src} frame={frame} name={name} animateFrame={animateFrame} />
  }
  const h = hue(name)
  const style: CSSProperties = { width: size, height: size, fontSize: size * 0.4 }
  return (
    <span
      aria-hidden
      style={{ ...style, background: `linear-gradient(135deg, hsl(${h} 72% 58%), hsl(${(h + 45) % 360} 70% 42%))` }}
      className="grid shrink-0 place-items-center rounded-full font-display font-black text-white ring-1 ring-white/10"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

/** ||spoiler|| text stays blurred until tapped. */
function Spoiler({ children }: { children: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setOpen((o) => !o)
      }}
      aria-label={open ? 'Hide spoiler' : 'Reveal spoiler'}
      className={cn('mx-0.5 inline rounded-md px-1.5 py-px align-baseline transition duration-200', open ? 'bg-black/20' : 'cursor-pointer select-none bg-black/30 blur-[5px] hover:blur-[4px]')}
    >
      {children}
    </button>
  )
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\|\|[^|]+?\|\|)/g)
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((p, i) => (p.length > 4 && p.startsWith('||') && p.endsWith('||') ? <Spoiler key={i}>{p.slice(2, -2)}</Spoiler> : <span key={i}>{p}</span>))}
    </p>
  )
}

function HeartBurst() {
  const bits = [-18, -9, 0, 9, 18]
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-0">
      {bits.map((x, i) => (
        <motion.span
          key={x}
          initial={{ opacity: 1, y: 0, x: 0, scale: 0.4 }}
          animate={{ opacity: 0, y: -26 - (i % 3) * 8, x, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="absolute text-xs text-rose-400"
        >
          ♥
        </motion.span>
      ))}
    </span>
  )
}

/** The tagged show attached to a message. */
function ShowCard({ msg }: { msg: CommunityPost }) {
  const inner = (
    <>
      {msg.anime_image ? <img src={msg.anime_image} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded-lg object-cover" /> : <span className="grid h-14 w-10 shrink-0 place-items-center rounded-lg bg-white/10"><Clapperboard className="size-5" /></span>}
      <span className="min-w-0">
        <span className="block text-xs opacity-75">{msg.category === 'Recommendations' ? 'Recommended' : 'Talking about'}</span>
        <span className="block truncate text-sm font-bold">{msg.anime_title}</span>
        {msg.anime_id && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold opacity-90">
            <Play className="size-2.5 fill-current" />
            Watch on Zenkai
          </span>
        )}
      </span>
    </>
  )
  const cls = 'mb-2 flex items-center gap-2.5 rounded-xl bg-black/25 p-2 transition hover:bg-black/35'
  return msg.anime_id ? <Link to={`/anime/${msg.anime_id}`} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>
}

/** Bottom sheet on phones, centred dialog on larger screens. */
function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div key="sheet" role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70" />
          <motion.div
            initial={{ opacity: 0, y: 56 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 56 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className="relative flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-card shadow-2xl sm:max-w-md sm:rounded-[1.75rem]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-foreground/15 sm:hidden" />
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h3 className="font-display text-base font-bold">{title}</h3>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-foreground/10 hover:text-foreground active:scale-90">
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* --------------------------------------------------- the "pulse" sidebar */

function Pulse({ messages, channelLabel }: { messages: CommunityPost[]; channelLabel: string }) {
  const stats = useMemo(() => {
    const real = messages.filter((m) => !isTemp(m.id))
    const dayAgo = Date.now() - 24 * 3600e3
    const recent = real.filter((m) => new Date(m.created_at).getTime() > dayAgo)
    const voices = new Set((recent.length ? recent : real).map((m) => m.username)).size
    const shows = new Map<string, { id: string; title: string; image: string | null; n: number }>()
    real.forEach((m) => {
      if (!m.anime_id || !m.anime_title) return
      const cur = shows.get(m.anime_id)
      if (cur) cur.n += 1
      else shows.set(m.anime_id, { id: m.anime_id, title: m.anime_title, image: m.anime_image ?? null, n: 1 })
    })
    const loved = real.reduce<CommunityPost | null>((best, m) => (m.likes > 0 && (!best || m.likes > best.likes) ? m : best), null)
    return { today: recent.length, voices, shows: [...shows.values()].sort((a, b) => b.n - a.n).slice(0, 4), loved }
  }, [messages])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-border bg-card-2/60 p-3.5">
          <p className="font-display text-2xl font-black leading-none">{stats.today}</p>
          <p className="mt-1.5 text-xs text-muted">messages today</p>
        </div>
        <div className="rounded-2xl border border-border bg-card-2/60 p-3.5">
          <p className="font-display text-2xl font-black leading-none">{stats.voices}</p>
          <p className="mt-1.5 text-xs text-muted">{stats.voices === 1 ? 'voice' : 'voices'} in #{channelLabel}</p>
        </div>
      </div>

      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
          <Crown className="size-4 text-amber-400" />
          Most loved
        </h4>
        {stats.loved ? (
          <figure className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-3.5">
            <blockquote className="line-clamp-4 break-words text-sm leading-relaxed">{stats.loved.content.replace(/\|\|/g, '▒')}</blockquote>
            <figcaption className="mt-2 flex items-center justify-between text-xs text-muted">
              <span className="truncate font-semibold text-foreground/80">@{stats.loved.username}</span>
              <span className="flex items-center gap-1 text-rose-400">
                <Heart className="size-3 fill-current" />
                {stats.loved.likes}
              </span>
            </figcaption>
          </figure>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-3.5 text-xs leading-relaxed text-muted">Nothing here yet. Give a message a heart and it shows up here.</p>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-sm font-bold">Being talked about</h4>
        {stats.shows.length ? (
          <ul className="space-y-1.5">
            {stats.shows.map((s) => (
              <li key={s.id}>
                <Link to={`/anime/${s.id}`} className="group flex items-center gap-3 rounded-2xl border border-border bg-card-2/40 p-2 transition hover:border-accent/50 hover:bg-card-2">
                  {s.image ? <img src={s.image} alt="" loading="lazy" className="h-12 w-9 shrink-0 rounded-lg object-cover" /> : <span className="grid h-12 w-9 shrink-0 place-items-center rounded-lg bg-foreground/10 text-accent"><Clapperboard className="size-4" /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold group-hover:text-accent">{s.title}</span>
                    <span className="text-xs text-muted">{s.n} {s.n === 1 ? 'mention' : 'mentions'}</span>
                  </span>
                  <Play className="mr-1 size-3.5 shrink-0 text-muted transition group-hover:text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-3.5 text-xs leading-relaxed text-muted">Tag a show in your message and it lands here for everyone to find.</p>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-sm font-bold">Find us elsewhere</h4>
        <ul className="space-y-1.5">
          {LINKS.map((l) => (
            <li key={l.name}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ '--brand': l.brand } as CSSProperties}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card-2/40 p-2.5 transition hover:-translate-y-0.5 hover:border-[var(--brand)] active:scale-[0.98]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground/[0.07] text-muted transition group-hover:bg-[var(--brand)] group-hover:text-white">{l.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{l.name}</span>
                  <span className="block truncate text-xs text-muted">{l.note}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export default function CommunityPage() {
  const anilist = useAniList()
  const profile = useProfile()
  const { user, username: authUsername, signInWithGoogle } = useAuth()

  const defaultName = useMemo(() => {
    if (profile?.name) return profile.name
    if (authUsername) return authUsername
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name
    if (anilist?.user?.name) return anilist.user.name
    try {
      let stored = localStorage.getItem('zk_anon_username') || ''
      if (!stored) {
        stored = randomName()
        localStorage.setItem('zk_anon_username', stored)
      }
      return stored
    } catch {
      return randomName()
    }
  }, [anilist, profile, user, authUsername])

  const [name, setName] = useState(defaultName)
  const [draftName, setDraftName] = useState(defaultName)
  useEffect(() => {
    setName(defaultName)
    setDraftName(defaultName)
  }, [defaultName])

  const authorName =
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    authUsername ||
    anilist?.user?.name ||
    name ||
    'Otaku'

  const authorHandle =
    authUsername ||
    (user?.email ? user.email.split('@')[0] : null) ||
    (anilist?.user?.name ? anilist.user.name.toLowerCase().replace(/[^a-z0-9_-]/g, '') : null) ||
    (name ? name.toLowerCase().replace(/[^a-z0-9_-]/g, '') : null)

  const myAvatar = profile?.avatar || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || anilist?.user?.avatar || null
  const myFrame = profile?.frame || null

  const [channelId, setChannelId] = useState<ChannelId>('General')
  const [messages, setMessages] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const [sentCounter, setSentCounter] = useState(0)
  const mySentIds = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem('zk_my_sent_msgs') || '[]'))
    } catch {
      return new Set<string>()
    }
  }, [sentCounter])

  const [liked, setLiked] = useState<Record<string, true>>(() => readJson('zk_liked_msgs', {}))
  const [burst, setBurst] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const [tagOpen, setTagOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const [tagResults, setTagResults] = useState<AniMedia[]>([])
  const [tagLoading, setTagLoading] = useState(false)
  const [tagged, setTagged] = useState<{ id: number; title: string; image: string } | null>(null)

  const [pulseOpen, setPulseOpen] = useState(false)
  const [nameOpen, setNameOpen] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const [atBottom, setAtBottom] = useState(true)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stick = useRef(true)
  const fresh = useRef<Set<string>>(new Set())
  const firstLoad = useRef(true)
  const timers = useRef<number[]>([])
  const latest = useRef<CommunityPost[]>([])
  latest.current = messages

  const channel = CHANNELS.find((c) => c.id === channelId) ?? CHANNELS[0]


  useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => window.clearTimeout(id))
  }, [])

  const toBottom = useCallback((smooth = false) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    stick.current = true
    setUnseen(0)
  }, [])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    stick.current = near
    setAtBottom(near)
    if (near) setUnseen(0)
  }

  /* load + poll (pauses while the tab is hidden) */
  useEffect(() => {
    document.title = 'Community — Zenkai'
    let alive = true
    firstLoad.current = true
    fresh.current = new Set()
    stick.current = true
    setLoading(true)
    setMessages([])
    setUnseen(0)

    const pull = async () => {
      const data = [...(await getCommunityPosts(channelId))].sort(byTime)
      if (!alive) return
      const settled = latest.current.filter((m) => !isTemp(m.id))
      if (!firstLoad.current) {
        if (signature(settled) === signature(data)) return
        const known = new Set(settled.map((m) => m.id))
        const added = data.filter((m) => !known.has(m.id))
        added.forEach((m) => fresh.current.add(m.id))
        if (added.length && !stick.current) setUnseen((u) => u + added.length)
      }
      setMessages((prev) => [...data, ...prev.filter((m) => isTemp(m.id))])
    }

    void pull().finally(() => {
      if (!alive) return
      firstLoad.current = false
      setLoading(false)
      timers.current.push(window.setTimeout(() => toBottom(), 40))
    })

    const iv = window.setInterval(() => {
      if (!document.hidden && !firstLoad.current) void pull()
    }, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(iv)
    }
  }, [channelId, toBottom])

  useEffect(() => {
    if (stick.current) toBottom()
  }, [messages.length, toBottom])

  /* debounced AniList search for tagging */
  useEffect(() => {
    const q = tagQuery.trim()
    if (!q) {
      setTagResults([])
      setTagLoading(false)
      return
    }
    setTagLoading(true)
    const t = window.setTimeout(async () => {
      try {
        setTagResults((await searchAnime(q)) || [])
      } catch {
        setTagResults([])
      } finally {
        setTagLoading(false)
      }
    }, 280)
    return () => window.clearTimeout(t)
  }, [tagQuery])

  /* composer grows with its text, up to a few lines */
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [text])

  async function send() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    const author = authorName
    const displayAuthor = authorHandle ? `${author} (@${authorHandle})` : author
    const tempId = `temp-${Date.now()}`
    const optimistic: CommunityPost = {
      id: tempId,
      created_at: new Date().toISOString(),
      user_id: user?.id || null,
      username: displayAuthor,
      avatar_url: myAvatar,
      frame: myFrame,
      title: content.slice(0, 60),
      content,
      category: channelId,
      anime_title: tagged?.title ?? null,
      anime_id: tagged ? String(tagged.id) : null,
      anime_image: tagged?.image ?? null,
      likes: 0,
      pinned: false,
      edited: false,
    }
    fresh.current.add(tempId)
    stick.current = true
    setMessages((prev) => [...prev, optimistic])
    setText('')
    setTagged(null)
    try {
      const real = await createCommunityPost({
        user_id: user?.id || null,
        title: optimistic.title,
        content,
        username: displayAuthor,
        avatar_url: myAvatar,
        frame: myFrame,
        category: channelId,
        anime_title: optimistic.anime_title || undefined,
        anime_id: optimistic.anime_id || undefined,
        anime_image: optimistic.anime_image || undefined,
      })
      if (real) {
        fresh.current.add(real.id)
        try {
          const sent = JSON.parse(localStorage.getItem('zk_my_sent_msgs') || '[]');
          if (!sent.includes(real.id)) {
            sent.push(real.id);
            if (sent.length > 200) sent.shift();
            localStorage.setItem('zk_my_sent_msgs', JSON.stringify(sent));
            setSentCounter((c) => c + 1);
          }
        } catch {}
        // the poll may already have delivered the real row: never show it twice
        setMessages((prev) => (prev.some((m) => m.id === real.id) ? prev.filter((m) => m.id !== tempId) : prev.map((m) => (m.id === tempId ? real : m))))
      }
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : 'Could not send that message', 'error')
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setText(content)
    } finally {
      setSending(false)
    }
  }

  function onKey(e: RKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  /** Wraps the selection (or the whole message) as a ||spoiler||. */
  function spoilerize() {
    const el = inputRef.current
    if (!el) return
    const a = el.selectionStart ?? 0
    const b = el.selectionEnd ?? 0
    const hasSel = b > a
    const from = hasSel ? a : 0
    const to = hasSel ? b : text.length
    const inner = text.slice(from, to)
    const next = inner ? `${text.slice(0, from)}||${inner}||${text.slice(to)}` : `${text}||spoiler||`
    setText(next.slice(0, MAX_LEN))
    window.requestAnimationFrame(() => el.focus())
  }

  function spin() {
    const pool = (channel.starters as readonly string[]).filter((s) => s !== text)
    setText(pool[Math.floor(Math.random() * pool.length)])
    inputRef.current?.focus()
  }

  /* message actions */
  const like = useCallback(
    async (m: CommunityPost) => {
      if (liked[m.id] || isTemp(m.id)) return
      setLiked((prev) => {
        const next = { ...prev, [m.id]: true as const }
        writeJson('zk_liked_msgs', next)
        return next
      })
      setBurst(m.id)
      timers.current.push(window.setTimeout(() => setBurst((b) => (b === m.id ? null : b)), 750))
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, likes: x.likes + 1 } : x)))
      await likeCommunityPost(m.id, m.likes)
    },
    [liked],
  )

  async function saveEdit(id: string) {
    const v = editText.trim()
    if (!v || savingEdit) return
    setSavingEdit(true)
    const ok = await updateCommunityPost(id, v)
    setSavingEdit(false)
    if (!ok) {
      if (!user) return toast('Sign in to permanently manage or edit your posts', 'info')
      return toast('Could not save your edit', 'error')
    }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: v, edited: true } : m)))
    setEditId(null)
  }

  async function remove(id: string) {
    setConfirmId(null)
    const ok = await deleteCommunityPost(id)
    if (!ok) {
      if (!user) return toast('Sign in to permanently manage or delete your posts', 'info')
      return toast('Could not delete that message', 'error')
    }
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  function saveName(e: React.FormEvent) {
    e.preventDefault()
    const v = draftName.trim()
    if (!v) return
    setName(v)
    try {
      localStorage.setItem('zk_anon_username', v)
    } catch {
      /* ignore */
    }
    toast(`You’re now @${v}`, 'info')
    setNameOpen(false)
  }

  const openName = () => {
    setDraftName(name)
    setNameOpen(true)
  }

  const rows = useMemo(() => buildRows(messages), [messages])
  const ChannelIcon = channel.icon

  /* -------------------------------------------------------------- render */

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-dvh overflow-x-clip bg-background px-2 pb-24 pt-[4.75rem] text-foreground sm:px-4 md:pb-8" style={{ '--ch': channel.tint } as CSSProperties}>
        {/* ambient glow follows the channel colour */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] opacity-80 [background:radial-gradient(60%_80%_at_50%_0%,color-mix(in_srgb,var(--ch)_22%,transparent),transparent_70%)]" />

        <div className="relative mx-auto grid h-[calc(100dvh-10.75rem)] min-h-[26rem] w-full max-w-7xl overflow-hidden rounded-[1.75rem] border border-border bg-card/90 shadow-2xl shadow-black/30 md:h-[calc(100dvh-6.75rem)] md:max-h-[860px] lg:grid-cols-[15.5rem_minmax(0,1fr)] xl:grid-cols-[15.5rem_minmax(0,1fr)_20rem]">
          <LayoutGroup>
            {/* ------------------------------------------------ left rail (lg+) */}
            <aside className="hidden min-h-0 flex-col border-r border-border bg-card-2/40 lg:flex">
              <div className="px-5 pb-3 pt-5">
                <h1 className="font-display text-lg font-black tracking-tight">Zenkai lounge</h1>
                <p className="mt-0.5 text-xs text-muted">Pick a room and say hi.</p>
              </div>
              <nav aria-label="Channels" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
                {CHANNELS.map((c) => {
                  const Icon = c.icon
                  const active = c.id === channelId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChannelId(c.id)}
                      aria-current={active}
                      className={cn('relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.98]', active ? 'text-foreground' : 'text-muted hover:text-foreground')}
                    >
                      {active && <motion.span layoutId="rail-ind" transition={{ type: 'spring', damping: 30, stiffness: 420 }} className="absolute inset-0 rounded-2xl border border-border bg-card shadow-md" />}
                      <span style={{ background: `color-mix(in srgb, ${c.tint} ${active ? 24 : 12}%, transparent)`, color: c.tint }} className="relative grid size-9 shrink-0 place-items-center rounded-xl transition">
                        <Icon className="size-4" />
                      </span>
                      <span className="relative min-w-0">
                        <span className="block truncate text-sm font-bold">#{c.label}</span>
                        <span className="block truncate text-xs text-muted">{c.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </nav>
              <div className="border-t border-border p-3">
                {user ? (
                  <Link to="/profile" className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-foreground/5 active:scale-[0.98]">
                    <div className="relative shrink-0">
                      <Avatar name={authorName} src={myAvatar} frame={myFrame} size={38} animateFrame />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{authorName}</span>
                      <span className="block truncate text-xs text-accent">@{authorHandle || 'member'}</span>
                    </span>
                    <Pencil className="size-3.5 shrink-0 text-muted" />
                  </Link>
                ) : (
                  <button type="button" onClick={() => void signInWithGoogle()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-3 py-2.5 text-xs font-bold text-background transition hover:opacity-90 active:scale-95">
                    <GoogleIcon className="size-4" />
                    <span>Sign in to chat</span>
                  </button>
                )}
              </div>
            </aside>

            {/* ------------------------------------------------------ chat */}
            <main className="relative flex min-h-0 min-w-0 flex-col">
              <header className="border-b border-border">
                <div className="flex items-center gap-3 px-3.5 py-3 sm:px-5">
                  <span style={{ background: 'color-mix(in srgb, var(--ch) 20%, transparent)', color: 'var(--ch)' }} className="grid size-10 shrink-0 place-items-center rounded-2xl">
                    <ChannelIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-base font-bold leading-tight">#{channel.label}</h2>
                    <p className="truncate text-xs text-muted">{channel.desc}</p>
                  </div>
                  <button type="button" onClick={openName} className="flex items-center gap-2 rounded-full border border-border bg-card-2/60 py-1 pl-1 pr-3 text-xs font-semibold transition hover:border-accent/50 active:scale-95 lg:hidden" aria-label="Change your name">
                    <Avatar name={name} src={myAvatar} size={26} />
                    <span className="max-w-[6.5rem] truncate">@{name}</span>
                  </button>
                  <button type="button" onClick={() => setPulseOpen(true)} aria-label="Open room pulse" className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card-2/60 text-muted transition hover:border-accent/50 hover:text-foreground active:scale-90 xl:hidden">
                    <Users className="size-4" />
                  </button>
                </div>

                {/* channel pills (below lg) */}
                <div role="tablist" aria-label="Channels" className="no-scrollbar flex gap-1.5 overflow-x-auto px-3.5 pb-3 sm:px-5 lg:hidden">
                  {CHANNELS.map((c) => {
                    const active = c.id === channelId
                    const Icon = c.icon
                    return (
                      <button key={c.id} role="tab" aria-selected={active} type="button" onClick={() => setChannelId(c.id)} className={cn('relative flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95', active ? 'border-transparent text-white' : 'border-border text-muted hover:text-foreground')}>
                        {active && <motion.span layoutId="pill-ind" transition={{ type: 'spring', damping: 30, stiffness: 420 }} style={{ background: c.tint }} className="absolute inset-0 rounded-full" />}
                        <Icon className="relative size-3.5" />
                        <span className="relative">{c.label}</span>
                      </button>
                    )
                  })}
                </div>
              </header>

              {/* messages */}
              <div className="relative min-h-0 flex-1">
                <div ref={scrollRef} onScroll={onScroll} className="absolute inset-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5" style={{ overflowAnchor: 'auto' }}>
                  {loading ? (
                    <div className="space-y-4" aria-label="Loading messages">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className={cn('flex items-end gap-2.5', i % 2 === 1 && 'flex-row-reverse')}>
                          <div className="skeleton size-9 shrink-0 rounded-full" />
                          <div className="skeleton h-12 rounded-2xl" style={{ width: `${48 + ((i * 17) % 32)}%` }} />
                        </div>
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center py-6 text-center">
                      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: 'color-mix(in srgb, var(--ch) 18%, transparent)', color: 'var(--ch)' }} className="grid size-16 place-items-center rounded-3xl">
                        <ChannelIcon className="size-8" />
                      </motion.div>
                      <h3 className="mt-4 font-display text-lg font-bold">#{channel.label} is waiting for you</h3>
                      <p className="mt-1 text-sm text-muted">Start the conversation. Tap a starter or write your own.</p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {(channel.starters as readonly string[]).map((s) => (
                          <button key={s} type="button" onClick={() => { setText(s); inputRef.current?.focus() }} className="rounded-2xl border border-border bg-card-2/60 px-3.5 py-2 text-left text-xs font-medium transition hover:-translate-y-0.5 hover:border-[var(--ch)] active:scale-95">
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {rows.map((row) => {
                        if (row.kind === 'day') {
                          return (
                            <div key={row.key} className="my-4 flex items-center gap-3 text-xs font-medium text-muted">
                              <span className="h-px flex-1 bg-border" />
                              {row.label}
                              <span className="h-px flex-1 bg-border" />
                            </div>
                          )
                        }
                        const { msg, first, last } = row
                        const pending = isTemp(msg.id)
                        const isMe = pending
                          ? true
                          : Boolean(
                              (user?.id && msg.user_id && msg.user_id === user.id) ||
                              (authorHandle && msg.username.includes(`@${authorHandle}`)) ||
                              mySentIds.has(msg.id)
                            )
                        const isLiked = !!liked[msg.id]
                        const editing = editId === msg.id
                        const showLike = msg.likes > 0 || isLiked
                        const matchHandle = msg.username.match(/@([a-zA-Z0-9_-]+)/)
                        const authorHandleFromMsg = matchHandle ? matchHandle[1] : (msg.username.startsWith('@') ? msg.username.slice(1) : undefined)
                        const profileLink = isMe ? (authorHandle ? `/u/${authorHandle}` : '/profile') : (authorHandleFromMsg ? `/u/${authorHandleFromMsg}` : undefined)

                        const msgAvatar = pending ? myAvatar : (msg.avatar_url || null)
                        const msgFrame = pending ? myFrame : (msg.frame || null)
                        const msgName = pending ? authorName : (msg.username || 'Otaku')

                        return (
                          <motion.div
                            key={row.key}
                            initial={fresh.current.has(msg.id) ? { opacity: 0, y: 12, scale: 0.97 } : false}
                            animate={{ opacity: pending ? 0.6 : 1, y: 0, scale: 1 }}
                            transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                            className={cn('group/msg flex gap-2.5', isMe && 'flex-row-reverse', first ? 'mt-3.5' : 'mt-0.5')}
                          >
                            <div className="w-9 shrink-0 self-end">
                              {last && (
                                profileLink ? (
                                  <Link to={profileLink} title="View public profile" className="transition hover:opacity-80 active:scale-95">
                                    <Avatar name={msgName} src={msgAvatar} frame={msgFrame} size={36} animateFrame={Boolean(msgFrame)} />
                                  </Link>
                                ) : (
                                  <Avatar name={msgName} src={msgAvatar} frame={msgFrame} size={36} animateFrame={Boolean(msgFrame)} />
                                )
                              )}
                            </div>
                            <div className={cn('flex min-w-0 max-w-[85%] flex-col sm:max-w-[72%]', isMe ? 'items-end' : 'items-start')}>
                              {first && (
                                <div className={cn('mb-1 flex items-center gap-1.5 px-1 text-xs text-muted', isMe && 'flex-row-reverse')}>
                                  {profileLink ? (
                                    <Link to={profileLink} className="font-semibold text-foreground/90 hover:text-accent hover:underline">
                                      {isMe ? `${msgName} (You)` : msgName}
                                    </Link>
                                  ) : (
                                    <span className="font-semibold text-foreground/90">{isMe ? `${msgName} (You)` : msgName}</span>
                                  )}
                                  <span>{timeOf(msg.created_at)}</span>
                                  {msg.edited && <span className="italic">edited</span>}
                                </div>
                              )}

                              <div
                                onDoubleClick={() => void like(msg)}
                                className={cn(
                                  'relative w-fit max-w-full rounded-[1.25rem] px-3.5 py-2 text-[0.9rem] leading-relaxed',
                                  isMe ? 'bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--accent)_72%,#000)] text-accent-fg shadow-md shadow-accent/20' : 'border border-border bg-card-2 text-foreground',
                                  last && (isMe ? 'rounded-br-md' : 'rounded-bl-md'),
                                )}
                              >
                                {msg.anime_title && <ShowCard msg={msg} />}

                                {editing ? (
                                  <div className="w-[min(18rem,70vw)] space-y-2 py-0.5">
                                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} maxLength={MAX_LEN} autoFocus className="w-full resize-none rounded-xl border border-white/30 bg-black/40 p-2 text-sm text-white outline-none focus:border-white" />
                                    <div className="flex justify-end gap-1.5">
                                      <button type="button" onClick={() => setEditId(null)} className="rounded-lg bg-black/30 px-3 py-1 text-xs font-semibold text-white/85 hover:bg-black/50">Cancel</button>
                                      <button type="button" disabled={savingEdit || !editText.trim()} onClick={() => void saveEdit(msg.id)} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-black disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save'}</button>
                                    </div>
                                  </div>
                                ) : (
                                  <RichText text={msg.content} />
                                )}
                              </div>

                              {/* reactions + own-message actions */}
                              {!editing && !pending && (
                                <div className={cn('mt-1 flex items-center gap-1 px-1', isMe && 'flex-row-reverse')}>
                                  <span className="relative">
                                    {burst === msg.id && <HeartBurst />}
                                    <button
                                      type="button"
                                      onClick={() => void like(msg)}
                                      aria-label={isLiked ? 'You liked this' : 'Like this message'}
                                      aria-pressed={isLiked}
                                      className={cn(
                                        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition active:scale-90',
                                        showLike ? 'opacity-100' : 'opacity-60 sm:opacity-0 sm:group-hover/msg:opacity-100 sm:focus-visible:opacity-100',
                                        isLiked ? 'border-rose-500/40 bg-rose-500/10 text-rose-400' : 'border-border text-muted hover:text-rose-400',
                                      )}
                                    >
                                      <Heart className={cn('size-3 transition', isLiked && 'scale-110 fill-current')} />
                                      {msg.likes > 0 && <span className="font-semibold tabular-nums">{msg.likes}</span>}
                                    </button>
                                  </span>
                                  {isMe && (
                                    <span className="flex items-center gap-0.5 opacity-70 transition sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover/msg:opacity-100">
                                      {confirmId === msg.id ? (
                                        <>
                                          <button type="button" onClick={() => void remove(msg.id)} className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400 hover:bg-red-500/25">Delete</button>
                                          <button type="button" onClick={() => setConfirmId(null)} className="rounded-full px-2 py-0.5 text-xs text-muted hover:text-foreground">Keep</button>
                                        </>
                                      ) : (
                                        <>
                                          <button type="button" onClick={() => { setEditId(msg.id); setEditText(msg.content) }} aria-label="Edit message" className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-foreground/10 hover:text-foreground"><Pencil className="size-3" /></button>
                                          <button type="button" onClick={() => setConfirmId(msg.id)} aria-label="Delete message" className="grid size-6 place-items-center rounded-full text-muted transition hover:bg-red-500/10 hover:text-red-400"><Trash2 className="size-3" /></button>
                                        </>
                                      )}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* jump to latest */}
                <AnimatePresence>
                  {!atBottom && !loading && (
                    <motion.button
                      key="latest"
                      type="button"
                      initial={{ opacity: 0, y: 12, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.9 }}
                      onClick={() => toBottom(true)}
                      className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold shadow-xl transition hover:border-accent active:scale-95"
                    >
                      <ArrowDown className="size-3.5 text-accent" />
                      {unseen > 0 ? `${unseen} new ${unseen === 1 ? 'message' : 'messages'}` : 'Latest'}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* composer */}
              <div className="border-t border-border bg-card/60 px-2.5 pb-2.5 pt-2 sm:px-4 sm:pb-3.5">
                <AnimatePresence initial={false}>
                  {tagged && (
                    <motion.div key="tag" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mb-2 flex items-center gap-2.5 rounded-2xl border border-accent/30 bg-accent/10 p-1.5 pr-2.5">
                        <img src={tagged.image} alt="" className="h-10 w-7 rounded-md object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-muted">{channelId === 'Recommendations' ? 'Recommending' : 'Talking about'}</span>
                          <span className="block truncate text-sm font-bold">{tagged.title}</span>
                        </span>
                        <button type="button" onClick={() => setTagged(null)} aria-label="Remove tagged show" className="grid size-7 place-items-center rounded-full text-muted hover:bg-foreground/10 hover:text-foreground"><X className="size-3.5" /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mb-2 flex items-center gap-1.5">
                  <button type="button" onClick={() => { setTagQuery(''); setTagOpen(true) }} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95', tagged ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border text-muted hover:text-foreground')}>
                    <Clapperboard className="size-3.5" />
                    <span>{tagged ? 'Change show' : 'Tag a show'}</span>
                  </button>
                  <button type="button" onClick={spoilerize} className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-foreground active:scale-95" title="Hide the selection (or your whole message) behind a spoiler blur" aria-label="Spoiler">
                    <EyeOff className="size-3.5" />
                    <span className="hidden min-[400px]:inline">Spoiler</span>
                  </button>
                  <button type="button" onClick={spin} className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-foreground active:scale-95" title="Need a conversation starter?" aria-label="Spin a topic">
                    <Shuffle className="size-3.5" />
                    <span className="hidden min-[400px]:inline">Spin a topic</span>
                  </button>
                  <div className="no-scrollbar ml-1 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:flex">
                    {EMOJIS.map((em) => (
                      <button key={em} type="button" onClick={() => { setText((t) => (t + em).slice(0, MAX_LEN)); inputRef.current?.focus() }} className="shrink-0 rounded-full px-1.5 py-0.5 text-base transition hover:scale-125 hover:bg-foreground/10 active:scale-90" aria-label={`Add ${em}`}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-end gap-2 rounded-[1.5rem] border border-border bg-card-2/70 p-1.5 pl-4 transition focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
                    onKeyDown={onKey}
                    rows={1}
                    enterKeyHint="send"
                    placeholder={`Message #${channel.label}`}
                    aria-label={`Message #${channel.label}`}
                    className="max-h-32 min-h-9 flex-1 resize-none self-center bg-transparent py-1.5 text-[0.95rem] leading-snug text-foreground outline-none placeholder:text-muted"
                  />
                  {text.length > MAX_LEN - 120 && <span className={cn('self-center pr-1 text-xs tabular-nums', text.length >= MAX_LEN ? 'text-red-400' : 'text-muted')}>{MAX_LEN - text.length}</span>}
                  <button type="button" onClick={() => void send()} disabled={!text.trim() || sending} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-fg shadow-lg shadow-accent/30 transition enabled:hover:brightness-110 enabled:active:scale-90 disabled:opacity-35">
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="ml-0.5 size-4" />}
                  </button>
                </div>
                <p className="mt-1.5 hidden px-2 text-xs text-muted sm:block">Enter to send, Shift+Enter for a new line. Double-click a message to heart it. Wrap words in ||bars|| to hide spoilers.</p>
              </div>
            </main>

            {/* ------------------------------------------------ pulse (xl+) */}
            <aside className="hidden min-h-0 overflow-y-auto border-l border-border bg-card-2/30 p-4 xl:block">
              <h2 className="mb-4 font-display text-base font-bold">Room pulse</h2>
              <Pulse messages={messages} channelLabel={channel.label} />
            </aside>
          </LayoutGroup>
        </div>
      </div>

      {/* ----------------------------------------------------------- sheets */}
      <Sheet open={pulseOpen} onClose={() => setPulseOpen(false)} title="Room pulse">
        <Pulse messages={messages} channelLabel={channel.label} />
      </Sheet>

      <Sheet open={tagOpen} onClose={() => setTagOpen(false)} title="Tag a show">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="Search AniList: Frieren, Dandadan…"
            autoFocus
            className="h-11 w-full rounded-2xl border border-border bg-card-2/70 pl-10 pr-10 text-sm outline-none placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
          {tagLoading && <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
        </div>
        <ul className="mt-3 max-h-[46dvh] space-y-1 overflow-y-auto">
          {tagResults.map((m) => {
            const title = pickTitle(m.title)
            const image = m.coverImage.large || m.coverImage.extraLarge || ''
            return (
              <li key={m.id}>
                <button type="button" onClick={() => { setTagged({ id: m.id, title, image }); setTagOpen(false); inputRef.current?.focus() }} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-foreground/5 active:scale-[0.98]">
                  <img src={image} alt="" loading="lazy" className="h-14 w-10 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{title}</span>
                    <span className="block truncate text-xs text-muted">{[m.format, m.seasonYear, m.genres?.[0]].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {!tagResults.length && (
          <p className="py-6 text-center text-sm text-muted">{tagQuery.trim() && !tagLoading ? 'No shows found. Try another spelling.' : 'Type a title and tap it to attach a card to your message.'}</p>
        )}
      </Sheet>

      <Sheet open={nameOpen} onClose={() => setNameOpen(false)} title="Your chat name">
        <form onSubmit={saveName} className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={draftName || name} src={myAvatar} size={52} />
            <div className="relative flex-1">
              <input value={draftName} onChange={(e) => setDraftName(e.target.value.slice(0, 24))} placeholder="e.g. Deku_OneForAll" required autoFocus className="h-11 w-full rounded-2xl border border-border bg-card-2/70 pl-4 pr-12 text-sm font-semibold outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20" />
              <button type="button" onClick={() => setDraftName(randomName())} aria-label="Pick a random name" title="Random name" className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl text-muted transition hover:bg-foreground/10 hover:text-foreground active:scale-90">
                <Shuffle className="size-4" />
              </button>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted">No account needed to chat. Your nickname and messages are remembered on this device. Connect AniList in your profile or sign in with Google for a verified profile badge.</p>
          {!user && (
            <div className="rounded-2xl border border-border/80 bg-foreground/5 p-3">
              <button
                type="button"
                onClick={() => {
                  setNameOpen(false)
                  void signInWithGoogle()
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-3 py-2 text-xs font-bold text-background transition hover:opacity-90 active:scale-95"
              >
                <GoogleIcon className="size-4" />
                <span>Sign in with Google</span>
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNameOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:text-foreground">Cancel</button>
            <button type="submit" className="rounded-xl bg-accent px-5 py-2 text-sm font-bold text-accent-fg hover:brightness-110 active:scale-95">Save</button>
          </div>
        </form>
      </Sheet>
    </MotionConfig>
  )
}
