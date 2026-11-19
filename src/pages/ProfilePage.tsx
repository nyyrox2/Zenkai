import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  Lock,
  LockOpen,
  ChevronRight,
  Cloud,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserCheck,
  ChevronsUp,
  Check,
} from 'lucide-react'
import { AccountPanel, AuthPanel } from '../components/CloudSyncCard'
import { useAuth } from '../context/AuthContext'
import { AniListCard } from '../components/AniListCard'
import { ProfileEditor, ProfileHero, type SectionKey } from '../components/ProfileCustomizer'
import { CustomSelect } from '../components/CustomSelect'
import { DISCORD_URL, REPO_URL, TELEGRAM_URL } from '../lib/app'
import { getPrefs, savePrefs, setStatus, useCustomLists, useList, type Audio } from '../lib/library'
import { WatchlistPanel } from '../components/WatchlistPanel'
import { useWatchlistPrivacy } from '../lib/watchlistPrivacy'
import { useProfile } from '../lib/profile'
import { DIRECT } from '../lib/servers'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { useTheme } from '../context/ThemeContext'
import { useFlag } from '../hooks/useFlag'
import { supabase } from '../lib/supabase'
import {
  getAscensionState,
  ascensionCell,
  claimQuestReward,
} from '../lib/ascension/ascensionStore'
import {
  DAILY_QUEST_TEMPLATES,
  WEEKLY_QUEST_TEMPLATES,
} from '../lib/ascension/types'

type TabKey = 'watchlist' | 'preferences' | 'ascension' | 'account' | 'anilist' | 'legal'

const h2 = 'font-display text-xl font-bold'

/** A string kept in localStorage (empty string = unset). */
function useStored(key: string): [string, (v: string) => void] {
  const [v, setV] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  })
  return [
    v,
    (n) => {
      setV(n)
      try {
        if (n) localStorage.setItem(key, n)
        else localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
  ]
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-7 w-12 rounded-full border transition',
        on ? 'border-transparent bg-accent' : 'border-border bg-card-2'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
          on ? 'left-6' : 'left-0.5'
        )}
      />
    </button>
  )
}

const LANGS = ['ja', 'en', 'hi', 'es', 'pt', 'fr', 'de', 'it', 'ar', 'ru', 'ko', 'zh']
const langName = (c: string) => new Intl.DisplayNames(['en'], { type: 'language' }).of(c) ?? c

