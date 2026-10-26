import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { AniListCard } from '../components/AniListCard'
import { ProfileCustomizer, ProfileHero, type SectionKey } from '../components/ProfileCustomizer'
import { CustomSelect } from '../components/CustomSelect'
import { DISCORD_URL, REPO_URL, TELEGRAM_URL } from '../lib/app'
import { getPrefs, savePrefs, type Audio } from '../lib/library'
import { useProfile } from '../lib/profile'
import { DIRECT } from '../lib/servers'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { useTheme } from '../context/ThemeContext'
import { useFlag } from '../hooks/useFlag'

const card = 'rounded-3xl border border-border bg-card/60 p-5 sm:p-6'
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('relative h-7 w-12 rounded-full border transition', on ? 'border-transparent bg-accent' : 'border-border bg-card-2')}>
      <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-0.5')} />
    </button>
  )
}

const LANGS = ['ja', 'en', 'hi', 'es', 'pt', 'fr', 'de', 'it', 'ar', 'ru', 'ko', 'zh']
const langName = (c: string) => new Intl.DisplayNames(['en'], { type: 'language' }).of(c) ?? c

export default function ProfilePage() {
  const me = useProfile()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState<Set<SectionKey>>(() => new Set(['avatar']))

  const [prefs, setPrefs] = useState(getPrefs)
  const [autoNext, setAutoNext] = useFlag('zk:autonext', true)
  const [autoSkip, setAutoSkip] = useFlag('zk:autoskip', false)
  const [skipFiller, setSkipFiller] = useFlag('zk:skipfiller', false)
  const [layout, setLayout] = useStored('zk:eplayout')
  const [lang, setLang] = useStored('zp-alang')
  const [maxQ, setMaxQ] = useStored('zp-q')

  useEffect(() => {
    document.title = 'Profile — Zenkai'
    document.documentElement.dataset.zkMono = ''
    if (location.hash === '#legal') window.setTimeout(() => document.getElementById('legal')?.scrollIntoView({ behavior: 'smooth' }), 150)
    return () => {
      delete document.documentElement.dataset.zkMono
    }
  }, [])

  const edit = (k: SectionKey) => {
    setOpen((o) => new Set(o).add(k))
    window.setTimeout(() => document.getElementById(`pc-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
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

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pb-28 pt-24 sm:px-6">
      <ProfileHero me={me} onEdit={edit} />
      <ProfileCustomizer me={me} open={open} setOpen={setOpen} />
      <AniListCard me={me} />

      {/* Preferences */}
      <section className={card} aria-label="Preferences">
        <h2 className={cn(h2, 'mb-4')}>Preferences</h2>
        <Row title="Theme">
          <div className="inline-flex gap-1 rounded-full border border-border bg-card/60 p-1">
            {(['dark', 'light'] as const).map((t) => (
              <button key={t} type="button" onClick={() => (setTheme(t), t !== theme && toast(`${t === 'dark' ? 'Dark' : 'Light'} theme on`))} aria-pressed={theme === t} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold capitalize transition', theme === t ? 'bg-foreground text-background' : 'text-muted')}>
                {t === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
                {t}
              </button>
            ))}
          </div>
        </Row>
        <Row title="Default audio" hint="Sub or dub, for servers that offer both">
          <div className="inline-flex gap-1 rounded-full border border-border bg-card/60 p-1">
            {(['sub', 'dub'] as const).map((a) => (
              <button key={a} type="button" onClick={() => setPref({ audio: a })} aria-pressed={(prefs.audio ?? 'sub') === a} className={cn('h-8 rounded-full px-3.5 text-sm font-semibold uppercase transition', (prefs.audio ?? 'sub') === a ? 'bg-foreground text-background' : 'text-muted')}>
                {a}
              </button>
            ))}
          </div>
        </Row>
        <Row title="Preferred audio language" hint="For multi-audio streams">
          <CustomSelect label="Preferred audio language" value={lang} onChange={(v) => (setLang(v), toast(v ? `Audio language: ${langName(v)}` : 'Audio language: Auto'))} placeholder="Auto" options={[{ value: '', label: 'Auto' }, ...LANGS.map((c) => ({ value: c, label: langName(c) }))]} />
        </Row>
        <Row title="Preferred quality" hint="Videos start at this quality (or the closest below)">
          <CustomSelect label="Preferred quality" value={maxQ} onChange={(v) => (setMaxQ(v), toast(v ? `Preferred quality: ${v}p` : 'Preferred quality: Auto'))} placeholder="Auto" options={[{ value: '', label: 'Auto (best)' }, { value: '1080', label: '1080p' }, { value: '720', label: '720p' }, { value: '480', label: '480p' }, { value: '360', label: '360p' }]} />
        </Row>
        <Row title="Preferred server" hint="Used when you open an episode">
          <CustomSelect label="Preferred server" value={prefs.server ?? 'megaplay'} onChange={(v) => setPref({ server: v })} placeholder="MegaPlay" options={DIRECT.map((s) => ({ value: s.id, label: s.name }))} />
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
        <Row title="Episode cards" hint="Large cards instead of a compact list">
          <Switch on={layout === 'card'} onChange={(v) => (setLayout(v ? 'card' : 'list'), toast(`Episode cards ${v ? 'on' : 'off'}`))} label="Episode cards" />
        </Row>
      </section>

      {/* About & legal */}
      <section id="legal" className={cn(card, 'scroll-mt-24 space-y-5 text-sm leading-relaxed text-muted')} aria-label="About and legal">
        <h2 className={h2}>About &amp; legal</h2>
        <div>
          <h3 className="mb-1 font-semibold text-foreground">Disclaimer</h3>
          <p>
            Zenkai does not host, upload or store any video, novel text or manga images. Streams, chapters and pages are provided by third-party services and are fetched at the moment you watch or read. Zenkai has no control over that
            content and is not affiliated with those services. All titles, artwork and trademarks belong to their respective owners.
          </p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-foreground">DMCA / copyright</h3>
          <p>
            If you own a work and believe something linked from Zenkai infringes your copyright, the file lives on the third-party host, so please contact that host first. To tell us as well, reach the maintainers through{' '}
            <a href={REPO_URL + '/issues'} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">GitHub</a>,{' '}
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">Discord</a> or{' '}
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">Telegram</a>, and include: the work concerned, the exact Zenkai page or link, your contact details, a statement that you act in good faith, and a statement that your notice is accurate and you
            are the owner or their authorised agent. We will review it and remove the link where appropriate.
          </p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-foreground">Data &amp; credits</h3>
          <p>
            Anime data from AniList and MyAnimeList (via Jikan); filler information from AnimeFillerList; artwork and episode details from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. Avatar frames come from the
            SillyTavern-AvatarDecorations-CSS collection, and preset avatars and banners from the avatar-banner list; that artwork belongs to its respective owners.
          </p>
        </div>
        <p>
          Your profile and preferences are kept in this browser only. Clearing site data removes them. <Link to="/home" className="text-foreground underline underline-offset-2">Back to Zenkai</Link>
        </p>
      </section>
    </main>
  )
}
