import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Check,
  ChevronDown,
  Cloud,
  Code,
  Copy,
  Gauge,
  Laptop,
  Smartphone,
  type LucideIcon,
} from 'lucide-react'
import { DISCORD_URL, TELEGRAM_URL, WEB_REPO_CLONE, WEB_REPO_URL } from '../lib/app'
import { cn } from '../lib/utils'
import { AuroraBackground } from '../components/AuroraBackground'
import { DiscordIcon, GithubIcon, TelegramIcon } from '../components/BrandIcons'
import { Logo } from '../components/Logo'
import { Reveal } from '../components/Reveal'
import { ThemeToggle } from '../components/ThemeToggle'

type PathId = 'computer' | 'android' | 'cloud'

interface Step {
  title: string
  text?: ReactNode
  code?: string
  note?: ReactNode
}

const ext = 'font-semibold underline underline-offset-4'

const PATHS: { id: PathId; label: string; short: string; icon: LucideIcon; time: string; intro: string; steps: Step[] }[] = [
  {
    id: 'computer',
    label: 'On your computer',
    short: 'Computer',
    icon: Laptop,
    time: 'About 5 minutes',
    intro: 'Windows, macOS or Linux. Everything runs on your machine, so there is no shared limit to run into.',
    steps: [
      {
        title: 'Install Node.js and Git',
        text: (
          <>
            You need <b>Node.js 20.19 or newer</b> (22 LTS is a good pick) and <b>Git</b>. Get them from{' '}
            <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className={ext}>nodejs.org</a> and{' '}
            <a href="https://git-scm.com" target="_blank" rel="noopener noreferrer" className={ext}>git-scm.com</a>.
          </>
        ),
        code: 'node -v',
        note: 'If this prints v20.19 or higher, you are set.',
      },
      { title: 'Download Zenkai', text: 'Clone the source and step into the folder.', code: `git clone ${WEB_REPO_CLONE}\ncd Zenkai` },
      { title: 'Install the dependencies', text: 'This runs once and can take a minute or two.', code: 'npm install' },
      {
        title: 'Start it',
        text: (
          <>
            Open <b>http://localhost:5173</b> in your browser. That is it.
          </>
        ),
        code: 'npm run dev',
        note: 'The same command also runs Zenkai\u2019s API, so there is nothing else to start. To use it on your phone or TV, open the Network address the terminal prints (same Wi\u2011Fi).',
      },
    ],
  },
  {
    id: 'android',
    label: 'On your Android phone',
    short: 'Android',
    icon: Smartphone,
    time: 'About 10 minutes',
    intro: 'Run the whole site from Termux, right on your phone. Handy if you do not have a computer nearby.',
    steps: [
      {
        title: 'Install Termux',
        text: (
          <>
            Get Termux from <a href="https://f-droid.org/packages/com.termux/" target="_blank" rel="noopener noreferrer" className={ext}>F-Droid</a> or its{' '}
            <a href="https://github.com/termux/termux-app/releases" target="_blank" rel="noopener noreferrer" className={ext}>GitHub releases</a>. The Play Store version is outdated.
          </>
        ),
      },
      { title: 'Install Git and Node.js', text: 'Inside Termux:', code: 'pkg update && pkg install git nodejs' },
      { title: 'Download and install Zenkai', code: `git clone ${WEB_REPO_CLONE}\ncd Zenkai\nnpm install`, note: 'The first install can take a few minutes on a phone. Let it finish.' },
      {
        title: 'Start it',
        text: (
          <>
            Open <b>http://localhost:5173</b> in your phone&rsquo;s browser.
          </>
        ),
        code: 'npm run dev',
        note: 'Keep Termux running in the background while you watch. Tapping \u201cAcquire wakelock\u201d in its notification stops Android from putting it to sleep.',
      },
    ],
  },
  {
    id: 'cloud',
    label: 'Online (Cloudflare)',
    short: 'Online',
    icon: Cloud,
    time: 'About 10 minutes',
    intro: 'Deploy the whole thing, the site and its backend API, to your own free Cloudflare account and get a link you can open from anywhere. Nothing runs on your device, and it has its own quota, separate from ours.',
    steps: [
      {
        title: 'Make your accounts',
        text: (
          <>
            You need a free <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener noreferrer" className={ext}>Cloudflare account</a> and a free{' '}
            <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer" className={ext}>GitHub account</a>. No card is needed for the free plans.
          </>
        ),
      },
      {
        title: 'Fork the repository',
        text: (
          <>
            Open <a href={WEB_REPO_URL} target="_blank" rel="noopener noreferrer" className={ext}>the Zenkai repo</a> on GitHub and press <b>Fork</b>. This puts your own copy under your account, and Cloudflare will build from it.
          </>
        ),
      },
      {
        title: 'Create the Pages project',
        text: (
          <>
            In the Cloudflare dashboard open <b>Workers &amp; Pages</b>, press <b>Create</b>, choose the <b>Pages</b> tab, then <b>Connect to Git</b>. Authorize GitHub and pick your fork.
          </>
        ),
      },
      {
        title: 'Set the build',
        text: 'Leave the framework preset on None, leave the root directory empty, and enter:',
        code: 'Build command:     npm run build\nOutput directory:  dist',
        note: (
          <>
            Open <b>Environment variables</b> and add <b>NODE_VERSION</b> = <b>22</b> so the build uses a recent Node. Your backend needs no setup: Cloudflare finds the <b>functions/</b> folder by itself and publishes it as the API (<b>/api/*</b> and <b>/proxy</b>) next to the site.
          </>
        ),
      },
      {
        title: 'Deploy and test the backend',
        text: (
          <>
            Press <b>Save and Deploy</b> and wait for the build to finish. Your site is live at <b>your-project.pages.dev</b>. To check the backend, open this in a new tab. You should see JSON, not a 404 page:
          </>
        ),
        code: 'https://your-project.pages.dev/api/app/release',
        note: 'If the build fails, check that NODE_VERSION is set, then press Retry deployment.',
      },
      {
        title: 'Set your site link',
        text: (
          <>
            In your project go to <b>Settings</b>, then <b>Variables and Secrets</b>, and add <b>VITE_SITE_URL</b> with your <b>https://your-project.pages.dev</b> address. Then open <b>Deployments</b> and retry the latest one so share images and the sitemap use your link.
          </>
        ),
        note: 'From now on, every time you sync your fork on GitHub, Cloudflare rebuilds and updates your site by itself. You can also add your own domain under Custom domains.',
      },
    ],
  },
]

const WHY: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Gauge, title: 'No shared limit', text: 'Your own copy does not count against our hosting plan, so it is not affected when we hit the daily cap.' },
  { icon: Ban, title: '0 ads, 0 cost', text: 'No subscription, no fees. Run it on your own computer or on a free Cloudflare account.' },
  { icon: Code, title: 'Open source', text: 'The full code is on GitHub. Read it, change it, make it yours, and play whenever you want.' },
]

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Is it really free?',
    a: 'Yes. There is no fee for the code, running it on your computer costs nothing, and a Cloudflare Pages deployment can stay on Cloudflare\u2019s free plan.',
  },
  {
    q: 'Does it work without internet?',
    a: 'No. Zenkai shows metadata from public services such as AniList and Jikan and streams from the providers\u2019 servers, so your copy still needs a connection. Those services have their own fair-use limits.',
  },
  {
    q: 'The terminal says the port is already in use.',
    a: (
      <>
        Start it on another port: <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em]">npm run dev -- --port 3000</code>, then open that address instead.
      </>
    ),
  },
  {
    q: 'How do I update my copy?',
    a: (
      <>
        Stop the server, run <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em]">git pull</code> and{' '}
        <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em]">npm install</code>, then start it again.
      </>
    ),
  },
  {
    q: 'Can I use AniList sync on my own copy?',
    a: (
      <>
        Yes. Create an API client at <a href="https://anilist.co/settings/developer" target="_blank" rel="noopener noreferrer" className={ext}>anilist.co/settings/developer</a> with the redirect URL{' '}
        <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em]">http://localhost:5173/auth/anilist</code> (or your own address), copy <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em]">.env.example</code> to{' '}
        <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em]">.env</code> and put your client ID in <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em]">VITE_ANILIST_CLIENT_ID</code>.
      </>
    ),
  },
  {
    q: 'Can I deploy without GitHub?',
    a: (
      <>
        Yes, from a computer. In the project folder run these, then follow the Cloudflare login:
        <code className="mt-2 block whitespace-pre-wrap rounded-xl bg-foreground/10 px-3 py-2 font-mono text-[0.85em] leading-6">npm install{'\n'}npm run build{'\n'}npx wrangler login{'\n'}npx wrangler pages deploy dist --project-name my-zenkai</code>
        <span className="mt-2 block">Run it from the project folder so the <b>functions/</b> backend is uploaded with the site.</span>
      </>
    ),
  },
  {
    q: 'Can the site and the backend live in different places?',
    a: (
      <>
        Yes. Deploy as above to get the backend on Cloudflare, then build the site anywhere you like with{' '}
        <code className="rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[0.85em]">VITE_API_BASE=https://your-project.pages.dev</code> set, so it talks to your API.
      </>
    ),
  },
  { q: 'Does Zenkai host the videos?', a: 'No. Zenkai hosts zero content and has no affiliation with the content providers available through the app.' },
  {
    q: 'Something broke. Where do I ask?',
    a: (
      <>
        Open an issue on <a href={`${WEB_REPO_URL}/issues`} target="_blank" rel="noopener noreferrer" className={ext}>GitHub</a> or ask in the Discord, and include the error from your terminal.
      </>
    ),
  },
]

/** A terminal-style block with a copy button. */
function CodeBlock({ code }: { code: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setDone(true)
      window.setTimeout(() => setDone(false), 1800)
    } catch {
      /* clipboard blocked: the text can still be selected by hand */
    }
  }
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#07070a] text-white shadow-lg shadow-black/20">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <i className="size-2.5 rounded-full bg-[#ff5f57]" />
        <i className="size-2.5 rounded-full bg-[#febc2e]" />
        <i className="size-2.5 rounded-full bg-[#28c840]" />
        <button
          type="button"
          onClick={copy}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold transition hover:bg-white/20 active:scale-95"
        >
          {done ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          {done ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3.5 font-mono text-[13px] leading-7 text-white/90 [overflow-wrap:anywhere]">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default function SelfHostPage() {
  const [path, setPath] = useState<PathId>('computer')
  const active = PATHS.find((p) => p.id === path) ?? PATHS[0]

  useEffect(() => {
    document.title = 'Host your own Zenkai: free, no ads'
  }, [])

  return (
    <main className="relative isolate min-h-svh overflow-hidden">
      <AuroraBackground />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
        <div className="flex items-center gap-4">
          <Logo size={38} to="/" />
          <Link to="/" className="hidden items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm font-semibold backdrop-blur transition hover:bg-foreground hover:text-background sm:inline-flex">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </div>
        <ThemeToggle />
      </header>

      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-20 px-4 pb-24 pt-12 sm:px-6 sm:pt-16 lg:space-y-28">
        {/* Hero */}
        <section className="text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Self-hosting guide
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-[2.5rem] font-black leading-[1.02] tracking-tight [text-wrap:balance]">
            Run your own <span className="text-accent">Zenkai</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted">
            We&rsquo;re on a free hosting plan with a low daily limit, so we can&rsquo;t always give you the best service. Host Zenkai yourself, on your own computer or phone, and play whenever you want.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            {['0 ads', '0 cost', 'No shared limit', 'Open source'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-semibold backdrop-blur">
                <Check className="size-4 text-emerald-400" />
                {t}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#setup" className="inline-flex h-14 items-center gap-2 rounded-full bg-foreground px-7 text-base font-semibold text-background transition hover:opacity-90 active:scale-95">
              Get started
              <ChevronDown className="size-5" />
            </a>
            <a href={WEB_REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-14 items-center gap-2 rounded-full border border-border bg-card/60 px-7 text-base font-semibold backdrop-blur transition hover:bg-foreground hover:text-background active:scale-95">
              <GithubIcon className="size-5" />
              View the source
            </a>
          </div>
        </section>

        {/* Why */}
        <section aria-labelledby="why">
          <Reveal>
            <h2 id="why" className="sr-only">Why host it yourself</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {WHY.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur sm:p-7">
                  <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-accent/30">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Setup */}
        <section id="setup" aria-labelledby="setup-title">
          <Reveal>
            <div className="mb-8 max-w-2xl">
              <h2 id="setup-title" className="font-display text-3xl font-black tracking-tight [text-wrap:balance]">Pick how you want to run it</h2>
              <p className="mt-3 text-base leading-relaxed text-muted">Same Zenkai every time. Choose the option that fits you and follow the steps.</p>
            </div>

            <div role="tablist" aria-label="Hosting options" className="grid gap-2 rounded-3xl border border-border bg-card/60 p-1.5 backdrop-blur sm:grid-cols-3">
              {PATHS.map((p) => {
                const on = p.id === path
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls={`panel-${p.id}`}
                    onClick={() => setPath(p.id)}
                    className={cn(
                      'flex items-center justify-center gap-2.5 rounded-[1.25rem] px-4 py-3.5 text-sm font-semibold transition active:scale-[0.98]',
                      on ? 'bg-foreground text-background shadow-lg' : 'text-muted hover:bg-foreground/5 hover:text-foreground',
                    )}
                  >
                    <p.icon className="size-5" />
                    <span className="sm:hidden">{p.short}</span>
                    <span className="hidden sm:inline">{p.label}</span>
                  </button>
                )
              })}
            </div>

            <div key={active.id} id={`panel-${active.id}`} role="tabpanel" className="mt-6 animate-card-in">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1">
                <p className="max-w-2xl text-sm leading-relaxed text-muted">{active.intro}</p>
                <span className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold">{active.time}</span>
              </div>

              <ol className="mt-5 space-y-4">
                {active.steps.map((s, i) => (
                  <li key={s.title} className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-5 backdrop-blur sm:p-7">
                    <span aria-hidden className="pointer-events-none absolute -right-1 -top-7 font-display text-[8rem] font-black leading-none text-foreground/5">
                      {i + 1}
                    </span>
                    <div className="relative">
                      <div className="flex items-center gap-4">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-display text-base font-black text-accent-fg">{i + 1}</span>
                        <h3 className="min-w-0 font-display text-lg font-bold">{s.title}</h3>
                      </div>
                      <div className="mt-3 min-w-0 sm:pl-[3.25rem]">
                        {s.text && <p className="text-sm leading-relaxed text-muted">{s.text}</p>}
                        {s.code && <CodeBlock code={s.code} />}
                        {s.note && <p className="mt-3 text-sm leading-relaxed text-muted">{s.note}</p>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-5 flex items-start gap-3 rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                <Check className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                <p className="text-sm leading-relaxed">
                  <b>You&rsquo;re running your own Zenkai.</b> No ads, no cost, and no daily limit from us. Come back and run the update steps below whenever there&rsquo;s a new version.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-4xl" aria-labelledby="faq">
          <Reveal>
            <div className="mb-8 max-w-2xl">
              <h2 id="faq" className="font-display text-3xl font-black tracking-tight">Questions</h2>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card/60 backdrop-blur">
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
        <section aria-labelledby="help">
          <Reveal>
            <div className="mb-8 max-w-2xl">
              <h2 id="help" className="font-display text-3xl font-black tracking-tight">Need a hand?</h2>
              <p className="mt-3 text-base leading-relaxed text-muted">Stuck on a step? Ask the community or check the code.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: DiscordIcon, name: 'Discord', text: 'Community, support and discussion', href: DISCORD_URL },
                { icon: TelegramIcon, name: 'Telegram', text: 'Updates and announcements', href: TELEGRAM_URL },
                { icon: GithubIcon, name: 'GitHub', text: 'Source code and issues', href: WEB_REPO_URL },
              ].map(({ icon: Icon, name, text, href }) => (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 rounded-3xl border border-border bg-card/60 p-6 backdrop-blur transition hover:bg-foreground hover:text-background">
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

        <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-muted">
          Zenkai hosts zero content and has no affiliation with the content providers available through the app.{' '}
          <Link to="/" className="font-semibold underline underline-offset-4">Back to Zenkai</Link>
        </p>
      </div>
    </main>
  )
}
