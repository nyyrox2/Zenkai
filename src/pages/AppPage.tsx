import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Download,
  Film,
  Gamepad2,
  HardDriveDownload,
  Languages,
  Library,
  Palette,
  PictureInPicture2,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { fetchHome } from '../services/anilist'
import { refreshRelease, useAppRelease, type AppRelease } from '../services/release'
import { useAsync } from '../hooks/useAsync'
import { APP_INFO_URL, DISCORD_URL, ISSUES_URL, RELEASES_URL, REPO_URL, TELEGRAM_URL, formatBytes, formatDay, timeAgo } from '../lib/app'
import { cn, compact } from '../lib/utils'
import { ApkButton } from '../components/ApkButton'
import { AuroraBackground } from '../components/AuroraBackground'
import { BlurText } from '../components/BlurText'
import { DiscordIcon, GithubIcon, TelegramIcon } from '../components/BrandIcons'
import { NumberTicker } from '../components/NumberTicker'
import { PhoneMockup } from '../components/PhoneMockup'
import { Reveal } from '../components/Reveal'
import { Skeleton } from '../components/Skeleton'
import { SpotlightCard } from '../components/SpotlightCard'

const PILLARS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Film, title: 'Anime', text: 'Stream from multiple servers with Picture-in-Picture and caption translation for supported subtitles. Download episodes to watch offline.' },
  { icon: BookOpen, title: 'Manga', text: 'Several viewer modes and reading directions. Progress syncs and chapters download for offline reading.' },
  { icon: Library, title: 'Novels', text: 'A clean, distraction-free reader built for long-form stories.' },
  { icon: UserRound, title: 'Library and account', text: 'A watchlist, a download manager with storage tracking, and one login for everything.' },
]

const WATCHING: { icon: LucideIcon; text: string }[] = [
  { icon: Server, text: 'Multiple streaming servers for more playback options' },
  { icon: Film, text: 'Direct server playback for supported streams' },
  { icon: PictureInPicture2, text: 'Picture-in-Picture for watching while you use other apps' },
  { icon: Languages, text: 'Caption translation for supported subtitles' },
  { icon: HardDriveDownload, text: 'Episode downloads for offline viewing' },
  { icon: Gamepad2, text: 'Smart playback state with automatic pause handling' },
]
const LIBRARY: { icon: LucideIcon; text: string }[] = [
  { icon: Library, text: 'Watchlist that keeps everything in one place' },
  { icon: HardDriveDownload, text: 'Download manager for episodes and storage' },
  { icon: RefreshCw, text: 'Manga reading progress that stays in sync' },
  { icon: UserRound, text: 'Login and account support' },
  { icon: Users, text: 'Community built directly into the app' },
  { icon: Palette, text: 'Customization to make Zenkai feel like yours' },
]

const STEPS = [
  { title: 'Download the APK', text: 'Tap the button and open the file when it finishes.' },
  { title: 'Allow the install', text: 'If Android asks, allow installs from your browser.' },
  { title: 'Open Zenkai and sign in', text: 'You are sent back to the app automatically.' },
]

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Why is it an APK and not on an app store?',
    a: 'Zenkai is distributed as an APK through GitHub releases. Android asks you to allow installs from your browser the first time, and only for this step.',
  },
  {
    q: 'Is the file safe?',
    a: 'Each release is submitted to VirusTotal for an independent scan. Results can change as antivirus engines update, so the linked report for a release is the source of truth.',
  },
  { q: 'How do I update?', a: 'This page always shows the newest GitHub release. Download it and open it, and Android will normally update the existing app in place.' },
  {
    q: 'Is there an iPhone or desktop version?',
    a: (
      <>
        The app is for Android. Everywhere else, use Zenkai in your browser: <Link to="/home" className="font-semibold underline underline-offset-4">go to the web app</Link>.
      </>
    ),
  },
  {
    q: 'Does Zenkai host the videos?',
    a: 'No. Zenkai hosts zero content and has no affiliation with the content providers available through the app.',
  },
  {
    q: 'Found a bug?',
    a: (
      <>
        Open an issue on <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">GitHub</a> or ask in the Discord.
      </>
    ),
  },
]

