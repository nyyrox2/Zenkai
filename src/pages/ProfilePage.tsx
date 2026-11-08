import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookmarkCheck,
  ChevronRight,
  Cloud,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserCheck,
} from 'lucide-react'
import { AccountPanel, AuthPanel } from '../components/CloudSyncCard'
import { useAuth } from '../context/AuthContext'
import { AniListCard } from '../components/AniListCard'
import { ProfileEditor, ProfileHero, type SectionKey } from '../components/ProfileCustomizer'
import { CustomSelect } from '../components/CustomSelect'
import { DISCORD_URL, REPO_URL, TELEGRAM_URL } from '../lib/app'
import { getPrefs, savePrefs, type Audio } from '../lib/library'
import { useProfile } from '../lib/profile'
import { DIRECT } from '../lib/servers'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { useTheme } from '../context/ThemeContext'
import { useFlag } from '../hooks/useFlag'
import { supabase } from '../lib/supabase'

type TabKey = 'preferences' | 'account' | 'anilist' | 'legal'

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

  const [prefs, setPrefs] = useState(getPrefs)
  const [autoNext, setAutoNext] = useFlag('zk:autonext', true)
  const [autoSkip, setAutoSkip] = useFlag('zk:autoskip', false)
  const [skipFiller, setSkipFiller] = useFlag('zk:skipfiller', false)
  const [layout, setLayout] = useStored('zk:eplayout')
  const [lang, setLang] = useStored('zp-alang')
  const [maxQ, setMaxQ] = useStored('zp-q')

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

          {/* 3. Unified Content Sections */}
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