export default function ProfilePage() {
  const me = useProfile()
  const { user, loading } = useAuth()
  const { theme, setTheme } = useTheme()

  const [editing, setEditing] = useState(false)
  const [editTab, setEditTab] = useState<SectionKey>('identity')
  const [activeTab, setActiveTab] = useState<TabKey>('preferences')
  const customLists = useCustomLists()
  const privacy = useWatchlistPrivacy(user?.id)
  const list = useList()

  const [prefs, setPrefs] = useState(getPrefs)
  const [autoNext, setAutoNext] = useFlag('zk:autonext', true)
  const [autoSkip, setAutoSkip] = useFlag('zk:autoskip', false)
  const [skipFiller, setSkipFiller] = useFlag('zk:skipfiller', false)
  const [layout, setLayout] = useStored('zk:eplayout')
  const [lang, setLang] = useStored('zp-alang')
  const [maxQ, setMaxQ] = useStored('zp-q')

  const [ascensionState, setAscensionState] = useState(getAscensionState())
  const [claimLoading, setClaimLoading] = useState<string | null>(null)

  useEffect(() => {
    return ascensionCell.subscribe(() => {
      setAscensionState(getAscensionState())
    })
  }, [])

  const handleClaimQuest = async (questId: string) => {
    setClaimLoading(questId)
    const ok = await claimQuestReward(questId)
    setClaimLoading(null)
    if (ok) toast('Reward claimed! XP added.')
  }

  useEffect(() => {
    // Intercept OAuth callback parameters in URL (PKCE code, implicit hash tokens, or errors)
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '')

    const err = searchParams.get('error_description') || searchParams.get('error') || hashParams.get('error_description') || hashParams.get('error')
    if (err) {
      toast(`Sign in notice: ${decodeURIComponent(err.replace(/\+/g, ' '))}`, 'error')
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }

    const code = searchParams.get('code')
    if (code) {
      void supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (!error && data.session) {
          toast('Signed in successfully!')
        } else if (error) {
          toast(error.message, 'error')
        }
        window.history.replaceState({}, document.title, window.location.pathname)
      })
      return
    }

    const accessToken = hashParams.get('access_token')
    if (accessToken) {
      const refreshToken = hashParams.get('refresh_token') || ''
      void supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
        if (!error && data.session) {
          toast('Signed in successfully!')
        }
        window.history.replaceState({}, document.title, window.location.pathname)
      })
    }
  }, [])

  useEffect(() => {
    document.title = editing ? 'Edit Profile — Zenkai' : 'Profile — Zenkai'
    document.documentElement.dataset.zkMono = ''
    if (location.hash === '#legal') {
      setActiveTab('legal')
      window.setTimeout(() => document.getElementById('legal')?.scrollIntoView({ behavior: 'smooth' }), 150)
    }
    return () => {
      delete document.documentElement.dataset.zkMono
    }
  }, [editing])

  useEffect(() => {
    const handleScroll = () => {
      const sectionIds = ['preferences', 'account', 'ascension', 'watchlist', 'legal'] as const
      const scrollPosition = window.scrollY + 140
      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveTab(id)
            break
          }
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    setActiveTab(id as any)
    const el = document.getElementById(id)
    if (el) {
      const yOffset = -72
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const startEdit = (tab?: SectionKey) => {
    if (tab) setEditTab(tab)
    setEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const setPref = (p: { server?: string; audio?: Audio }) => {
    savePrefs(p)
    setPrefs(getPrefs())
    if (p.audio) toast(`Default audio: ${p.audio === 'sub' ? 'Sub' : 'Dub'}`)
    if (p.server) toast(`Preferred server: ${DIRECT.find((d) => d.id === p.server)?.name ?? p.server}`)
  }
  const flag = (set: (v: boolean) => void, label: string) => (v: boolean) => {
    set(v)
    toast(`${label} ${v ? 'on' : 'off'}`)
  }

  const SECTIONS = [
    { id: 'preferences' as const, label: 'Preferences', icon: SlidersHorizontal },
    { id: 'account' as const, label: user ? 'Cloud & Sync' : 'Sign in', icon: user ? Cloud : UserCheck, badge: user ? 'Connected' : null },
    { id: 'ascension' as const, label: 'Ascension Quests', icon: ChevronsUp, badge: `Lv.${ascensionState.level}` },
    { id: 'watchlist' as const, label: 'Watchlist', icon: Bookmark, badge: list.length > 0 ? `${list.length}` : null },
    { id: 'legal' as const, label: 'About & Legal', icon: ShieldCheck },
  ]

  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pt-10">
      {editing ? (
        <ProfileEditor me={me} initialTab={editTab} onClose={() => setEditing(false)} />
      ) : (
        <div className="space-y-6">
          {/* 1. Unified Profile Hero Header */}
          <ProfileHero me={me} onEdit={startEdit} />

          {!loading && !user && (
            <button
              type="button"
              onClick={() => scrollTo('account')}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 text-left transition hover:border-foreground/40 active:scale-[0.99]"
            >
              <UserCheck className="size-5 shrink-0" />
              <span className="min-w-0 flex-1 text-sm"><b>Sign in</b> <span className="text-muted">to back up your history, watchlist and XP across devices.</span></span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>
          )}

          {/* Section Navigation Jump Pills */}
          <div className="sticky top-16 z-20 flex gap-2 overflow-x-auto pb-1.5 pt-1.5 no-scrollbar border-b border-border/60 bg-background/80 backdrop-blur">
            {SECTIONS.map(({ id, label, icon: Icon, badge }) => {
              const on = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition active:scale-95',
                    on
                      ? 'border-foreground/30 bg-foreground/10 text-foreground shadow-sm'
                      : 'border-transparent bg-transparent text-muted hover:border-border/60 hover:text-foreground'
                  )}
                >
                  <Icon className="size-4" />
                  <span>{label}</span>
                  {badge && (
                    <span className="rounded-full bg-foreground/15 px-2 py-0.5 text-[10px] font-black text-foreground uppercase">
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 1. Player & App Preferences */}
          <section
            id="preferences"
            className="scroll-mt-28 rounded-3xl border border-border bg-card/60 p-5 sm:p-7 shadow-lg"
            aria-label="Settings & Preferences"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className={h2}>Player &amp; App Preferences</h2>
                <p className="mt-1 text-xs text-muted">
                  Configure your streaming experience, auto-skip options, and video defaults.
                </p>
              </div>
            </div>

            <Row title="Theme">
              <div className="inline-flex gap-1 rounded-full border border-border bg-card/60 p-1">
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTheme(t)
                      if (t !== theme) toast(`${t === 'dark' ? 'Dark' : 'Light'} theme on`)
                    }}
                    aria-pressed={theme === t}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold capitalize transition',
                      theme === t ? 'bg-foreground text-background' : 'text-muted'
                    )}
                  >
                    {t === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
                    {t}
                  </button>
                ))}
              </div>
            </Row>

            <Row title="Default audio" hint="Sub or dub, for servers that offer both">
              <div className="inline-flex gap-1 rounded-full border border-border bg-card/60 p-1">
                {(['sub', 'dub'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setPref({ audio: a })}
                    aria-pressed={(prefs.audio ?? 'sub') === a}
                    className={cn(
                      'h-8 rounded-full px-3.5 text-sm font-semibold uppercase transition',
                      (prefs.audio ?? 'sub') === a ? 'bg-foreground text-background' : 'text-muted'
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Row>

            <Row title="Preferred audio language" hint="For multi-audio streams">
              <CustomSelect
                label="Preferred audio language"
                value={lang}
                onChange={(v) => {
                  setLang(v)
                  toast(v ? `Audio language: ${langName(v)}` : 'Audio language: Auto')
                }}
                placeholder="Auto"
                options={[{ value: '', label: 'Auto' }, ...LANGS.map((c) => ({ value: c, label: langName(c) }))]}
              />
            </Row>

            <Row title="Preferred quality" hint="Videos start at this quality (or closest below)">
              <CustomSelect
                label="Preferred quality"
                value={maxQ}
                onChange={(v) => {
                  setMaxQ(v)
                  toast(v ? `Preferred quality: ${v}p` : 'Preferred quality: Auto')
                }}
                placeholder="Auto"
                options={[
                  { value: '', label: 'Auto (best)' },
                  { value: '1080', label: '1080p' },
                  { value: '720', label: '720p' },
                  { value: '480', label: '480p' },
                  { value: '360', label: '360p' },
                ]}
              />
            </Row>

            <Row title="Preferred server" hint="Default server used when opening an episode">
              <CustomSelect
                label="Preferred server"
                value={prefs.server ?? 'megaplay'}
                onChange={(v) => setPref({ server: v })}
                placeholder="MegaPlay"
                options={DIRECT.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Row>

            <Row title="Autoplay next episode">
              <Switch on={autoNext} onChange={flag(setAutoNext, 'Autoplay next')} label="Autoplay next episode" />
            </Row>

            <Row title="Auto-skip intro & outro">
              <Switch on={autoSkip} onChange={flag(setAutoSkip, 'Auto-skip intro & outro')} label="Auto-skip intro and outro" />
            </Row>

            <Row title="Skip filler episodes" hint="Next and autoplay jump over filler and recaps">
              <Switch on={skipFiller} onChange={flag(setSkipFiller, 'Skip filler')} label="Skip filler episodes" />
            </Row>

            <Row title="Episode cards" hint="Large cards instead of a compact episode list">
              <Switch
                on={layout === 'card'}
                onChange={(v) => {
                  setLayout(v ? 'card' : 'list')
                  toast(`Episode cards ${v ? 'on' : 'off'}`)
                }}
                label="Episode cards"
              />
            </Row>
          </section>

          {/* 2. Cloud & Sync + AniList */}
          <section id="account" className="scroll-mt-28 space-y-4" aria-label="Account and cloud sync">
            {loading ? null : user ? (
              <AccountPanel />
            ) : (
              <AuthPanel />
            )}
            <AniListCard me={me} />
          </section>

          {/* 3. Ascension Daily & Weekly Quests */}
          <section id="ascension" className="scroll-mt-28 rounded-3xl border border-border/60 bg-card-2/40 p-5 sm:p-7 shadow-xl space-y-6" aria-label="Ascension Quests">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2 text-foreground">
                  <ChevronsUp className="size-5 text-accent" />
                  <span>Hunter Daily &amp; Weekly Quests</span>
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Earn XP by watching anime episodes, reading chapters, and checking in daily.
                </p>
              </div>

              <Link
                to="/ascension"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-foreground/5 px-4 py-1.5 text-xs font-mono font-bold text-foreground transition hover:bg-foreground/10"
              >
                <span>Full Ascension System ➔</span>
              </Link>
            </div>

            {/* Daily Quests List */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                DAILY COMMISSIONS
              </h3>
              <div className="divide-y divide-border/50">
                {DAILY_QUEST_TEMPLATES.map((q) => {
                  const uq = ascensionState.quests[q.id]
                  const progressVal = uq ? uq.progress : 0
                  const isCompleted = uq ? uq.completed : false
                  const isClaimed = uq ? uq.claimed : false
                  const percent = Math.min(100, Math.round((progressVal / q.target) * 100))

                  return (
                    <div key={q.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl shrink-0 mt-0.5">{q.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{q.title}</span>
                            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold text-foreground">
                              +{q.xpReward} XP
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-0.5">{q.description}</p>
                          <div className="mt-2 flex items-center gap-2.5 max-w-xs">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                              <div className="h-full rounded-full bg-foreground transition-all duration-300" style={{ width: `${percent}%` }} />
                            </div>
                            <span className="text-[11px] font-mono text-muted">{progressVal}/{q.target}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 self-end sm:self-center">
                        {isClaimed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-500">
                            <Check className="size-3.5 stroke-[3]" /> Claimed
                          </span>
                        ) : isCompleted ? (
                          <button
                            type="button"
                            disabled={claimLoading === q.id}
                            onClick={() => handleClaimQuest(q.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-bold text-background shadow-md shadow-black/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            <Check className="size-3.5 stroke-[3]" />
                            <span>{claimLoading === q.id ? 'Claiming…' : `Claim +${q.xpReward} XP`}</span>
                          </button>
                        ) : (
                          <span className="text-xs font-mono text-muted">In progress</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Weekly Expeditions List */}
            <div className="space-y-3 border-t border-border/50 pt-5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                WEEKLY EXPEDITIONS
              </h3>
              <div className="divide-y divide-border/50">
                {WEEKLY_QUEST_TEMPLATES.map((q) => {
                  const uq = ascensionState.quests[q.id]
                  const progressVal = uq ? uq.progress : 0
                  const isCompleted = uq ? uq.completed : false
                  const isClaimed = uq ? uq.claimed : false
                  const percent = Math.min(100, Math.round((progressVal / q.target) * 100))

                  return (
                    <div key={q.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-2xl shrink-0 mt-0.5">{q.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{q.title}</span>
                            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold text-foreground">
                              +{q.xpReward} XP
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-0.5">{q.description}</p>
                          <div className="mt-2 flex items-center gap-2.5 max-w-xs">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                              <div className="h-full rounded-full bg-foreground transition-all duration-300" style={{ width: `${percent}%` }} />
                            </div>
                            <span className="text-[11px] font-mono text-muted">{progressVal}/{q.target}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 self-end sm:self-center">
                        {isClaimed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-500">
                            <Check className="size-3.5 stroke-[3]" /> Claimed
                          </span>
                        ) : isCompleted ? (
                          <button
                            type="button"
                            disabled={claimLoading === q.id}
                            onClick={() => handleClaimQuest(q.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-bold text-background shadow-md shadow-black/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          >
                            <Check className="size-3.5 stroke-[3]" />
                            <span>{claimLoading === q.id ? 'Claiming…' : `Claim +${q.xpReward} XP`}</span>
                          </button>
                        ) : (
                          <span className="text-xs font-mono text-muted">In progress</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* 4. Watchlist Section */}
          <section id="watchlist" className="scroll-mt-28 space-y-4" aria-label="Watchlist">
            {/* Header row: Bookmark icon + Watchlist + count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bookmark className="size-5 text-foreground" />
                <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                  Watchlist
                </h2>
              </div>
              <span className="font-mono text-xs text-muted">
                {list.length} anime
              </span>
            </div>

            {user && (
              <button
                type="button"
                role="switch"
                aria-checked={privacy.priv}
                disabled={privacy.busy}
                onClick={() => void privacy.set(!privacy.priv)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition hover:border-foreground/40 active:scale-[0.99] disabled:opacity-60"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground/10">
                  {privacy.priv ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{privacy.priv ? 'Watchlist is private' : 'Watchlist is public'}</span>
                  <span className="block text-xs text-muted">{privacy.priv ? 'Visitors see nothing, and the server never sends them your list.' : 'Anyone with your profile link can see it.'}</span>
                </span>
                <span className={'relative h-6 w-10 shrink-0 rounded-full transition ' + (privacy.priv ? 'bg-foreground' : 'bg-foreground/20')}>
                  <span className={'absolute top-0.5 size-5 rounded-full bg-background transition-all ' + (privacy.priv ? 'left-[1.15rem]' : 'left-0.5')} />
                </span>
              </button>
            )}
            <WatchlistPanel
              items={list}
              lists={customLists}
              onStatus={setStatus}
              emptyTitle="Your watchlist is empty"
              emptyHint="Bookmark series while browsing to track your progress here."
            />
          </section>

          {/* 5. About & Legal */}
          <section
            id="legal"
            className="scroll-mt-28 rounded-3xl border border-border bg-card/60 p-6 sm:p-8 shadow-lg space-y-6 text-sm leading-relaxed text-muted"
            aria-label="About and legal"
          >
            <h2 className={h2}>About &amp; Legal</h2>
            <div>
              <h3 className="mb-1 font-semibold text-foreground">Disclaimer</h3>
              <p>
                Zenkai does not host, upload or store any video, novel text or manga images. Streams, chapters and pages
                are provided by third-party services and are fetched at the moment you watch or read. Zenkai has no
                control over that content and is not affiliated with those services. All titles, artwork and trademarks
                belong to their respective owners.
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold text-foreground">DMCA / Copyright</h3>
              <p>
                If you own a work and believe something linked from Zenkai infringes your copyright, the file lives on
                the third-party host, so please contact that host first. To tell us as well, reach the maintainers through{' '}
                <a
                  href={REPO_URL + '/issues'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-2"
                >
                  GitHub
                </a>
                ,{' '}
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-2"
                >
                  Discord
                </a>{' '}
                or{' '}
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-2"
                >
                  Telegram
                </a>
                .
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-semibold text-foreground">Data &amp; Credits</h3>
              <p>
                Anime data from AniList and MyAnimeList (via Jikan); filler information from AnimeFillerList; artwork and
                episode details from TMDB. Avatar frames come from the SillyTavern-AvatarDecorations-CSS collection.
              </p>
            </div>
            <p className="border-t border-border/60 pt-4 text-xs">
              Your profile and preferences are kept in this browser. Clearing site data removes local storage.{' '}
              <Link to="/home" className="text-foreground underline underline-offset-2 font-medium">
                Back to Zenkai
              </Link>
            </p>
          </section>
        </div>
      )}
    </main>
  )
}