function Heading({ title, text, id }: { title: string; text?: string; id?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <h2 id={id} className="font-display text-3xl font-black tracking-tight [text-wrap:balance]">
        {title}
      </h2>
      {text && <p className="mt-3 text-base leading-relaxed text-muted">{text}</p>}
    </div>
  )
}

function Stat({ label, children, loading }: { label: string; children: ReactNode; loading: boolean }) {
  return (
    <div>
      <div className="font-display text-3xl font-black tabular-nums">{loading ? <Skeleton className="h-9 w-20" /> : children}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  )
}

/** Opens on the phone: copy this page's address so it can be sent to the device the APK is for. */
function CopyLink({ className }: { className?: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app`)
      setDone(true)
      window.setTimeout(() => setDone(false), 2000)
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }
  return (
    <button type="button" onClick={copy} className={cn('inline-flex h-14 items-center gap-2 rounded-full border border-border bg-card/60 px-6 text-[15px] font-semibold backdrop-blur transition hover:bg-foreground hover:text-background active:scale-95', className)}>
      {done ? <Check className="size-5" /> : <Copy className="size-5" />}
      {done ? 'Link copied' : 'Send to my phone'}
    </button>
  )
}

function Notes({ rel, limit }: { rel: AppRelease; limit?: number }) {
  const items = rel.sections.flatMap((s) => s.items).slice(0, limit)
  return (
    <ul className="space-y-2.5">
      {items.map((n) => (
        <li key={n.text} className="flex items-start gap-3 text-[15px] leading-relaxed">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-xl bg-foreground/5 text-base">
            {n.icon ?? <Check className="size-4 text-accent" />}
          </span>
          <span className="pt-1">{n.text}</span>
        </li>
      ))}
    </ul>
  )
}

function ApkList({ rel }: { rel: AppRelease }) {
  return (
    <ul className="space-y-2">
      {rel.apks.map((a) => (
        <li key={a.name}>
          <a href={a.url} rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/50 px-4 py-3 transition hover:bg-foreground hover:text-background">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{a.name}</span>
              <span className="text-xs opacity-70">
                {a.label} {formatBytes(a.size)} {a.downloads > 0 && `· ${compact(a.downloads)} downloads`}
              </span>
            </span>
            <Download className="size-5 shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  )
}

export default function AppPage() {
  const { data, loading, failed } = useAppRelease()
  const home = useAsync(() => fetchHome().catch(() => null), [])
  const posters = home.data?.trending.slice(0, 8).map((m) => m.coverImage.large ?? m.coverImage.extraLarge ?? '').filter(Boolean) ?? []
  const rel = data?.latest ?? null
  const waiting = !data && !failed

  useEffect(() => {
    document.title = 'Zenkai for Android: download the APK'
  }, [])

  return (
    <main>
      {/* Hero */}
      <section className="relative isolate overflow-hidden pt-28 sm:pt-32">
        <AuroraBackground />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              {rel ? (
                <>
                  <span className="font-semibold">Latest v{rel.version}</span>
                  <span className="text-muted">released {timeAgo(rel.publishedAt)}</span>
                </>
              ) : (
                <span className="text-muted">{failed ? 'Latest release on GitHub' : 'Checking the latest release'}</span>
              )}
            </p>
            <BlurText text="Anime, manga and novels. One Android app." className="mt-5 max-w-3xl font-display text-5xl font-black leading-[0.98] tracking-tight [text-wrap:balance]" />
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Zenkai puts anime streaming, manga and light novels in one focused app, with your library, downloads and account in sync.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ApkButton large />
              <CopyLink className="hidden md:inline-flex" />
              <Link to="/home" className="inline-flex h-14 items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-muted transition hover:text-foreground">
                Use the web app instead
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <Smartphone className="size-4" />
              Android only. The APK comes straight from GitHub releases.
            </p>

            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              <Stat label="APK downloads" loading={waiting}>
                {data ? <NumberTicker value={data.totalDownloads} /> : '—'}
              </Stat>
              <Stat label="GitHub stars" loading={waiting}>
                {data ? <NumberTicker value={data.stars} /> : '—'}
              </Stat>
              <Stat label="Version" loading={waiting}>
                {rel ? `v${rel.version}` : '—'}
              </Stat>
              <Stat label="Download size" loading={waiting}>
                {rel?.primary ? formatBytes(rel.primary.size) : '—'}
              </Stat>
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-sm py-4">
            <PhoneMockup posters={posters} className="w-[260px] rotate-[4deg] sm:w-[280px]" />
            <span className="animate-float absolute left-0 top-20 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3.5 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xl sm:-left-4">
              <Check className="size-3.5 text-emerald-400" />
              Progress synced
            </span>
            <span className="animate-float absolute bottom-24 right-0 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3.5 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-xl sm:-right-4" style={{ animationDelay: '-3s' }}>
              <Check className="size-3.5 text-emerald-400" />
              Ready offline
            </span>
          </div>
        </div>
      </section>

      <div className="space-y-20 pb-24 sm:space-y-28">
        {/* One place */}
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6" aria-labelledby="one-place">
          <Reveal>
            <Heading id="one-place" title="One place to watch and read" text="Everything you follow lives in the same app, with the same account." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map(({ icon: Icon, title, text }) => (
                <SpotlightCard key={title} className="rounded-3xl p-6">
                  <Icon className="size-7 text-accent" />
                  <h3 className="mt-5 font-display text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </SpotlightCard>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Feature lists */}
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6" aria-labelledby="inside">
          <Reveal>
            <Heading id="inside" title="Built for watching, and for keeping track" />
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { title: 'Watching', items: WATCHING },
                { title: 'Your library', items: LIBRARY },
              ].map((g) => (
                <div key={g.title} className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
                  <h3 className="font-display text-xl font-bold">{g.title}</h3>
                  <ul className="mt-5 space-y-4">
                    {g.items.map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-start gap-3 text-[15px] leading-relaxed">
                        <Icon className="mt-0.5 size-5 shrink-0 text-accent" />
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* What's new + builds (live) */}
        <section id="whats-new" className="mx-auto w-full max-w-7xl px-4 sm:px-6" aria-labelledby="new-title">
          <Reveal>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <Heading id="new-title" title={rel ? `What is new in v${rel.version}` : 'What is new'} />
              <button
                type="button"
                onClick={() => void refreshRelease(true)}
                disabled={loading}
                className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted transition hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                {data ? `Synced from GitHub ${timeAgo(new Date(data.fetchedAt).toISOString())}` : 'Sync from GitHub'}
              </button>
            </div>

            {waiting ? (
              <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                <div className="space-y-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
                <Skeleton className="h-64 rounded-3xl" />
              </div>
            ) : rel ? (
              <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
                <div className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
                  <Notes rel={rel} />
                </div>
                <aside className="space-y-4 rounded-3xl border border-border bg-card/60 p-6 lg:sticky lg:top-28">
                  <div>
                    <p className="font-display text-2xl font-black">{rel.title}</p>
                    <p className="mt-1 text-sm text-muted">Released {formatDay(rel.publishedAt)}</p>
                  </div>
                  {rel.apks.length > 0 ? <ApkList rel={rel} /> : <p className="text-sm text-muted">No APK is attached to this release yet.</p>}
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                    <a href={rel.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                      Release notes on GitHub <ArrowUpRight className="size-4" />
                    </a>
                    {rel.virusTotal && (
                      <a href={rel.virusTotal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                        VirusTotal report <ArrowUpRight className="size-4" />
                      </a>
                    )}
                  </div>
                </aside>
              </div>
            ) : (
              <div className="rounded-3xl border border-border bg-card/60 p-8">
                <p className="text-muted">We could not reach GitHub just now. The newest build is always on the releases page.</p>
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline">
                  Open releases <ArrowUpRight className="size-4" />
                </a>
              </div>
            )}

            {data && data.previous.length > 0 && (
              <div className="mt-10">
                <h3 className="mb-4 font-display text-xl font-bold">Earlier releases</h3>
                <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card/60">
                  {data.previous.map((r) => (
                    <details key={r.tag} className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-foreground/5 [&::-webkit-details-marker]:hidden">
                        <span className="font-semibold">{r.title}</span>
                        <span className="flex items-center gap-4 text-sm text-muted">
                          <span>{formatDay(r.publishedAt)}</span>
                          {r.downloads > 0 && <span className="hidden sm:inline">{compact(r.downloads)} downloads</span>}
                          <ChevronDown className="size-4 transition group-open:rotate-180" />
                        </span>
                      </summary>
                      <div className="grid gap-5 px-5 pb-6 pt-2 md:grid-cols-[1.4fr_1fr]">
                        {r.sections.length > 0 ? <Notes rel={r} /> : <p className="text-sm text-muted">No notes for this release.</p>}
                        <div className="space-y-3">
                          {r.apks.length > 0 && <ApkList rel={r} />}
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
                            View on GitHub <ArrowUpRight className="size-4" />
                          </a>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </Reveal>
        </section>

        {/* Install */}
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6" aria-labelledby="install">
          <Reveal>
            <Heading id="install" title="Install in three steps" />
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
                  <span aria-hidden className="absolute -right-2 -top-6 font-display text-[9rem] font-black leading-none text-foreground/5">
                    {i + 1}
                  </span>
                  <span className="relative grid size-10 place-items-center rounded-full bg-accent font-display text-lg font-black text-accent-fg">{i + 1}</span>
                  <h3 className="relative mt-5 font-display text-xl font-bold">{s.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        {/* Security */}
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6" aria-labelledby="security">
          <Reveal>
            <div className="grid gap-8 rounded-[2rem] border border-border bg-card/60 p-6 sm:p-10 lg:grid-cols-[auto_1fr] lg:gap-12">
              <ShieldCheck className="size-14 text-accent" />
              <div>
                <h2 id="security" className="font-display text-3xl font-black tracking-tight">Security and transparency</h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted">
                  Zenkai releases are submitted to VirusTotal for independent antivirus analysis. Results can change as antivirus engines update their signatures, so the report linked from a release is the source of truth for that scan.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                  {rel?.virusTotal && (
                    <a href={rel.virusTotal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                      Scan report for v{rel.version} <ArrowUpRight className="size-4" />
                    </a>
                  )}
                  <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                    Source on GitHub <ArrowUpRight className="size-4" />
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-4xl px-4 sm:px-6" aria-labelledby="faq">
          <Reveal>
            <Heading id="faq" title="Questions" />
            <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card/60">
              {FAQ.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 font-semibold transition hover:bg-foreground/5 sm:px-7 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="size-5 shrink-0 text-muted transition group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-6 leading-relaxed text-muted sm:px-7">{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Community */}
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6" aria-labelledby="community">
          <Reveal>
            <Heading id="community" title="Join the community" text="Get help, hear about updates first and follow the code." />
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: DiscordIcon, name: 'Discord', text: 'Community, support and discussion', href: DISCORD_URL },
                { icon: TelegramIcon, name: 'Telegram', text: 'Updates and announcements', href: TELEGRAM_URL },
                { icon: GithubIcon, name: 'GitHub', text: 'Source code and releases', href: REPO_URL },
              ].map(({ icon: Icon, name, text, href }) => (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 rounded-3xl border border-border bg-card/60 p-6 transition hover:bg-foreground hover:text-background">
                  <Icon className="size-8 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-bold">{name}</span>
                    <span className="block text-sm opacity-70">{text}</span>
                  </span>
                  <ArrowUpRight className="size-5 shrink-0 opacity-60 transition group-hover:opacity-100" />
                </a>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Closing */}
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <Reveal>
            <div className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-14 text-center sm:py-20">
              <AuroraBackground />
              <h2 className="mx-auto max-w-2xl font-display text-4xl font-black leading-[1.02] tracking-tight [text-wrap:balance]">One place for what you watch. One place for what you read.</h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <ApkButton large />
                <a href={APP_INFO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-16 items-center gap-2 rounded-full border border-border bg-background/50 px-7 text-base font-semibold backdrop-blur transition hover:bg-foreground hover:text-background active:scale-95">
                  Official site <ArrowUpRight className="size-5" />
                </a>
              </div>
              <p className="mx-auto mt-6 max-w-lg text-xs leading-relaxed text-muted">Zenkai hosts zero content and has no affiliation with the content providers available through the app.</p>
            </div>
          </Reveal>
        </section>
      </div>
    </main>
  )
}
