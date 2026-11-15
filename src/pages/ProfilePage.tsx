import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  BookmarkCheck,
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
import { getPrefs, savePrefs, useList, type Audio, type ListStatus } from '../lib/library'
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
  const [showAuth, setShowAuth] = useState(false)
  const [editTab, setEditTab] = useState<SectionKey>('identity')
  const [activeTab, setActiveTab] = useState<TabKey>('preferences')
  const [watchlistFilter, setWatchlistFilter] = useState<'all' | ListStatus>('all')
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

  const SUB_TABS = [
    { id: 'preferences' as const, label: 'Preferences', icon: SlidersHorizontal },
    { id: 'ascension' as const, label: 'Ascension Quests', icon: ChevronsUp, badge: `Lv.${ascensionState.level}` },
    { id: 'watchlist' as const, label: 'Watchlist', icon: Bookmark, badge: list.length > 0 ? `${list.length}` : null },
    { id: 'account' as const, label: 'Cloud & Sync', icon: Cloud, badge: user ? 'Connected' : null },
    { id: 'anilist' as const, label: 'AniList', icon: BookmarkCheck },
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

          {/* 2. Cohesive Section Switcher Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-border/60 pt-1">
            {SUB_TABS.map(({ id, label, icon: Icon, badge }) => {
              const on = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition active:scale-95',
                    on
                      ? 'border-accent bg-accent/15 text-accent shadow-sm'
                      : 'border-transparent bg-transparent text-muted hover:border-border/60 hover:text-foreground'
                  )}
                >
                  <Icon className="size-4" />
                  <span>{label}</span>
                  {badge && (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-black text-accent uppercase">
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 3. Watchlist Section matching Zenkai theme */}
          {activeTab === 'watchlist' && (
            <section className="space-y-4" aria-label="Watchlist">
              {/* Header row: Bookmark icon + Watchlist + count */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bookmark className="size-5 text-accent fill-accent/20" />
                  <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                    Watchlist
                  </h2>
                </div>
                <span className="font-mono text-xs text-muted">
                  {list.length} anime
                </span>
              </div>

              {/* Filter Pills matching Zenkai theme */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'all' as const, label: 'All', count: list.length },
                  { id: 'watching' as const, label: 'Watching', count: list.filter((i) => i.status === 'watching').length },
                  { id: 'planning' as const, label: 'Planning', count: list.filter((i) => i.status === 'planning').length },
                  { id: 'completed' as const, label: 'Completed', count: list.filter((i) => i.status === 'completed').length },
                  { id: 'paused' as const, label: 'Paused', count: list.filter((i) => i.status === 'paused').length },
                  { id: 'dropped' as const, label: 'Dropped', count: list.filter((i) => i.status === 'dropped').length },
                ].map((f) => {
                  const on = watchlistFilter === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setWatchlistFilter(f.id)}
                      className={cn(
                        'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-mono font-semibold transition active:scale-95',
                        on
                          ? 'bg-accent text-accent-fg font-bold shadow-md shadow-accent/25'
                          : 'border border-[#242730] bg-card/60 text-muted hover:border-border hover:text-foreground'
                      )}
                    >
                      {f.label} ({f.count})
                    </button>
                  )
                })}
              </div>

              {/* Media Cards Grid */}
              {(() => {
                const filtered = watchlistFilter === 'all' ? list : list.filter((i) => i.status === watchlistFilter)
                if (filtered.length === 0) {
                  return (
                    <div className="grid place-items-center rounded-3xl border border-dashed border-border/80 bg-card/20 px-6 py-14 text-center">
                      <Bookmark className="size-10 text-muted/50 mb-2" />
                      <p className="font-semibold text-foreground">
                        {list.length === 0 ? 'Your watchlist is empty' : `No anime marked "${watchlistFilter}"`}
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-muted">
                        Bookmark your favorite series while browsing to track your progress here.
                      </p>
                      <Link
                        to="/browse"
                        className="mt-5 rounded-full bg-foreground px-6 py-2.5 text-xs font-bold text-background transition hover:brightness-110 active:scale-95"
                      >
                        Browse Anime
                      </Link>
                    </div>
                  )
                }

                return (
                  <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {filtered.map((item) => (
                      <div key={item.id} className="group/card relative">
                        <Link to={`/anime/${item.id}`} className="block outline-none">
                          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border/70 bg-card-2 transition duration-200 group-hover:scale-[1.02] group-hover:border-accent/40 group-hover:shadow-2xl">
                            <img
                              src={item.image}
                              alt={item.title}
                              loading="lazy"
                              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />

                            {/* Top Left Score Rating Badge */}
                            {item.score ? (
                              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 backdrop-blur-sm">
                                ★ {item.score}
                              </span>
                            ) : null}

                            {/* Episode Progress Tag */}
                            {item.progress ? (
                              <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-white backdrop-blur-sm">
                                Ep {item.progress}{item.episodes ? ` / ${item.episodes}` : ''}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-2.5 line-clamp-1 text-xs sm:text-sm font-bold text-foreground transition-colors group-hover:text-accent">
                            {item.title}
                          </h3>
                        </Link>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </section>
          )}

          {/* 4. Unified Content Sections */}
          {activeTab === 'preferences' && (
            <section
              id="settings"
              className="rounded-3xl border border-border bg-card/60 p-5 sm:p-7 shadow-lg"
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
          )}

          {activeTab === 'ascension' && (
            <section className="rounded-3xl border border-border/60 bg-card-2/40 p-5 sm:p-7 shadow-xl space-y-6">
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-mono font-bold text-accent transition hover:bg-accent/20"
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
                              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                                +{q.xpReward} XP
                              </span>
                            </div>
                            <p className="text-xs text-muted mt-0.5">{q.description}</p>
                            <div className="mt-2 flex items-center gap-2.5 max-w-xs">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                                <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
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
                              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
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
                              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                                +{q.xpReward} XP
                              </span>
                            </div>
                            <p className="text-xs text-muted mt-0.5">{q.description}</p>
                            <div className="mt-2 flex items-center gap-2.5 max-w-xs">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
                                <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
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
                              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-bold text-accent-fg shadow-md shadow-accent/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
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
          )}

          {activeTab === 'account' && (
            <div className="space-y-4">
              {loading ? null : user ? (
                <AccountPanel />
              ) : showAuth ? (
                <AuthPanel />
              ) : (
                <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 shadow-lg text-center space-y-4">
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent">
                    <UserCheck className="size-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold">Sign in to Zenkai Cloud</h2>
                    <p className="mt-1 text-sm text-muted max-w-md mx-auto">
                      Back up your watch history, watchlist, reading progress and custom profile across all devices.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuth(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-bold text-accent-fg shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95"
                  >
                    <span>Sign in or create account</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'anilist' && (
            <div>
              <AniListCard me={me} />
            </div>
          )}

          {activeTab === 'legal' && (
            <section
              id="legal"
              className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 shadow-lg space-y-6 text-sm leading-relaxed text-muted"
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
          )}
        </div>
      )}
    </main>
  )
}
