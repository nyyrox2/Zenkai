import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, Download, Monitor, Smartphone } from 'lucide-react'
import { cn } from '../lib/utils'

const KIWI_URL = 'https://kiwi-browser.en.uptodown.com/android/download'
const zip = <code className="rounded bg-foreground/10 px-1 text-accent">zenkai-companion.zip</code>

type Step = { t: string; d: React.ReactNode; img?: string }

const ANDROID: Step[] = [
  { t: 'Install Kiwi Browser', d: <>Chrome on Android can't run extensions, Kiwi can. Get it from <a href={KIWI_URL} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 font-semibold text-accent">Uptodown <ArrowUpRight className="size-3" /></a> and open it.</> },
  { t: 'Download the extension', d: <>On the <Link to="/extension" className="font-semibold text-accent">extension page</Link> tap <b>Download Extension (.ZIP)</b>. It lands in your Download folder as {zip}.</> },
  { t: 'Open Extensions', d: <>Tap the <b>⋮</b> menu in Kiwi, then <b>Extensions</b>.</>, img: '/guide/menu.jpg' },
  { t: 'Add the zip', d: <>Turn on <b>Developer mode</b> (top right), then tap <b>+ (from .zip/.crx/.user.js)</b>.</>, img: '/guide/extensions.jpg' },
  { t: 'Pick the file', d: <>Open <b>Download</b> and choose {zip}.</>, img: '/guide/files.jpg' },
  { t: 'Open Zenkai in Kiwi', d: <>Reload Zenkai. The player badge changes to <b>Extension Active</b>.</> },
]

const DESKTOP: Step[] = [
  { t: 'Download the extension', d: <>On the <Link to="/extension" className="font-semibold text-accent">extension page</Link> click <b>Download Extension (.ZIP)</b>.</> },
  { t: 'Extract it', d: <>Unzip {zip} into any folder and keep it there.</> },
  { t: 'Open extensions', d: <>Go to <code className="rounded bg-foreground/10 px-1 text-accent">chrome://extensions</code> in Chrome, Edge, Brave, Opera or Vivaldi and turn on <b>Developer mode</b>.</> },
  { t: 'Load unpacked', d: <>Click <b>Load unpacked</b> and select the extracted folder.</> },
  { t: 'Reload Zenkai', d: <>The player badge changes to <b>Extension Active</b>.</> },
]

const TABS = [
  { id: 'android', label: 'Android', icon: Smartphone, steps: ANDROID },
  { id: 'desktop', label: 'Desktop', icon: Monitor, steps: DESKTOP },
]

export default function ExtensionGuidePage() {
  const [tab, setTab] = useState<'android' | 'desktop'>(/Android|Mobi/i.test(navigator.userAgent) ? 'android' : 'desktop')
  const steps = TABS.find((t) => t.id === tab)!.steps
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-28 pt-12 md:pb-16">
      <Link to="/extension" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted transition hover:text-foreground">
        <ArrowLeft className="size-4" /> Extension
      </Link>
      <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight">How to install</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">Takes about a minute. No store account needed.</p>

      <div className="mt-6 inline-flex rounded-full border border-border p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id as typeof tab)} className={cn('relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors', tab === id ? 'text-background' : 'text-muted hover:text-foreground')}>
            {tab === id && <motion.span layoutId="guide-tab" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <Icon className="relative size-3.5" /> <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.ol key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-8 space-y-8 border-l border-border pl-6">
          {steps.map((s, i) => (
            <li key={s.t} className="relative">
              <span className="absolute -left-[calc(1.5rem+0.5px)] top-0 grid size-6 -translate-x-1/2 place-items-center rounded-full bg-accent text-[11px] font-extrabold text-accent-fg">{i + 1}</span>
              <h2 className="text-sm font-bold">{s.t}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.d}</p>
              {s.img && <img src={s.img} alt={s.t} loading="lazy" className="mt-3 max-h-80 w-auto rounded-xl border border-border" />}
            </li>
          ))}
        </motion.ol>
      </AnimatePresence>

      <a href="/zenkai-companion.zip" download="zenkai-companion.zip" className="mt-10 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-fg transition active:scale-95">
        <Download className="size-4" /> Download Extension (.ZIP)
      </a>
    </main>
  )
}
