import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Tv,
  Radio,
  MonitorPlay,
  ArrowRight,
  Play,
  Compass,
  MessageSquare,
  Mic,
  Loader2,
  ClipboardCopy,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Film,
} from 'lucide-react'
import { getWatchRoom } from '../lib/watchRooms'
import { useHistory, type HistoryItem } from '../lib/library'
import { useTmdb } from '../hooks/useTmdb'
import { tmdbImg } from '../services/api'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'

/** Intelligent room code extractor: handles both pure codes and full URLs */
function extractRoomCode(raw: string): string {
  const trimmed = raw.trim()
  const match = trimmed.match(/[?&]room=([a-zA-Z0-9_-]+)/i)
  if (match) return match[1].toLowerCase()
  return trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12)
}

function HostShowItem({ item }: { item: HistoryItem }) {
  const tmdbBundle = useTmdb(item.id, item.title, item.format)
  const tmdbBackdrop = tmdbImg(tmdbBundle?.tmdb?.backdrop, 'w780')
  const image = tmdbBackdrop || item.image

  const hostHref = `/watch/${item.id}?ep=${item.ep}&server=${item.server}&audio=${item.audio}&createRoom=1`

  return (
    <div className="group relative flex items-center justify-between gap-3.5 rounded-2xl border border-border bg-card-2/50 p-2.5 transition-all hover:border-foreground/20 hover:bg-card-2/80">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative aspect-[16/10] w-20 shrink-0 overflow-hidden rounded-xl bg-card border border-border shadow-sm">
          {image ? (
            <img
              src={image}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-card-2 text-muted">
              <Film className="size-4" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h4 className="line-clamp-1 text-xs sm:text-sm font-semibold text-foreground tracking-tight group-hover:text-accent transition-colors">
            {item.title}
          </h4>
          <p className="text-[11px] text-muted mt-0.5">
            Ep {item.ep} · {item.audio?.toUpperCase() || 'SUB'}
          </p>
        </div>
      </div>

      <Link
        to={hostHref}
        className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-xl bg-foreground px-3 text-[11px] font-bold text-background transition hover:opacity-90 active:scale-95 shadow-sm"
      >
        <Play className="size-3 fill-current" />
        <span className="hidden sm:inline">Host Room</span>
      </Link>
    </div>
  )
}

export default function WatchPartyPage() {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const history = useHistory()
  const recentHistory = history.slice(0, 3)

  useEffect(() => {
    document.title = 'WatchParty — Zenkai'
    inputRef.current?.focus()
  }, [])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = extractRoomCode(code)
    if (clean.length < 3 || joining) return

    setJoining(true)
    try {
      const rec = await getWatchRoom(clean)
      if (!rec) {
        toast('Watch party not found or expired', 'error')
        return
      }
      toast(`Joining party room ${clean.toUpperCase()}!`, 'success')
      navigate(`/watch/${rec.anime_id}?room=${clean}&ep=${rec.episode}&server=${rec.server}&audio=${rec.audio}`)
    } catch (err) {
      console.error('[WatchParty] Join error:', err)
      toast('Failed to connect to watch party', 'error')
    } finally {
      setJoining(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const clean = extractRoomCode(text)
      if (clean) {
        setCode(clean)
        inputRef.current?.focus()
      }
    } catch {
      inputRef.current?.focus()
    }
  }

  return (
    <main className="min-h-[85svh] pb-24 pt-10 sm:pt-14 select-none">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Header with Broadcast & Communication Badges */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <Radio className="size-3.5 text-foreground" />
            <span>Synchronized Cinema Network</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground mt-4">
            Watch Together
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm text-muted leading-relaxed">
            Watch anime with friends in real-time sync. Ultra-low-latency playback, live audio voice channel, and instant room reactions.
          </p>
        </div>

        {/* Dual Layout: Join Room (Left) & Host Room (Right) */}
        <div className="mt-8 sm:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
          {/* Card 1: Join Active Room (7 Cols) */}
          <section className="lg:col-span-7 rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3.5 pb-5 border-b border-border">
                <div className="grid size-12 place-items-center rounded-2xl border border-border bg-card-2 text-foreground shrink-0 shadow-sm">
                  <Tv className="size-5 stroke-[2]" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
                    Join with Room Code
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Enter the code or paste the link from your friend.
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleJoin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="party-code-input" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                    Room Code / Invite Link
                  </label>

                  <div className="relative">
                    <input
                      id="party-code-input"
                      ref={inputRef}
                      type="text"
                      value={code}
                      maxLength={64}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="ENTER CODE OR PASTE LINK"
                      autoComplete="off"
                      spellCheck="false"
                      className="w-full h-14 rounded-2xl border border-border bg-card-2/80 px-4 text-center font-mono text-lg sm:text-xl font-bold tracking-[0.2em] uppercase text-foreground placeholder:text-muted/60 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs sm:placeholder:text-sm focus:border-foreground focus:bg-card focus:outline-none transition-all shadow-inner"
                    />

                    {/* Quick Paste Button */}
                    <button
                      type="button"
                      onClick={handlePaste}
                      title="Paste from clipboard"
                      className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-card-2 transition-colors shadow-sm"
                    >
                      <ClipboardCopy className="size-3" />
                      <span>Paste</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={extractRoomCode(code).length < 3 || joining}
                  className={cn(
                    'w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md',
                    extractRoomCode(code).length >= 3 && !joining
                      ? 'bg-foreground text-background hover:opacity-90'
                      : 'bg-card-2 text-muted cursor-not-allowed border border-border opacity-60'
                  )}
                >
                  {joining ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Connecting to room...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Room</span>
                      <ArrowRight className="size-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Feature Pills (Clean Communication / Broadcast Icons) */}
            <div className="mt-8 pt-6 border-t border-border grid grid-cols-3 gap-2.5 text-center">
              <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-card-2/50 border border-border/60">
                <Radio className="size-4 text-foreground" />
                <span className="text-[11.5px] font-semibold text-foreground">Sync Playback</span>
                <span className="text-[10px] text-muted">Sub-50ms sync</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-card-2/50 border border-border/60">
                <Mic className="size-4 text-foreground" />
                <span className="text-[11.5px] font-semibold text-foreground">Voice Audio</span>
                <span className="text-[10px] text-muted">Live mic channel</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-card-2/50 border border-border/60">
                <MessageSquare className="size-4 text-foreground" />
                <span className="text-[11.5px] font-semibold text-foreground">Room Chat</span>
                <span className="text-[10px] text-muted">Live reactions</span>
              </div>
            </div>
          </section>

          {/* Card 2: Host a Party (5 Cols) */}
          <section className="lg:col-span-5 rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3.5 pb-5 border-b border-border">
                <div className="grid size-12 place-items-center rounded-2xl border border-border bg-card-2 text-foreground shrink-0 shadow-sm">
                  <MonitorPlay className="size-5 stroke-[2]" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground tracking-tight">
                    Host a Room
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Start a room and invite your friends.
                  </p>
                </div>
              </div>

              {/* Host Options */}
              <div className="mt-6 space-y-3">
                {recentHistory.length > 0 ? (
                  <>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                      Pick Up from Watch History
                    </span>
                    <div className="space-y-2">
                      {recentHistory.map((item) => (
                        <HostShowItem key={item.id} item={item} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                    <Tv className="size-7 text-muted mx-auto" />
                    <p className="text-xs text-foreground font-semibold mt-2">
                      No watch history yet
                    </p>
                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                      Pick any anime title from the catalog to launch a new synchronized watch room.
                    </p>
                  </div>
                )}

                <Link
                  to="/browse"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card-2 text-xs font-semibold text-foreground hover:bg-card-2/80 transition active:scale-[0.98] shadow-sm mt-3"
                >
                  <Compass className="size-3.5" />
                  <span>Browse Anime Catalog to Host</span>
                </Link>
              </div>
            </div>

            {/* How Hosting Works Checklist */}
            <div className="mt-8 pt-5 border-t border-border space-y-2.5 text-xs text-muted">
              <div className="flex items-center gap-2.5 text-[11.5px]">
                <CheckCircle2 className="size-3.5 text-foreground shrink-0" />
                <span>Host controls video play, pause & episodes</span>
              </div>
              <div className="flex items-center gap-2.5 text-[11.5px]">
                <Zap className="size-3.5 text-foreground shrink-0" />
                <span>Instant code & shareable link generation</span>
              </div>
              <div className="flex items-center gap-2.5 text-[11.5px]">
                <ShieldCheck className="size-3.5 text-foreground shrink-0" />
                <span>Private peer-to-peer room security</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
